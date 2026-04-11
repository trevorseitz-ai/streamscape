/**
 * OMDb-based ratings (IMDb, Rotten Tomatoes, Metacritic).
 * Set EXPO_PUBLIC_OMDB_API_KEY in the environment when ready.
 */

const OMDB_BASE = 'https://www.omdbapi.com/';

/** Parsed score triple from OMDb (strings match API / display use). */
export interface OmdbScores {
  imdbRating: string | null;
  rottenTomatoes: string | null;
  metascore: string | null;
}

/**
 * Normalizes input to OMDb `i=` form (`tt` + digits). Accepts `tt1234567` or numeric strings.
 */
export function normalizeImdbId(id: unknown): string | null {
  if (id == null || id === '') return null;
  let s = String(id).trim();
  if (s === '') return null;
  const lower = s.toLowerCase();
  if (lower.startsWith('tt')) {
    const rest = s.slice(2).replace(/\D/g, '');
    if (rest === '') return null;
    return `tt${rest}`;
  }
  const digits = s.replace(/\D/g, '');
  if (digits === '') return null;
  return `tt${digits}`;
}

function parseRatingsArray(
  ratings: unknown
): { rottenTomatoes: string | null } {
  if (!Array.isArray(ratings)) return { rottenTomatoes: null };
  for (const item of ratings) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const source = typeof r.Source === 'string' ? r.Source : '';
    const value = typeof r.Value === 'string' ? r.Value : null;
    if (source === 'Rotten Tomatoes' && value) {
      return { rottenTomatoes: value };
    }
  }
  return { rottenTomatoes: null };
}

async function fetchOmdbJson(imdbId: string, apiKey: string): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({ i: imdbId, apikey: apiKey });
  const url = `${OMDB_BASE}?${params.toString()}`;
  const res = await fetch(url);
  const raw = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    if (__DEV__) {
      console.warn('[ratings] OMDb response was not JSON');
    }
    return null;
  }

  if (data.Response === 'False') {
    if (__DEV__) {
      console.warn('[ratings] OMDb error:', data.Error);
    }
    return null;
  }
  return data;
}

/**
 * Fetches IMDb, Rotten Tomatoes, and Metacritic scores from OMDb using an IMDb title id.
 * Returns null fields when the key is missing, the id is invalid, or the API omits a score.
 */
export async function getOmdbScores(imdbId: unknown): Promise<OmdbScores> {
  const empty: OmdbScores = {
    imdbRating: null,
    rottenTomatoes: null,
    metascore: null,
  };

  const id = normalizeImdbId(imdbId);
  const apiKey = process.env.EXPO_PUBLIC_OMDB_API_KEY?.trim() ?? '';
  if (!id || !apiKey) {
    return empty;
  }

  try {
    const data = await fetchOmdbJson(id, apiKey);
    if (!data) return empty;

    const imdbRating =
      typeof data.imdbRating === 'string' && data.imdbRating.trim() !== ''
        ? data.imdbRating.trim()
        : null;

    const metascoreRaw = data.Metascore;
    const metascore =
      typeof metascoreRaw === 'string' && metascoreRaw.trim() !== ''
        ? metascoreRaw.trim()
        : null;

    const { rottenTomatoes } = parseRatingsArray(data.Ratings);

    return {
      imdbRating,
      rottenTomatoes,
      metascore,
    };
  } catch (e) {
    if (__DEV__) {
      console.warn('[ratings] OMDb fetch failed:', e);
    }
    return empty;
  }
}

export default getOmdbScores;
