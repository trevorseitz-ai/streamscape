import { createSupabaseAdmin } from '../../lib/supabase-server';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

function toFullImageUrl(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/')) return null;
  return `${TMDB_IMAGE_BASE}${path}`;
}

async function fetchTMDB<T>(path: string): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) throw new Error('TMDB_API_KEY is not configured');

  const url = `${TMDB_BASE}${path}${path.includes('?') ? '&' : '?'}language=en-US`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[Movie API] TMDB request failed:', res.status, path, text);
    throw new Error(`TMDB API error: ${res.status}`);
  }

  return res.json();
}

type RoleType = 'actor' | 'director' | 'writer' | 'cinematographer' | 'assistant_director';

const CREW_ROLE_MAP: Record<string, RoleType> = {
  Director: 'director',
  Writer: 'writer',
  Screenplay: 'writer',
  'Director of Photography': 'cinematographer',
  'First Assistant Director': 'assistant_director',
};

interface TMDBFullMovie {
  id: number;
  title: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  credits?: {
    cast?: Array<{ name: string; character: string | null; profile_path: string | null }>;
    crew?: Array<{ name: string; job: string; profile_path: string | null }>;
  };
  'watch/providers'?: {
    results?: {
      US?: {
        flatrate?: Array<{ provider_name: string }>;
        rent?: Array<{ provider_name: string }>;
        buy?: Array<{ provider_name: string }>;
      };
    };
  };
  videos?: {
    results?: Array<{
      key: string;
      site: string;
      type: string;
    }>;
  };
}

export async function GET(request: Request) {
  console.log('[Movie API] GET request received');

  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('id');

    if (!mediaId) {
      return Response.json({ error: 'id parameter is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const { data: media, error: mediaError } = await supabase
      .from('media')
      .select('id, title, release_year')
      .eq('id', mediaId)
      .single();

    if (mediaError || !media) {
      return Response.json({ error: 'Movie not found in database' }, { status: 404 });
    }

    console.log('[Movie API] Enriching:', media.title);

    const searchRes = await fetchTMDB<{
      results?: Array<{ id: number; title: string; release_date: string }>;
    }>(`/search/movie?query=${encodeURIComponent(media.title)}`);

    let tmdbId: number | null = null;
    for (const r of searchRes.results ?? []) {
      const rYear = r.release_date ? parseInt(r.release_date.slice(0, 4), 10) : null;
      if (media.release_year && rYear === media.release_year) {
        tmdbId = r.id;
        break;
      }
    }
    if (!tmdbId && searchRes.results?.[0]) {
      tmdbId = searchRes.results[0].id;
    }

    if (!tmdbId) {
      return Response.json({ error: 'Movie not found on TMDB' }, { status: 404 });
    }

    const movieData = await fetchTMDB<TMDBFullMovie>(
      `/movie/${tmdbId}?append_to_response=credits,watch/providers,videos`
    );

    const releaseYear = movieData.release_date
      ? parseInt(movieData.release_date.slice(0, 4), 10)
      : media.release_year;

    await supabase
      .from('media')
      .update({
        synopsis: movieData.overview ?? null,
        poster_url: toFullImageUrl(movieData.poster_path),
        backdrop_url: toFullImageUrl(movieData.backdrop_path),
        release_year: releaseYear,
        last_scraped_at: new Date().toISOString(),
      })
      .eq('id', mediaId);

    await supabase.from('media_cast_crew').delete().eq('media_id', mediaId);
    await supabase.from('media_availability').delete().eq('media_id', mediaId);

    const castEntries: Array<{
      name: string;
      role_type: RoleType;
      character: string | null;
      job: string | null;
    }> = [];

    for (const c of (movieData.credits?.cast ?? []).slice(0, 10)) {
      castEntries.push({
        name: c.name,
        role_type: 'actor',
        character: c.character ?? null,
        job: null,
      });
    }

    const addedCrew = new Set<string>();
    for (const c of movieData.credits?.crew ?? []) {
      const mappedRole = CREW_ROLE_MAP[c.job];
      if (!mappedRole) continue;
      const key = `${c.name}::${mappedRole}`;
      if (addedCrew.has(key)) continue;
      addedCrew.add(key);
      castEntries.push({
        name: c.name,
        role_type: mappedRole,
        character: null,
        job: c.job,
      });
    }

    for (const c of castEntries) {
      const { data: person } = await supabase
        .from('people')
        .select('id')
        .eq('name', c.name)
        .maybeSingle();

      let personId = person?.id;
      if (!personId) {
        const { data: newPerson } = await supabase
          .from('people')
          .insert({ name: c.name })
          .select('id')
          .single();
        personId = newPerson?.id;
      }

      if (personId) {
        await supabase.from('media_cast_crew').insert({
          media_id: mediaId,
          person_id: personId,
          role_type: c.role_type,
          character: c.character ?? null,
          job: c.job ?? null,
        });
      }
    }

    const us = movieData['watch/providers']?.results?.US;
    interface PlatformEntry { name: string; access_type: 'subscription' | 'rent' | 'buy' }
    const platforms: PlatformEntry[] = [];
    if (us?.flatrate) {
      for (const p of us.flatrate) platforms.push({ name: p.provider_name, access_type: 'subscription' });
    }
    if (us?.rent) {
      for (const p of us.rent) platforms.push({ name: p.provider_name, access_type: 'rent' });
    }
    if (us?.buy) {
      for (const p of us.buy) platforms.push({ name: p.provider_name, access_type: 'buy' });
    }

    for (const p of platforms) {
      const { data: platform } = await supabase
        .from('platforms')
        .select('id')
        .eq('name', p.name)
        .maybeSingle();

      let platformId = platform?.id;
      if (!platformId) {
        const { data: newPlatform } = await supabase
          .from('platforms')
          .insert({ name: p.name })
          .select('id')
          .single();
        platformId = newPlatform?.id;
      }

      if (platformId) {
        await supabase.from('media_availability').insert({
          media_id: mediaId,
          platform_id: platformId,
          access_type: p.access_type,
          price: null,
          direct_url: null,
        });
      }
    }

    const trailer = (movieData.videos?.results ?? []).find(
      (v) => v.site === 'YouTube' && v.type === 'Trailer'
    );

    return Response.json({
      success: true,
      mediaId,
      enriched: true,
      castCount: castEntries.length,
      platformCount: platforms.length,
      trailerKey: trailer?.key ?? null,
    });
  } catch (error) {
    console.error('[Movie API] Unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
