import { createSupabaseAdmin } from '../../lib/supabase-server';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

interface MediaData {
  title: string;
  type: 'movie' | 'tv';
  synopsis: string | null;
  release_year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  platforms: Array<{
    name: string;
    access_type: 'subscription' | 'rent' | 'buy';
    price: number | null;
    direct_url: string | null;
  }>;
  cast: Array<{
    name: string;
    role_type: 'actor' | 'director' | 'writer' | 'cinematographer' | 'assistant_director';
    character: string | null;
    job: string | null;
  }>;
}

function toFullImageUrl(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/')) return null;
  return `${TMDB_IMAGE_BASE}${path}`;
}

async function fetchTMDB<T>(path: string): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('TMDB_API_KEY is not configured');
  }

  const url = `${TMDB_BASE}${path}${path.includes('?') ? '&' : '?'}language=en-US`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[Search API] TMDB request failed:', res.status, path, text);
    throw new Error(`TMDB API error: ${res.status}`);
  }

  return res.json();
}

async function fetchMovieData(query: string): Promise<MediaData | null> {
  console.log('[Search API] Fetching TMDB search for:', query);

  const searchRes = await fetchTMDB<{
    results?: Array<{
      id: number;
      title: string;
      overview: string | null;
      poster_path: string | null;
      backdrop_path: string | null;
      release_date: string;
    }>;
  }>(`/search/movie?query=${encodeURIComponent(query)}`);

  const movie = searchRes.results?.[0];
  if (!movie) {
    console.log('[Search API] No movie results found');
    return null;
  }

  const movieId = movie.id;
  const releaseYear = movie.release_date
    ? parseInt(movie.release_date.slice(0, 4), 10)
    : null;

  console.log('[Search API] Found movie:', movie.title, 'id:', movieId);

  const [providersRes, creditsRes] = await Promise.all([
    fetchTMDB<{
      results?: {
        US?: {
          flatrate?: Array<{ provider_name: string }>;
          rent?: Array<{ provider_name: string }>;
          buy?: Array<{ provider_name: string }>;
        };
      };
    }>(`/movie/${movieId}/watch/providers`),
    fetchTMDB<{
      cast?: Array<{ name: string; character: string | null }>;
      crew?: Array<{ name: string; job: string }>;
    }>(`/movie/${movieId}/credits`),
  ]);

  const us = providersRes.results?.US;
  const platforms: MediaData['platforms'] = [];

  if (us?.flatrate) {
    for (const p of us.flatrate) {
      platforms.push({
        name: p.provider_name,
        access_type: 'subscription',
        price: null,
        direct_url: null,
      });
    }
  }
  if (us?.rent) {
    for (const p of us.rent) {
      platforms.push({
        name: p.provider_name,
        access_type: 'rent',
        price: null,
        direct_url: null,
      });
    }
  }
  if (us?.buy) {
    for (const p of us.buy) {
      platforms.push({
        name: p.provider_name,
        access_type: 'buy',
        price: null,
        direct_url: null,
      });
    }
  }

  const cast: MediaData['cast'] = [];
  const topCast = (creditsRes.cast ?? []).slice(0, 10);
  for (const c of topCast) {
    cast.push({
      name: c.name,
      role_type: 'actor',
      character: c.character ?? null,
      job: null,
    });
  }

  const crewRoleMap: Record<string, MediaData['cast'][number]['role_type']> = {
    Director: 'director',
    Writer: 'writer',
    Screenplay: 'writer',
    'Director of Photography': 'cinematographer',
    'First Assistant Director': 'assistant_director',
  };

  const addedCrew = new Set<string>();
  for (const c of creditsRes.crew ?? []) {
    const mappedRole = crewRoleMap[c.job];
    if (!mappedRole) continue;
    const key = `${c.name}::${mappedRole}`;
    if (addedCrew.has(key)) continue;
    addedCrew.add(key);
    cast.push({
      name: c.name,
      role_type: mappedRole,
      character: null,
      job: c.job,
    });
  }

  return {
    title: movie.title,
    type: 'movie',
    synopsis: movie.overview ?? null,
    release_year: releaseYear,
    poster_url: toFullImageUrl(movie.poster_path),
    backdrop_url: toFullImageUrl(movie.backdrop_path),
    platforms,
    cast,
  };
}

async function upsertToSupabase(data: MediaData) {
  console.log('[Search API] upsertToSupabase called for:', data.title);

  const supabase = createSupabaseAdmin();
  const now = new Date().toISOString();

  const mediaRow = {
    type: data.type,
    title: data.title,
    synopsis: data.synopsis ?? null,
    release_year: data.release_year ?? null,
    poster_url: data.poster_url ?? null,
    backdrop_url: data.backdrop_url ?? null,
    last_scraped_at: now,
  };

  const { data: existing } = await supabase
    .from('media')
    .select('id')
    .ilike('title', data.title)
    .limit(1)
    .maybeSingle();

  let mediaId: string;
  let isNew: boolean;

  if (existing) {
    await supabase.from('media').update(mediaRow).eq('id', existing.id);
    mediaId = existing.id;
    isNew = false;

    await supabase.from('media_availability').delete().eq('media_id', mediaId);
    await supabase.from('media_cast_crew').delete().eq('media_id', mediaId);
  } else {
    const { data: inserted, error } = await supabase
      .from('media')
      .insert(mediaRow)
      .select('id')
      .single();

    if (error || !inserted) throw new Error(error?.message ?? 'Failed to insert media');
    mediaId = inserted.id;
    isNew = true;
  }

  for (const p of data.platforms) {
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
        price: p.price ?? null,
        direct_url: p.direct_url ?? null,
      });
    }
  }

  for (const c of data.cast) {
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

  return { mediaId, isNew };
}

export async function POST(request: Request) {
  console.log('[Search API] POST request received');

  try {
    let query: string | null = null;

    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const body = await request.json();
      query = body?.q ?? null;
    }
    if (!query) {
      const { searchParams } = new URL(request.url);
      query = searchParams.get('q');
    }

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      console.log('[Search API] Missing or invalid query');
      return Response.json(
        { error: 'Search query (q) is required' },
        { status: 400 }
      );
    }

    console.log('[Search API] Starting TMDB fetch for:', query.trim());

    const data = await fetchMovieData(query.trim());

    console.log('[Search API] TMDB fetch finished. Has data:', !!data);

    if (!data) {
      return Response.json(
        { error: 'Could not find this movie', query },
        { status: 404 }
      );
    }

    console.log('[Search API] Starting Supabase insert');

    let dbResult;
    try {
      dbResult = await upsertToSupabase(data);
    } catch (dbError) {
      const message =
        dbError instanceof Error ? dbError.message : 'Database error';
      console.error('[Search API] Supabase insert failed:', message);
      return Response.json(
        {
          error: 'Failed to save to database',
          detail: message,
          data,
        },
        { status: 500 }
      );
    }

    console.log('[Search API] Supabase insert complete. mediaId:', dbResult.mediaId);

    return Response.json({
      success: true,
      query,
      mediaId: dbResult.mediaId,
      isNew: dbResult.isNew,
      data,
    });
  } catch (error) {
    console.error('[Search API] Unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
