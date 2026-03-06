import { createSupabaseAdmin } from '../../lib/supabase-server';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

interface DiscoverMovie {
  id: string;
  title: string;
  poster_url: string | null;
  release_year: number | null;
  synopsis: string | null;
  backdrop_url: string | null;
  vote_average: number | null;
  platforms: Array<{
    name: string;
    access_type: 'subscription' | 'rent' | 'buy';
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
    console.error('[Discover API] TMDB request failed:', res.status, path, text);
    throw new Error(`TMDB API error: ${res.status}`);
  }

  return res.json();
}

async function upsertDiscoverMovies(movies: DiscoverMovie[]) {
  const supabase = createSupabaseAdmin();
  const now = new Date().toISOString();

  for (const movie of movies) {
    const mediaRow = {
      type: 'movie' as const,
      title: movie.title,
      synopsis: movie.synopsis ?? null,
      release_year: movie.release_year ?? null,
      poster_url: movie.poster_url ?? null,
      backdrop_url: movie.backdrop_url ?? null,
      last_scraped_at: now,
    };

    const { data: existing } = await supabase
      .from('media')
      .select('id')
      .ilike('title', movie.title)
      .eq('release_year', movie.release_year ?? 0)
      .limit(1)
      .maybeSingle();

    let mediaId: string;

    if (existing) {
      await supabase.from('media').update(mediaRow).eq('id', existing.id);
      mediaId = existing.id;
      await supabase.from('media_availability').delete().eq('media_id', mediaId);
    } else {
      const { data: inserted, error } = await supabase
        .from('media')
        .insert(mediaRow)
        .select('id')
        .single();

      if (error || !inserted) continue;
      mediaId = inserted.id;
    }

    movie.id = mediaId;

    for (const p of movie.platforms) {
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
  }
}

export async function GET(request: Request) {
  console.log('[Discover API] GET request received');

  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const page = searchParams.get('page') ?? '1';
    const streamingOnly = searchParams.get('streamingOnly') === 'true';
    const providers = searchParams.get('providers') ?? '';
    const genre = searchParams.get('genre') ?? '';
    const phase = searchParams.get('phase') ?? '1';

    if (!year || !/^\d{4}$/.test(year)) {
      return Response.json(
        { error: 'A valid 4-digit year parameter is required' },
        { status: 400 }
      );
    }

    const yearNum = parseInt(year, 10);
    const currentYear = new Date().getFullYear();
    if (yearNum < 1900 || yearNum > currentYear) {
      return Response.json(
        { error: `Year must be between 1900 and ${currentYear}` },
        { status: 400 }
      );
    }

    console.log('[Discover API] year:', year, 'phase:', phase, 'streaming:', streamingOnly, 'providers:', providers, 'genre:', genre);

    let discoverUrl =
      `/discover/movie?primary_release_year=${year}&region=US&page=${page}`;

    if (phase === '2') {
      discoverUrl += '&sort_by=popularity.desc';
    } else {
      discoverUrl += '&sort_by=vote_average.desc&vote_count.gte=10';
    }

    if (providers) {
      discoverUrl += `&with_watch_providers=${providers}&watch_region=US`;
    } else if (streamingOnly) {
      discoverUrl += '&with_watch_monetization_types=flatrate&watch_region=US';
    }

    if (genre && /^(\d+\|)*\d+$/.test(genre)) {
      discoverUrl += `&with_genres=${genre}`;
    }

    const discoverRes = await fetchTMDB<{
      results?: Array<{
        id: number;
        title: string;
        overview: string | null;
        poster_path: string | null;
        backdrop_path: string | null;
        release_date: string;
        vote_average: number;
      }>;
      total_pages?: number;
      total_results?: number;
    }>(discoverUrl);

    const tmdbMovies = discoverRes.results ?? [];
    console.log('[Discover API] Found', tmdbMovies.length, 'movies');

    const movies: DiscoverMovie[] = tmdbMovies.map((m) => {
      const releaseYear = m.release_date
        ? parseInt(m.release_date.slice(0, 4), 10)
        : null;

      return {
        id: String(m.id),
        title: m.title,
        poster_url: toFullImageUrl(m.poster_path),
        release_year: releaseYear,
        synopsis: m.overview ?? null,
        backdrop_url: toFullImageUrl(m.backdrop_path),
        vote_average: m.vote_average ?? null,
        platforms: [],
      };
    });

    try {
      await upsertDiscoverMovies(movies);
    } catch (dbError) {
      console.error('[Discover API] Supabase upsert failed:', dbError);
    }

    const TMDB_MAX_PAGES = 500;
    const rawTotalPages = discoverRes.total_pages ?? 1;

    return Response.json({
      success: true,
      year: yearNum,
      page: parseInt(page, 10),
      total_pages: Math.min(rawTotalPages, TMDB_MAX_PAGES),
      total_results: discoverRes.total_results ?? 0,
      movies,
    });
  } catch (error) {
    console.error('[Discover API] Unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
