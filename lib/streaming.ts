// BYPASS (temporary): Supabase cache disabled — uncomment to restore.
// import { supabase } from './supabase';

import { Platform } from 'react-native';
import {
  type StreamingOption,
  RAPIDAPI_HOST,
  normalizeRapidApiKey,
  fetchLiveStreamingOptions,
} from './streaming-rapid';

/**
 * Only for local debugging when env does not load. Must stay empty in git — use EXPO_PUBLIC_RAPIDAPI_KEY in .env.
 */
const RAPIDAPI_KEY_DEBUG_OVERRIDE = '';

export type { StreamingOption };

/**
 * Strips `movie/` or `show/` prefixes, keeps digits only, returns a positive TMDB id or null.
 */
export function normalizeTmdbIdForStreaming(id: unknown): number | null {
  if (id == null || id === '') return null;
  let s = String(id).trim();
  if (s === '') return null;
  s = s.replace(/^movie\//i, '').replace(/^show\//i, '');
  const digitsOnly = s.replace(/\D/g, '');
  if (digitsOnly === '') return null;
  const n = Number(digitsOnly);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Stored in `streaming_cache.platforms` for new rows (country-aware). */
type CachedPlatformsPayload = {
  country: string;
  options: StreamingOption[];
};

function isCacheFresh(updatedAt: string | null | undefined): boolean {
  if (updatedAt == null || updatedAt === '') return false;
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < CACHE_TTL_MS;
}

function validateStreamingOptionsArray(raw: unknown): StreamingOption[] | null {
  if (!Array.isArray(raw)) return null;
  const out: StreamingOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.link !== 'string') continue;
    out.push({
      serviceId: typeof o.serviceId === 'string' ? o.serviceId : String(o.serviceId ?? ''),
      serviceName: typeof o.serviceName === 'string' ? o.serviceName : '',
      link: o.link,
      type: typeof o.type === 'string' ? o.type : '',
    });
  }
  return out;
}

/** Supabase may return `platforms` as a JSON string instead of parsed object. */
function parsePlatformsColumn(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  return raw;
}

/**
 * Reads cached `platforms` jsonb: supports `{ country, options }` or legacy flat `StreamingOption[]` (treated as `us` only).
 */
function parseCachedPlatforms(
  platforms: unknown,
  countryParam: string
): StreamingOption[] | null {
  if (platforms != null && typeof platforms === 'object' && !Array.isArray(platforms)) {
    const p = platforms as Record<string, unknown>;
    if (
      typeof p.country === 'string' &&
      p.country.toLowerCase() === countryParam &&
      Array.isArray(p.options)
    ) {
      return validateStreamingOptionsArray(p.options);
    }
  }
  if (Array.isArray(platforms) && countryParam === 'us') {
    return validateStreamingOptionsArray(platforms);
  }
  return null;
}

/** Production web (e.g. Vercel): same-origin /api/streaming avoids CORS and uses server env. Local Expo web has no root /api → returns null and we fall back to direct RapidAPI. */
async function tryFetchStreamingViaDeployProxy(
  tmdbId: number,
  pathType: 'movie' | 'show',
  countryParam: string
): Promise<StreamingOption[] | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const u = new URL('/api/streaming', window.location.origin);
    u.searchParams.set('tmdbId', String(tmdbId));
    u.searchParams.set('type', pathType);
    u.searchParams.set('country', countryParam);
    const res = await fetch(u.toString(), { method: 'GET' });
    if (!res.ok) return null;
    const data = (await res.json()) as { options?: StreamingOption[] };
    return Array.isArray(data.options) ? data.options : null;
  } catch {
    return null;
  }
}

