/**
 * RapidAPI "Film & Show" (Film & Show ratings / hub) — top list fetch for Discover prefetch.
 * Maps arbitrary JSON rows into the same shape as `DiscoverResult` in `app/(tabs)/discover.tsx`.
 */

export type FilmShowDiscoverMovie = {
  id: string;
  title: string;
  poster_url: string | null;
  backdrop_url: string | null;
  release_year: number | null;
  vote_average: number | null;
  platforms: Array<{ name: string; access_type: string; logo_path?: string | null }>;
  /** RapidAPI `ids.TMDB` — used for TMDB image enrichment (not for list source). */
  tmdb_id: number | null;
  /** Stream Finder: canonical row (sorted by name); use for UI that needs ids + URLs. */
  providers?: Array<{ id: number; name: string; logo_url: string }>;
  /** Stream Finder cached provider logos → passed through to Discover / MovieCard. */
  provider_logo_urls?: string[];
};

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_W500 = 'https://image.tmdb.org/t/p/w500';

/** Default path for Film & Show ratings "Top 100 items" (GET). Override via env if your subscription uses another route. */
const DEFAULT_TOP_PATH =
  process.env.EXPO_PUBLIC_RAPIDAPI_FILMSHOW_TOP_PATH?.trim() || '/top-100-items';

function extractItems(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    for (const k of ['data', 'results', 'items', 'movies', 'content', 'top', 'result']) {
      const v = o[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

function normalizeImageUrl(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('/')) return `${TMDB_IMAGE_W500}${t}`;
  return t;
}

function pickFirstImageUrl(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    const u = normalizeImageUrl(c);
    if (u) return u;
  }
  return null;
}

function normalizeVoteAverage(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? parseFloat(raw.replace(/,/g, ''))
        : NaN;
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 10) return Math.round(n * 10) / 10;
  // 0–100 style scores → 0–10
  if (n > 10 && n <= 100) return Math.round((n / 10) * 10) / 10;
  return null;
}

function pickYear(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 1800 && v <= 2100) {
      return Math.floor(v);
    }
    if (typeof v === 'string' && /^\d{4}/.test(v.trim())) {
      const y = parseInt(v.trim().slice(0, 4), 10);
      if (Number.isFinite(y) && y >= 1800 && y <= 2100) return y;
    }
  }
  return null;
}

function readIdsTmdb(item: Record<string, unknown>): number | null {
  const ids = item.ids;
  if (!ids || typeof ids !== 'object') return null;
  const o = ids as Record<string, unknown>;
  const v = o.TMDB ?? o.tmdb;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return null;
}

/** IMDb audience rating, else TMDB audience rating (RapidAPI Film & Show nested shape). */
function readFilmShowAudienceRating(item: Record<string, unknown>): unknown {
  const ratings = item.ratings;
  if (!ratings || typeof ratings !== 'object') return undefined;
  const rt = ratings as Record<string, unknown>;

  const tryProvider = (block: unknown): unknown => {
    if (!block || typeof block !== 'object') return undefined;
    const aud = (block as Record<string, unknown>).audience;
    if (!aud || typeof aud !== 'object') return undefined;
    return (aud as Record<string, unknown>).rating;
  };

  const imdb = tryProvider(rt.IMDb ?? rt.imdb);
  if (imdb != null) return imdb;
  return tryProvider(rt.TMDB ?? rt.tmdb);
}

function toTmdbW500Url(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string' || !path.startsWith('/')) return null;
  return `${TMDB_IMAGE_W500}${path}`;
}

/** Map one RapidAPI Film & Show row → list row (`ids.TMDB` preserved for enrichment). */
export function mapFilmShowRowToDiscoverResult(row: unknown, index: number): FilmShowDiscoverMovie | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;

  const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : '';
  if (!title) return null;

  const tmdb_id = readIdsTmdb(item);
  const id = tmdb_id != null ? String(tmdb_id) : `film-show-${index}`;

  const release_year = pickYear(item.year);

  const vote_raw = readFilmShowAudienceRating(item);
  const vote_average = normalizeVoteAverage(vote_raw);

  const posterFallback = pickFirstImageUrl(
    item.poster_url,
    item.poster_path,
    item.poster,
    item.image
  );
  const backdropFallback = pickFirstImageUrl(item.backdrop_url, item.backdrop_path, item.backdrop);

  return {
    id,
    title,
    poster_url: posterFallback ?? backdropFallback ?? null,
    backdrop_url: backdropFallback ?? null,
    release_year,
    vote_average,
    platforms: [],
    tmdb_id,
  };
}

export function mapFilmShowPayloadToDiscoverResults(payload: unknown): FilmShowDiscoverMovie[] {
  const items = extractItems(payload);
  const out: FilmShowDiscoverMovie[] = [];
  items.forEach((row, index) => {
    const mapped = mapFilmShowRowToDiscoverResult(row, index);
    if (mapped) out.push(mapped);
  });
  return out;
}

/** GET top/trending list from Film & Show RapidAPI hub; expects JSON array or wrapped array. */
export async function fetchFilmShowTopTrendingDiscoverMovies(
  rapidApiKey: string,
  rapidApiHost: string
): Promise<FilmShowDiscoverMovie[]> {
  const host = rapidApiHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const path =
    DEFAULT_TOP_PATH.startsWith('/') ? DEFAULT_TOP_PATH : `/${DEFAULT_TOP_PATH}`;
  const url = `https://${host}${path}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': rapidApiKey,
      'X-RapidAPI-Host': host,
    },
  });

  if (!res.ok) {
    throw new Error(`RapidAPI Film and Show error: ${res.status}`);
  }

  const json: unknown = await res.json();
  return mapFilmShowPayloadToDiscoverResults(json);
}

/**
 * Fetches TMDB poster/backdrop for the first 20 rows (per-id detail) to fill missing RapidAPI images.
 * List source remains RapidAPI; TMDB is metadata-only per project rules.
 */
export async function enrichWithTmdbImages(
  mappedMovies: FilmShowDiscoverMovie[]
): Promise<FilmShowDiscoverMovie[]> {
  const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
  const slice = mappedMovies.slice(0, 20);
  const rest = mappedMovies.slice(20);

  if (!apiKey || slice.length === 0) {
    return [...mappedMovies];
  }

  const enrichedSlice = await Promise.all(
    slice.map(async (m): Promise<FilmShowDiscoverMovie> => {
      if (m.tmdb_id == null) return m;

      try {
        const url = `${TMDB_API_BASE}/movie/${m.tmdb_id}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) return m;

        const data = (await res.json()) as {
          poster_path?: string | null;
          backdrop_path?: string | null;
        };

        const poster_from_tmdb = toTmdbW500Url(data.poster_path ?? null);
        const backdrop_from_tmdb = toTmdbW500Url(data.backdrop_path ?? null);

        return {
          ...m,
          poster_url: poster_from_tmdb ?? m.poster_url,
          backdrop_url: backdrop_from_tmdb ?? m.backdrop_url,
        };
      } catch {
        return m;
      }
    })
  );

  return [...enrichedSlice, ...rest];
}
