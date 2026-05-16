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
  /** RapidAPI `videoLink` — direct playback URL (`/watch/...`), prefer over storefront `link` when opening. */
  videoLink?: string;
  /**
   * Service-native catalog id when the API exposes one (sparse).
   * Otherwise derived in `lib/linking-utils` from **`link`** / **`videoLink`** paths.
   */
  providerContentId?: string;
}

/** One row per service: same provider often appears multiple times (rent / buy / add-on). First wins. */
export function dedupeStreamingOptionsByServiceFirst(
  options: StreamingOption[]
): StreamingOption[] {
  const seen = new Set<string>();
  const result: StreamingOption[] = [];
  for (const opt of options) {
    const key =
      opt.serviceId && opt.serviceId !== 'unknown'
        ? `id:${opt.serviceId}`
        : `name:${opt.serviceName.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(opt);
  }
  return result;
}

/** RapidAPI: options under `streamingOptions[country]` with nested `service`. */
function stringifyApiId(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'string') {
    const t = raw.trim();
    return t !== '' ? t : undefined;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(Math.trunc(raw));
  }
  return undefined;
}

/** Strict Prime Video playback ASIN (**`B`** + nine alphanumerics). Matches **`linking-utils`** HTTPS detail URLs. */
const PRIME_CATALOG_ASIN_STRICT_RE = /^B[A-Z0-9]{9}$/i;

/** True when **`s`** is a strict Prime catalog ASIN (**`B…`**, 10 chars). */
function isPrimeCatalogAsinStrict(s: string): boolean {
  return PRIME_CATALOG_ASIN_STRICT_RE.test(s.trim());
}

/** ASIN segments on **`amazon`** / **`primevideo`** storefront links — strict **`B…`** catalog ids only. */
function extractPrimeVideoAsinFromUrls(...candidates: string[]): string | undefined {
  for (const raw of candidates) {
    if (typeof raw !== 'string' || raw.trim() === '') continue;
    const href = raw.trim();
    try {
      const u = new URL(href);
      const qp = u.searchParams.get('asin');
      if (qp && isPrimeCatalogAsinStrict(qp)) return qp.trim().toUpperCase();
    } catch {
      /* fragment-only or malformed */
    }
    const pathAsin = href.match(
      /[/](?:gp[/]video[/]detail|detail|dp)[/]([A-Z0-9]{10})(?:[/\?#]|$)/i
    );
    if (pathAsin?.[1] && isPrimeCatalogAsinStrict(pathAsin[1])) return pathAsin[1].toUpperCase();
    const bAsin = href.match(/\b(B[A-Z0-9]{9})\b/i);
    if (bAsin?.[1]) return bAsin[1].toUpperCase();
  }
  return undefined;
}

function isPrimeLikeStreamingService(serviceName: string, serviceId: string): boolean {
  const n = serviceName.trim().toLowerCase();
  const id = serviceId.trim().toLowerCase();
  return (
    id === 'prime' ||
    id === 'amazon' ||
    id.includes('prime') ||
    n.includes('prime video') ||
    n.includes('amazon prime')
  );
}

function mapLiveStreamingItem(raw: unknown): StreamingOption | null {
  if (!raw || typeof raw !== 'object') return null;
  const opt = raw as Record<string, unknown>;
  const apiLink =
    typeof opt.link === 'string' && opt.link.trim() !== '' ? opt.link.trim() : '';
  const apiVideoLink =
    typeof opt.videoLink === 'string' && opt.videoLink.trim() !== ''
      ? opt.videoLink.trim()
      : '';
  /** Row must expose at least one playable / storefront URI. */
  const link =
    apiLink !== '' ? apiLink : apiVideoLink !== '' ? apiVideoLink : '';
  if (link === '') return null;
  const videoLink =
    apiVideoLink !== '' && apiVideoLink !== apiLink ? apiVideoLink : undefined;
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
  let providerContentId =
    stringifyApiId(opt.catalogId) ??
    stringifyApiId(opt.catalogueId) ??
    stringifyApiId(opt.videoId);

  if (isPrimeLikeStreamingService(serviceName, serviceId)) {
    const fromUrl = extractPrimeVideoAsinFromUrls(apiLink, apiVideoLink);
    const trimmed = providerContentId?.trim();
    if (trimmed && isPrimeCatalogAsinStrict(trimmed)) {
      providerContentId = trimmed.toUpperCase();
    } else if (fromUrl) {
      providerContentId = fromUrl;
    }
  }

  const out: StreamingOption = { link, type, serviceId, serviceName };
  if (videoLink) out.videoLink = videoLink;
  if (providerContentId) out.providerContentId = providerContentId;
  return out;
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

function pickNonEmptyString(o: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string') {
      const t = v.trim();
      if (t !== '') return t;
    }
  }
  return undefined;
}

function parseYearFromUnknown(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const y = Math.trunc(raw);
    if (y >= 1870 && y <= 2100) return y;
    return undefined;
  }
  if (typeof raw === 'string') {
    const m = raw.trim().match(/^(\d{4})/);
    if (m) {
      const y = Number.parseInt(m[1], 10);
      if (y >= 1870 && y <= 2100) return y;
    }
  }
  return undefined;
}

/**
 * Pulls human-readable title + optional release year from Streaming Availability JSON
 * so the Prime ASIN hunter can query Amazon **`instant-video`** search.
 */
function extractShowTitleYearFromRapidApiData(
  data: Record<string, unknown>,
  pathType: 'movie' | 'show'
): { title: string; year?: number } | null {
  const layers: Record<string, unknown>[] = [data];
  const result = data.result;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    layers.push(result as Record<string, unknown>);
  }

  const titleKeys =
    pathType === 'show'
      ? ['name', 'title', 'originalName', 'originalTitle']
      : ['title', 'name', 'originalTitle', 'originalName'];

  let title: string | undefined;
  for (const layer of layers) {
    title = pickNonEmptyString(layer, titleKeys);
    if (title) break;
  }
  if (title == null) return null;

  let year: number | undefined;
  const yearKeys = ['year', 'releaseYear', 'firstAirYear'];
  for (const layer of layers) {
    for (const k of yearKeys) {
      year = parseYearFromUnknown(layer[k]);
      if (year != null) break;
    }
    if (year != null) break;
    year =
      parseYearFromUnknown(layer.releaseDate) ??
      parseYearFromUnknown(layer.firstAirDate);
    if (year != null) break;
  }

  return year != null ? { title, year } : { title };
}

function buildAmazonInstantVideoSearchUrl(title: string, releaseYear?: number): string {
  const t = title.trim();
  const keywords =
    releaseYear != null && releaseYear >= 1870 && releaseYear <= 2100 ? `${t} ${releaseYear}` : t;
  const urlParam = encodeURIComponent('search-alias=instant-video');
  return `https://www.amazon.com/s?url=${urlParam}&field-keywords=${encodeURIComponent(keywords)}`;
}

/** Prefer **`data-asin`** (search tiles), then **`/gp/video/detail/`** / **`/dp/`**, then first **`B…`** token. */
function extractFirstPrimeAsinFromAmazonSearchHtml(html: string): string | null {
  const dataAsinRe = /\bdata-asin\s*=\s*["'](B[A-Z0-9]{9})["']/gi;
  let m: RegExpExecArray | null;
  while ((m = dataAsinRe.exec(html)) !== null) {
    const asin = m[1].toUpperCase();
    if (isPrimeCatalogAsinStrict(asin)) return asin;
  }
  const dpRe = /\/(?:gp\/video\/detail|dp)\/(B[A-Z0-9]{9})\b/gi;
  const dm = dpRe.exec(html);
  if (dm?.[1] && isPrimeCatalogAsinStrict(dm[1])) return dm[1].toUpperCase();
  const loose = html.match(/\b(B[A-Z0-9]{9})\b/i);
  if (loose?.[1] && isPrimeCatalogAsinStrict(loose[1])) return loose[1].toUpperCase();
  return null;
}

const AMAZON_ASIN_HUNT_TIMEOUT_MS = 14000;

async function fetchPrimeAsinViaAmazonInstantVideoSearch(
  title: string,
  releaseYear?: number
): Promise<string | undefined> {
  const qTitle = title.trim();
  if (qTitle === '') return undefined;
  const url = buildAmazonInstantVideoSearchUrl(qTitle, releaseYear);
  devLog('[streaming] Prime ASIN hunter URL:', url);

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), AMAZON_ASIN_HUNT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) {
      devWarn('[streaming] Prime ASIN hunter non-OK:', res.status);
      return undefined;
    }
    const html = await res.text();
    const asin = extractFirstPrimeAsinFromAmazonSearchHtml(html);
    if (asin != null) {
      devLog('[streaming] Prime ASIN hunter extracted:', asin);
    }
    return asin ?? undefined;
  } catch (e) {
    devWarn('[streaming] Prime ASIN hunter fetch failed:', e);
    return undefined;
  } finally {
    clearTimeout(tid);
  }
}

function primeOptionNeedsAsinHunt(opt: StreamingOption): boolean {
  const id = opt.providerContentId?.trim();
  if (id == null || id === '') return true;
  return !isPrimeCatalogAsinStrict(id);
}

async function hydratePrimeProviderContentIdFromAmazonSearch(
  options: StreamingOption[],
  data: Record<string, unknown>,
  pathType: 'movie' | 'show'
): Promise<void> {
  const meta = extractShowTitleYearFromRapidApiData(data, pathType);
  if (meta == null) return;

  const target = options.find(
    (o) =>
      isPrimeLikeStreamingService(o.serviceName, o.serviceId) && primeOptionNeedsAsinHunt(o)
  );
  if (target == null) return;

  const asin = await fetchPrimeAsinViaAmazonInstantVideoSearch(meta.title, meta.year);
  if (asin != null) {
    target.providerContentId = asin;
  }
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
    const deduped = dedupeStreamingOptionsByServiceFirst(out);
    await hydratePrimeProviderContentIdFromAmazonSearch(deduped, data, pathType);
    return deduped;
  } catch (err) {
    devWarn('[streaming] fetchLiveStreamingOptions error:', err);
    return [];
  }
}