export async function getDirectStreamingLinks(
  id: unknown,
  type: string = 'movie',
  country: string = 'us'
): Promise<StreamingOption[]> {
  const tmdbId = normalizeTmdbIdForStreaming(id);
  const pathType: 'movie' | 'show' = type === 'show' ? 'show' : 'movie';
  const countryParam = country.toLowerCase();
  const requestUrlPreview =
    tmdbId != null
      ? `https://${RAPIDAPI_HOST}/shows/${pathType}/${tmdbId}?country=${encodeURIComponent(countryParam)}&output_language=en`
      : '(invalid id)';

  if (__DEV__) {
    console.log('[streaming] getDirectStreamingLinks', {
      inputId: id,
      normalizedTmdbId: tmdbId,
      pathType,
      country: countryParam,
      requestUrlPreview,
    });
  }

  if (tmdbId == null) {
    console.warn('[streaming] getDirectStreamingLinks: no valid TMDB id after normalize');
    return [];
  }

  /*
   * CACHE READ DISABLED — do not restore without removing live-fetch-only debugging.
   * No cached data may be returned; always hit RapidAPI below.
   *
   * try {
   *   const { data: row, error } = await supabase
   *     .from('streaming_cache')
   *     .select('platforms, updated_at')
   *     .eq('tmdb_id', tmdbId)
   *     .eq('item_type', pathType)
   *     .maybeSingle();
   *
   *   if (!error && row && isCacheFresh(row.updated_at as string)) {
   *     const platformData = parsePlatformsColumn(row.platforms);
   *     const cached = parseCachedPlatforms(platformData, countryParam);
   *     if (cached !== null) {
   *       return cached;
   *     }
   *   }
   * } catch {
   *   // Cache unavailable; continue to live fetch
   * }
   */

  const proxied = await tryFetchStreamingViaDeployProxy(tmdbId, pathType, countryParam);
  if (proxied !== null) {
    if (__DEV__) {
      console.log('[streaming] getDirectStreamingLinks via /api/streaming proxy:', proxied.length);
    }
    return proxied;
  }

  const apiKey =
    normalizeRapidApiKey(RAPIDAPI_KEY_DEBUG_OVERRIDE) ||
    normalizeRapidApiKey(process.env.EXPO_PUBLIC_RAPIDAPI_KEY) ||
    '';

  if (normalizeRapidApiKey(RAPIDAPI_KEY_DEBUG_OVERRIDE) && __DEV__) {
    console.warn(
      '[streaming] Using RAPIDAPI_KEY_DEBUG_OVERRIDE in lib/streaming.ts — clear it after testing'
    );
  }

  if (!apiKey) {
    if (__DEV__) {
      console.warn(
        '[streaming] No RapidAPI key: set EXPO_PUBLIC_RAPIDAPI_KEY in .env or RAPIDAPI_KEY_DEBUG_OVERRIDE for a local test. Restart Expo (npx expo start -c). On Vercel, set RAPIDAPI_KEY or EXPO_PUBLIC_RAPIDAPI_KEY for /api/streaming.'
      );
    }
    return [];
  }

  if (__DEV__) {
    const rawLen = process.env.EXPO_PUBLIC_RAPIDAPI_KEY?.length ?? 0;
    console.log(
      '[streaming] RapidAPI key source:',
      normalizeRapidApiKey(RAPIDAPI_KEY_DEBUG_OVERRIDE) ? 'DEBUG_OVERRIDE' : 'EXPO_PUBLIC_RAPIDAPI_KEY',
      {
        keyLengthAfterNormalize: apiKey.length,
        rawEnvLength: rawLen,
      }
    );
    if (
      !normalizeRapidApiKey(RAPIDAPI_KEY_DEBUG_OVERRIDE) &&
      apiKey.length > 0 &&
      (apiKey.length < 45 || apiKey.length > 55)
    ) {
      console.warn(
        '[streaming] RapidAPI application keys are typically ~50 characters. If requests fail, remove quotes/line breaks from EXPO_PUBLIC_RAPIDAPI_KEY in .env and paste only the key from rapidapi.com → Apps → default application key.'
      );
    }
  }

  try {
    const out = await fetchLiveStreamingOptions(
      tmdbId,
      pathType,
      countryParam,
      apiKey
    );

    if (__DEV__) {
      console.log('[streaming] getDirectStreamingLinks result count:', out.length);
    }

    /*
     * CACHE WRITE DISABLED — see cache read block above.
     *
     * const payload: CachedPlatformsPayload = {
     *   country: countryParam,
     *   options: out,
     * };
     * try {
     *   const { error: upsertError } = await supabase.from('streaming_cache').upsert(
     *     {
     *       tmdb_id: tmdbId,
     *       item_type: pathType,
     *       platforms: payload as unknown as Record<string, unknown>,
     *       updated_at: new Date().toISOString(),
     *     },
     *     { onConflict: 'tmdb_id' }
     *   );
     *   if (upsertError && __DEV__) {
     *     console.warn('[streaming] cache upsert failed:', upsertError.message);
     *   }
     * } catch (e) {
     *   if (__DEV__) {
     *     console.warn('[streaming] cache upsert failed:', e);
     *   }
     * }
     */

    return out;
  } catch (err) {
    console.warn('[streaming] getDirectStreamingLinks error:', err);
    return [];
  }
}

export default getDirectStreamingLinks;
