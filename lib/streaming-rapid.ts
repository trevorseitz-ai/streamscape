/** Shared RapidAPI Streaming Availability fetch (no React Native). Used by client and Vercel /api. */

export const RAPIDAPI_HOST = 'streaming-availability.p.rapidapi.com';

/** RapidAPI app keys are a single token (~50 chars). Strip quotes/whitespace and accidental header prefixes from .env pastes. */
export function normalizeRapidApiKey(raw: string | undefined): string {
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

const devLog =
  typeof __DEV__ !== 'undefined' && __DEV__
    ? (...args: unknown[]) => console.log(...args)
    : () => {};

const devWarn =
  typeof __DEV__ !== 'undefined' && __DEV__
    ? (...args: unknown[]) => console.warn(...args)
    : () => {};

/** Calls RapidAPI Streaming Availability (server or client). */
export async function fetchLiveStreamingOptions(
  numericId: number,
  pathType: 'movie' | 'show',
  countryParam: string,
  apiKey: string
): Promise<StreamingOption[]> {
  try {
    const safeCountry = (countryParam || 'us').toLowerCase();
    const path = `https://${RAPIDAPI_HOST}/shows/${pathType}/${numericId}`;
    const url = `${path}?country=${encodeURIComponent(safeCountry)}&output_language=en`;

    devLog('[streaming] full RapidAPI URL (before fetch):', url);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
    });

    const status = res.status;
    devLog('[streaming] response.status', status);

    let data: Record<string, unknown>;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      devWarn('[streaming] RapidAPI response was not valid JSON');
      return [];
    }

    devLog('[streaming] RAPIDAPI RAW DATA (truncated):', JSON.stringify(data).slice(0, 2000));

    if (!res.ok) {
      const msg = typeof data.message === 'string' ? data.message : '';
      if (status === 403) {
        devWarn(
          '[streaming] RapidAPI 403 — "not subscribed" usually means: (1) open rapidapi.com → Streaming Availability API → Subscribe on the same account as your key, or (2) EXPO_PUBLIC_RAPIDAPI_KEY is not the default application key from that account (no extra quotes/spaces; restart with npx expo start -c).',
          { url, message: msg }
        );
      } else if (status === 429) {
        devWarn(
          '[streaming] RapidAPI 429 — rate limited. Wait and avoid duplicate requests (e.g. double useEffect).',
          { url, message: msg }
        );
      } else {
        devWarn('[streaming] RapidAPI non-OK status', { status, url, message: msg });
      }
      return [];
    }

    const countryOpts = extractRapidApiProviderList(data, safeCountry);

    devLog('[streaming] extracted provider rows', {
      country: safeCountry,
      extractedLength: countryOpts.length,
    });

    const out: StreamingOption[] = [];
    for (const item of countryOpts) {
      const mapped = mapLiveStreamingItem(item);
      if (mapped) out.push(mapped);
    }
    return out;
  } catch (err) {
    devWarn('[streaming] fetchLiveStreamingOptions error:', err);
    return [];
  }
}
