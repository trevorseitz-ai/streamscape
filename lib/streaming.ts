// BYPASS (temporary): Supabase cache disabled — uncomment to restore.
// import { supabase } from './supabase';

/**
 * Only for local debugging when env does not load. Must stay empty in git — use EXPO_PUBLIC_RAPIDAPI_KEY in .env.
 */
const RAPIDAPI_KEY_DEBUG_OVERRIDE = '';

const RAPIDAPI_HOST = 'streaming-availability.p.rapidapi.com';

/** RapidAPI app keys are a single token (~50 chars). Strip quotes/whitespace and accidental header prefixes from .env pastes. */
function normalizeRapidApiKey(raw: string | undefined): string {
  if (raw == null || raw === '') return '';
  let s = String(raw).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/^x-rapidapi-key\s*:\s*/i, '').trim();
  return s.replace(/\s+/g, '');
}

export interface StreamingOption {
  serviceId: string;
  serviceName: string;
  link: string;
  type: string;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Stored in `streaming_cache.platforms` for new rows (country-aware). */
type CachedPlatformsPayload = {
  country: string;
  options: StreamingOption[];
};

/** RapidAPI: options under `streamingOptions[country]` with nested `service`. */
function mapLiveStreamingItem(raw: unknown): StreamingOption | null {
  if (!raw || typeof raw !== 'object') return null;
  const opt = raw as Record<string, unknown>;
  const link = opt.link ?? opt.videoLink;
  if (typeof link !== 'string') return null;
  const type = typeof opt.type === 'string' ? opt.type : '';
  const service = opt.service;
  let serviceId = 'unknown';
  let serviceName = 'Unknown Service';
  if (service && typeof service === 'object') {
    const s = service as Record<string, unknown>;
    serviceId = s.id != null ? String(s.id) : 'unknown';
    serviceName =
      typeof s.name === 'string' && s.name ? s.name : 'Unknown Service';
  }
  return { link, type, serviceId, serviceName };
}

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

/** v4-style paths: streamingOptions[cc] | result.streamingOptions[cc] | data[cc] */
function extractRapidApiProviderList(
  data: Record<string, unknown>,
  countryCode: string
): unknown[] {
  const c = (countryCode || 'us').toLowerCase();

  const streamingOptions = data.streamingOptions;
  const fromStreaming =
    streamingOptions &&
    typeof streamingOptions === 'object' &&
    !Array.isArray(streamingOptions)
      ? (streamingOptions as Record<string, unknown>)[c]
      : undefined;

  const result = data.result;
  const nestedSo =
    result &&
    typeof result === 'object' &&
    !Array.isArray(result)
      ? (result as Record<string, unknown>).streamingOptions
      : undefined;
  const fromResult =
    nestedSo &&
    typeof nestedSo === 'object' &&
    !Array.isArray(nestedSo)
      ? (nestedSo as Record<string, unknown>)[c]
      : undefined;

  const fromRoot = data[c];

  const raw =
    (Array.isArray(fromStreaming) ? fromStreaming : null) ??
    (Array.isArray(fromResult) ? fromResult : null) ??
    (Array.isArray(fromRoot) ? fromRoot : null) ??
    [];

  return Array.isArray(raw) ? raw : [];
}

async function fetchLiveStreamingOptions(
  numericId: number,
  pathType: 'movie' | 'show',
  countryParam: string,
  apiKey: string
): Promise<StreamingOption[]> {
  try {
    const safeCountry = (countryParam || 'us').toLowerCase();
    const path = `https://${RAPIDAPI_HOST}/shows/${pathType}/${numericId}`;
    const url = `${path}?country=${encodeURIComponent(safeCountry)}&output_language=en`;

    if (__DEV__) {
      console.log('[streaming] full RapidAPI URL (before fetch):', url);
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
    });

    const status = res.status;
    if (__DEV__) {
      console.log('[streaming] response.status', status);
    }

    let data: Record<string, unknown>;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      console.warn('[streaming] RapidAPI response was not valid JSON');
      return [];
    }

    if (__DEV__) {
      console.log('[streaming] RAPIDAPI RAW DATA (truncated):', JSON.stringify(data).slice(0, 2000));
    }

    if (!res.ok) {
      const msg = typeof data.message === 'string' ? data.message : '';
      if (status === 403) {
        console.warn(
          '[streaming] RapidAPI 403 — "not subscribed" usually means: (1) open rapidapi.com → Streaming Availability API → Subscribe on the same account as your key, or (2) EXPO_PUBLIC_RAPIDAPI_KEY is not the default application key from that account (no extra quotes/spaces; restart with npx expo start -c).',
          { url, message: msg }
        );
      } else if (status === 429) {
        console.warn(
          '[streaming] RapidAPI 429 — rate limited. Wait and avoid duplicate requests (e.g. double useEffect).',
          { url, message: msg }
        );
      } else {
        console.warn('[streaming] RapidAPI non-OK status', { status, url, message: msg });
      }
      return [];
    }

    const countryOpts = extractRapidApiProviderList(data, safeCountry);

    if (__DEV__) {
      console.log('[streaming] extracted provider rows', {
        country: safeCountry,
        extractedLength: countryOpts.length,
      });
    }

    const out: StreamingOption[] = [];
    for (const item of countryOpts) {
      const mapped = mapLiveStreamingItem(item);
      if (mapped) out.push(mapped);
    }
    return out;
  } catch (err) {
    console.warn('[streaming] fetchLiveStreamingOptions error:', err);
    return [];
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
        '[streaming] No RapidAPI key: set EXPO_PUBLIC_RAPIDAPI_KEY in .env or RAPIDAPI_KEY_DEBUG_OVERRIDE for a local test. Restart Expo (npx expo start -c).'
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
