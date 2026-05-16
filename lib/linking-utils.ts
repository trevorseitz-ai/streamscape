import * as Linking from 'expo-linking';
import type { StreamingOption } from './streaming-rapid';

/**
 * TMDB-compatible `provider_id` values used in `stream_finder_providers` /
 * Discover availability. Aliases: HBO Max (**384**) → Max (**1899**); alternate Max (**24**) → **1899**.
 *
 * Title-specific paths come from RapidAPI **`StreamingOption.videoLink`** /
 * **`link`** and from **`providerContentId`** when present. **`launchStreamingApp`**
 * tries those first, then provider-specific watch URL templates, then storefront home.
 */

export type StreamingProviderLaunchSpec = {
  /** TMDB-style watch-provider id (“provider_id”). */
  tmdbProviderId: number;
  /** Human label for docs / tooling. */
  label: string;
  /**
   * Primary Android **`applicationId`** (living-room / TV / OEM-trusted names where applicable).
   * See **`androidPackageFallbacks`** for secondary intents if the primary is not installed.
   */
  androidPackageName: string;
  /** Tried after the primary when **`IntentLauncher`** throws (typically mobile storefront id). */
  androidPackageFallbacks?: readonly string[];
  /**
   * OEM TV **`Intent`** extras (**Sony / Netflix Ninja **`source`**, …) merged into explicit **`ACTION_VIEW`**.
   */
  androidLaunchExtras?: Record<string, string>;
};

/** Rows mirror the QA “16-provider” Stream Finder milestone — confirm against `GET /api/providers` / Supabase after each sync. */
export const STREAMING_PROVIDER_ANDROID_MATRIX: StreamingProviderLaunchSpec[] = [
  {
    tmdbProviderId: 8,
    label: 'Netflix',
    androidPackageName: 'com.netflix.ninja',
    androidPackageFallbacks: ['com.netflix.mediaclient'],
    /** Netflix Ninja: **`source`** lands directly on the title from **`nflx://`** VIEW. */
    androidLaunchExtras: { source: '30' },
  },
  { tmdbProviderId: 9, label: 'Amazon Prime Video', androidPackageName: 'com.amazon.amazonvideo.livingroom' },
  {
    tmdbProviderId: 15,
    label: 'Hulu',
    androidPackageName: 'com.hulu.livingroomplus',
    androidPackageFallbacks: ['com.hulu.livingroom'],
  },
  { tmdbProviderId: 337, label: 'Disney Plus', androidPackageName: 'com.disney.disneyplus' },
  { tmdbProviderId: 1899, label: 'Max', androidPackageName: 'com.wbd.stream' },
  { tmdbProviderId: 531, label: 'Paramount Plus', androidPackageName: 'com.cbs.ott' },
  { tmdbProviderId: 386, label: 'Peacock Premium', androidPackageName: 'com.peacocktv.peacockandroid' },
  {
    tmdbProviderId: 350,
    label: 'Apple TV Plus',
    androidPackageName: 'com.apple.atve.sony.appletv',
    androidPackageFallbacks: ['com.apple.atve.sony.trusted'],
  },
  { tmdbProviderId: 283, label: 'Crunchyroll', androidPackageName: 'com.crunchyroll.crunchyroid' },
  { tmdbProviderId: 526, label: 'AMC Plus', androidPackageName: 'com.amcup.android' },
  { tmdbProviderId: 99, label: 'Shudder', androidPackageName: 'com.shudder.android' },
  { tmdbProviderId: 358, label: 'Criterion Channel', androidPackageName: 'com.criterionchannel' },
  { tmdbProviderId: 11, label: 'MUBI', androidPackageName: 'com.mubi' },
  { tmdbProviderId: 613, label: 'MGM Plus', androidPackageName: 'com.epix.epix.now' },
  { tmdbProviderId: 520, label: 'Discovery Plus', androidPackageName: 'com.discovery.discoveryplus.mobile' },
  { tmdbProviderId: 1794, label: 'FuboTV', androidPackageName: 'com.fubo.android' },
  { tmdbProviderId: 33, label: 'Tubi', androidPackageName: 'com.tubitv' },
];

/** Legacy storefront ids normalized via **`PROVIDER_ALIASES`** (**384** HBO Max → **1899**; **24** → **1899** Max). */

const PROVIDER_ALIASES: Record<number, number> = {
  384: 1899,
  24: 1899,
};

type ProviderRegistryEntry = {
  pkg: string;
  /** Prefer custom TV schemes first; HTTPS fall back to storefront home / browse surfaces. */
  urls: readonly string[];
};

function buildRegistry(): Record<number, ProviderRegistryEntry> {
  const out: Record<number, ProviderRegistryEntry> = {};

  const add = (id: number, pkg: string, urls: readonly string[]) => {
    out[id] = { pkg, urls };
  };

  add(8, 'com.netflix.ninja', ['nflx://www.netflix.com/browse', 'https://www.netflix.com/browse']);
  add(9, 'com.amazon.amazonvideo.livingroom', [
    'https://app.primevideo.com/',
    'https://www.primevideo.com/',
  ]);
  add(15, 'com.hulu.livingroomplus', ['https://www.hulu.com/hub/home']);
  add(337, 'com.disney.disneyplus', ['https://www.disneyplus.com/home']);
  add(1899, 'com.wbd.stream', ['https://www.max.com/', 'hbomax://deeplink/home']);
  add(531, 'com.cbs.ott', ['https://www.paramountplus.com/']);
  add(386, 'com.peacocktv.peacockandroid', ['https://www.peacocktv.com/']);
  add(350, 'com.apple.atve.sony.appletv', ['https://tv.apple.com/']);
  add(283, 'com.crunchyroll.crunchyroid', ['https://www.crunchyroll.com/']);
  add(526, 'com.amcup.android', ['https://www.amcplus.com/']);
  add(99, 'com.shudder.android', ['https://www.shudder.com/']);
  add(358, 'com.criterionchannel', ['https://www.criterionchannel.com/']);
  add(11, 'com.mubi', ['https://mubi.com/']);
  add(613, 'com.epix.epix.now', ['https://www.mgmplus.com/']);
  add(520, 'com.discovery.discoveryplus.mobile', ['https://www.discoveryplus.com/']);
  add(1794, 'com.fubo.android', ['https://www.fubo.tv/']);
  add(33, 'com.tubitv', ['https://tubitv.com/']);

  return out;
}

const REGISTRY = buildRegistry();

function normalizeNumericProviderId(raw: string): number | null {
  const n = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return PROVIDER_ALIASES[n] ?? n;
}

const SERVICE_NAME_TO_TMDB_PROVIDER: { needle: string; id: number }[] = [
  { needle: 'netflix', id: 8 },
  { needle: 'amazon prime', id: 9 },
  { needle: 'prime video', id: 9 },
  { needle: 'hulu', id: 15 },
  { needle: 'disney+', id: 337 },
  { needle: 'disney plus', id: 337 },
  { needle: 'hbo max', id: 1899 },
  { needle: 'paramount+', id: 531 },
  { needle: 'paramount plus', id: 531 },
  { needle: 'peacock', id: 386 },
  { needle: 'apple tv', id: 350 },
  { needle: 'crunchyroll', id: 283 },
  { needle: 'amc+', id: 526 },
  { needle: 'amc plus', id: 526 },
  { needle: 'shudder', id: 99 },
  { needle: 'criterion', id: 358 },
  { needle: 'mubi', id: 11 },
  { needle: 'mgm+', id: 613 },
  { needle: 'mgm plus', id: 613 },
  { needle: 'epix', id: 613 },
  { needle: 'discovery+', id: 520 },
  { needle: 'discovery plus', id: 520 },
  { needle: 'fubo', id: 1794 },
  { needle: 'tubi', id: 33 },
];

/**
 * Maps a RapidAPI streaming row to a TMDB **`provider_id`** string for **`launchStreamingApp`**.
 * Uses numeric **`service.id`** when it parses as a positive integer; otherwise fuzzy-matches **`serviceName`**.
 */
export function resolveTmdbProviderIdForStreamingOption(
  option: StreamingOption
): string | null {
  const sid = Number.parseInt(String(option.serviceId).trim(), 10);
  if (Number.isFinite(sid) && sid > 0) {
    return String(PROVIDER_ALIASES[sid] ?? sid);
  }
  const hay = option.serviceName.trim().toLowerCase();
  if (hay === '') return null;
  for (const { needle, id } of SERVICE_NAME_TO_TMDB_PROVIDER) {
    if (hay.includes(needle)) {
      return String(id);
    }
  }
  if (hay === 'max') {
    return '1899';
  }
  return null;
}

/**
 * Deduped package list for TV intents: matrix primary first, then **`androidPackageFallbacks`**.
 */
export function getAndroidTvPackageCandidatesForTmdbProviderId(providerIdStr: string): string[] {
  const pid = normalizeNumericProviderId(providerIdStr);
  if (pid == null) return [];
  const row = STREAMING_PROVIDER_ANDROID_MATRIX.find((r) => r.tmdbProviderId === pid);
  if (row) {
    const out: string[] = [row.androidPackageName, ...(row.androidPackageFallbacks ?? [])];
    return [...new Set(out.filter((s) => s && s.trim() !== ''))];
  }
  const reg = REGISTRY[pid];
  return reg?.pkg ? [reg.pkg] : [];
}

/**
 * Canonical Android **`packageName`** for explicit TV intents (**primary** matrix entry).
 */
export function getAndroidTvPackageForTmdbProviderId(providerIdStr: string): string | null {
  const list = getAndroidTvPackageCandidatesForTmdbProviderId(providerIdStr);
  return list.length > 0 ? list[0] : null;
}

/**
 * OEM **`Intent`** extras from **`STREAMING_PROVIDER_ANDROID_MATRIX`** (e.g. Netflix Ninja **`source`**).
 */
export function getAndroidTvLaunchExtrasForTmdbProviderId(
  providerIdStr: string
): Record<string, string> | undefined {
  const pid = normalizeNumericProviderId(providerIdStr);
  if (pid == null) return undefined;
  const row = STREAMING_PROVIDER_ANDROID_MATRIX.find((r) => r.tmdbProviderId === pid);
  const x = row?.androidLaunchExtras;
  if (x == null || Object.keys(x).length === 0) return undefined;
  return { ...x };
}

/** Netflix catalog id digits from `/watch/` or `/title/` paths. */
const NETFLIX_ID_RE = /\/(?:watch|title)\/(\d+)/;

function parseMaxWatchPathId(pathname: string): string | null {
  const norm = pathname.replace(/\/$/, '') || '/';
  let m = norm.match(/\/video\/watch\/([^/?]+)/i);
  if (m?.[1]) return decodeURIComponent(m[1]);
  m = norm.match(/^\/movies\/([^/]+)/i);
  if (m?.[1]) return decodeURIComponent(m[1]);
  m = norm.match(/\/watch\/([^/?]+)/i);
  if (m?.[1]) return decodeURIComponent(m[1]);
  return null;
}

function sanitizeNetflixCatalogId(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  return d.length > 0 ? d : null;
}

function sanitizeMaxCatalogSegment(raw: string): string | null {
  const t = raw.trim();
  if (t === '') return null;
  return /^[a-zA-Z0-9-]+$/.test(t) ? t : null;
}

/** Tubi **`/movies/{id}`** segment (numeric or opaque slug). */
function sanitizeTubiMovieId(raw: string): string | null {
  const t = raw.trim();
  if (t === '' || t.length > 128) return null;
  return /^[a-zA-Z0-9_-]+$/.test(t) ? t : null;
}

function extractTubiMovieIdFromPath(pathname: string): string | null {
  const norm = pathname.replace(/\/$/, '') || '/';
  const m = norm.match(/^\/movies\/([^/?#]+)/i);
  if (!m?.[1]) return null;
  return sanitizeTubiMovieId(decodeURIComponent(m[1]));
}

/** Verified Prime Video ASIN: **10 chars**, **`B`** + nine alphanumerics. */
const PRIME_VIDEO_ASIN_STRICT_RE = /^B[A-Z0-9]{9}$/i;

/** Prime Video GTI: opaque catalog token (often **`amzn1.dv.gti…`**), never an ASIN. */
const PRIME_GTI_MIN_LEN = 11;

/** Research-backed ASIN probe on **`videoLink`** / **`link`** only when **`providerContentId`** is not a strict ASIN. */
const PRIME_ASIN_FROM_LINKS_RE = /\b(B[A-Z0-9]{9})\b/i;

function isStrictPrimeVideoAsin(raw: string): boolean {
  return PRIME_VIDEO_ASIN_STRICT_RE.test(raw.trim());
}

function normalizeStrictPrimeAsin(raw: string): string {
  return raw.trim().toUpperCase();
}

function isLikelyPrimeVideoGti(raw: string): boolean {
  const t = raw.trim();
  if (t === '') return false;
  if (isStrictPrimeVideoAsin(t.toUpperCase())) return false;
  if (t.length < PRIME_GTI_MIN_LEN) return false;
  return /^[A-Za-z0-9._-]+$/.test(t);
}

function extractAmazonAsinFromHaystack(href: string): string | null {
  const trimmed = href.trim();
  if (trimmed === '') return null;
  try {
    const u = new URL(trimmed);
    const qp = u.searchParams.get('asin');
    if (qp && isStrictPrimeVideoAsin(qp)) return normalizeStrictPrimeAsin(qp);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 'amazon.com') {
      const parts = u.pathname.replace(/\/$/, '').split('/').filter(Boolean);
      if (parts.length === 1 && isStrictPrimeVideoAsin(parts[0])) {
        return normalizeStrictPrimeAsin(parts[0]);
      }
      if (
        parts.length === 2 &&
        parts[0].toLowerCase() === 'dp' &&
        isStrictPrimeVideoAsin(parts[1])
      ) {
        return normalizeStrictPrimeAsin(parts[1]);
      }
    }
  } catch {
    /* fragment or non-URL */
  }
  const pathAsin = trimmed.match(
    /[/](?:gp[/]video[/]detail|detail|dp)[/]([A-Z0-9]{10})(?:[/\?#]|$)/i
  );
  if (pathAsin?.[1]) {
    const up = pathAsin[1].toUpperCase();
    if (isStrictPrimeVideoAsin(up)) return up;
  }
  const bAsin = trimmed.match(PRIME_ASIN_FROM_LINKS_RE);
  if (bAsin?.[1]) return normalizeStrictPrimeAsin(bAsin[1]);
  return null;
}

function extractPrimeGtiFromHaystack(href: string): string | null {
  const trimmed = href.trim();
  if (trimmed === '') return null;
  try {
    const u = new URL(trimmed);
    const qp = u.searchParams.get('gti');
    if (qp) {
      const dec = decodeURIComponent(qp.trim());
      if (isLikelyPrimeVideoGti(dec)) return dec;
    }
  } catch {
    /* fragment or non-URL */
  }
  const m = trimmed.match(/[?&]gti=([^&#]+)/i);
  if (m?.[1]) {
    const dec = decodeURIComponent(m[1].trim());
    if (isLikelyPrimeVideoGti(dec)) return dec;
  }
  return null;
}

function extractPrimeGtiFromOption(option: StreamingOption): string | null {
  if (typeof option.providerContentId === 'string') {
    const t = option.providerContentId.trim();
    if (isLikelyPrimeVideoGti(t)) return t;
  }
  const urls = [option.videoLink, option.link].filter(
    (u): u is string => typeof u === 'string' && u.trim() !== ''
  );
  for (const raw of urls) {
    const g = extractPrimeGtiFromHaystack(raw.trim());
    if (g) return g;
  }
  return null;
}

/**
 * Prime ASIN: strict **`B?????????`** on **`providerContentId`** only; otherwise **`/\b(B[A-Z0-9]{9})\b/i`** on **`videoLink`** / **`link`**.
 */
function extractAmazonAsinFromOption(option: StreamingOption): string | null {
  if (typeof option.providerContentId === 'string') {
    const t = option.providerContentId.trim().toUpperCase();
    if (isStrictPrimeVideoAsin(t)) return normalizeStrictPrimeAsin(t);
  }
  const linkHaystacks: string[] = [];
  if (typeof option.videoLink === 'string' && option.videoLink.trim() !== '') {
    linkHaystacks.push(option.videoLink.trim());
  }
  if (typeof option.link === 'string' && option.link.trim() !== '') {
    linkHaystacks.push(option.link.trim());
  }
  for (const h of linkHaystacks) {
    const found = extractAmazonAsinFromHaystack(h);
    if (found) return found;
  }
  return null;
}

/** Apple TV storefront id: **`umc.cmc.…`** (must match catalogs / deep links — not opaque numeric ids). */
const APPLE_UMC_ID_RE = /\b(umc\.cmc\.[a-z0-9]+)\b/i;

function normalizeAppleUmcSegment(id: string): string {
  return id.trim().toLowerCase();
}

/** Prefer **`movie`**, **`show`**, or **`episode`** path segment from storefront URLs (`tv.apple.com/...`). */
function inferAppleTvPathKind(option: StreamingOption): 'movie' | 'show' | 'episode' {
  for (const raw of [option.videoLink, option.link].filter(
    (u): u is string => typeof u === 'string' && u.trim() !== ''
  )) {
    const href = raw.trim().toLowerCase();
    try {
      const p = new URL(href).pathname;
      const m = p.match(/\/(movie|show|episode)\//);
      const k = m?.[1];
      if (k === 'show' || k === 'episode' || k === 'movie') return k;
    } catch {
      /* non-absolute URL fragments */
    }
    if (href.includes('/show/')) return 'show';
    if (href.includes('/episode/')) return 'episode';
  }
  return 'movie';
}

function extractAppleTvUmcFromString(raw: string): string | null {
  const m = raw.match(APPLE_UMC_ID_RE);
  return m?.[1] ? normalizeAppleUmcSegment(m[1]) : null;
}

function extractAppleTvUmcIdFromOption(option: StreamingOption): string | null {
  if (typeof option.providerContentId === 'string') {
    const fromField = extractAppleTvUmcFromString(option.providerContentId);
    if (fromField) return fromField;
  }
  const urls = [option.videoLink, option.link].filter(
    (u): u is string => typeof u === 'string' && u.trim() !== ''
  );
  for (const raw of urls) {
    try {
      const u = new URL(raw.trim());
      if (u.hostname.toLowerCase().includes('tv.apple.com')) {
        const fromPath = extractAppleTvUmcFromString(u.pathname);
        if (fromPath) return fromPath;
      }
    } catch {
      /* plain string / relative */
    }
    const fromHaystack = extractAppleTvUmcFromString(raw);
    if (fromHaystack) return fromHaystack;
  }
  return null;
}

/**
 * Resolves service-native storefront id from API fields and/or **`videoLink`** / **`link`** paths.
 */
export function deriveProviderContentIdForStreamingOption(
  pid: number,
  option: StreamingOption
): string | null {
  if (typeof option.providerContentId === 'string') {
    const t = option.providerContentId.trim();
    if (t !== '') {
      if (pid === 8) {
        const n = sanitizeNetflixCatalogId(t);
        if (n) return n;
      }
      const forMax = sanitizeMaxCatalogSegment(t);
      if (pid === 1899 && forMax) return forMax;
      if (pid === 9) {
        const u = t.trim();
        const up = u.toUpperCase();
        if (isStrictPrimeVideoAsin(up)) return normalizeStrictPrimeAsin(u);
        if (isLikelyPrimeVideoGti(u)) return u;
      }
      if (pid === 350) {
        const umc = extractAppleTvUmcFromString(t);
        if (umc) return umc;
      }
      if (pid === 33) {
        const tid = sanitizeTubiMovieId(t);
        if (tid) return tid;
      }
      if (pid !== 8 && pid !== 1899 && pid !== 9 && pid !== 350 && pid !== 33) return t;
    }
  }

  const urls = [
    ...(option.videoLink ? [option.videoLink] : []),
    option.link,
  ].filter((u): u is string => typeof u === 'string' && u.trim() !== '');

  for (const href of urls) {
    try {
      const parsed = new URL(href.trim());
      const host = parsed.hostname.toLowerCase();
      const path = parsed.pathname.replace(/\/$/, '') || '/';

      if (host.includes('netflix.com')) {
        const m = path.match(NETFLIX_ID_RE);
        if (m?.[1]) return m[1];
      }

      if (
        host.includes('play.max.com') ||
        host.includes('max.com') ||
        host.endsWith('hbomax.com')
      ) {
        const id = parseMaxWatchPathId(path);
        if (id) return id;
      }

      if (host.includes('tv.apple.com')) {
        const fromPath = extractAppleTvUmcFromString(path + parsed.search + parsed.hash);
        if (fromPath) return fromPath;
      }

      if (host.includes('tubitv.com')) {
        const tubiId = extractTubiMovieIdFromPath(path);
        if (tubiId) return tubiId;
      }

      if (
        pid === 9 &&
        (host.includes('primevideo.com') ||
          host.includes('amazon.') ||
          host.endsWith('amazon.com'))
      ) {
        const asin = extractAmazonAsinFromHaystack(href.trim());
        if (asin) return asin;
        const gti = extractPrimeGtiFromHaystack(href.trim());
        if (gti) return gti;
      }
    } catch {
      /* malformed URL — skip */
    }
  }

  return null;
}

/** No VIEW **`data`** — handoff uses **`MAIN`/`LAUNCHER`** only (Sony-safe “front door”). */
export const TV_HANDOFF_MAIN_LAUNCH_MARKER = '__REELDIVE_TV_MAIN_LAUNCH__';

/** @deprecated Use **`TV_HANDOFF_MAIN_LAUNCH_MARKER`**. */
export const TV_HANDOFF_JUST_LAUNCH_URI = TV_HANDOFF_MAIN_LAUNCH_MARKER;

function pushDedup(bucket: string[], seen: Set<string>, url: string) {
  const t = url.trim();
  if (t === '' || seen.has(t)) return;
  seen.add(t);
  bucket.push(t);
}

/**
 * Normalizes titles for **`nflx://`** / HTTPS storefront search (**ASCII letters/digits**, spaces, **`'`**, **`-`**).
 */
export function sanitizeMediaTitleForStorefrontSearch(title: string | undefined): string | null {
  if (title == null) return null;
  const t = title
    .normalize('NFKC')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t !== '' ? t : null;
}

/** Tubi web search path (**`/search/{title}`**) after direct **`/movies/{id}`** fails on TV. */
export function buildTubiHttpsSearchUrlFromMediaTitle(title: string | undefined): string | null {
  const q = sanitizeMediaTitleForStorefrontSearch(title);
  if (q == null) return null;
  return `https://tubitv.com/search/${encodeURIComponent(q)}`;
}

function appendTvJustLaunchCandidate(bucket: string[], seen: Set<string>): void {
  pushDedup(bucket, seen, TV_HANDOFF_MAIN_LAUNCH_MARKER);
}

function appendPrimeInstantVideoSearchCandidate(
  bucket: string[],
  seen: Set<string>,
  mediaTitle: string | undefined
): void {
  const q = sanitizeMediaTitleForStorefrontSearch(mediaTitle);
  if (q == null) return;
  pushDedup(bucket, seen, `https://www.amazon.com/s?k=${encodeURIComponent(q)}&i=instant-video`);
}

function appendNetflixSearchCandidate(
  bucket: string[],
  seen: Set<string>,
  mediaTitle: string | undefined
): void {
  const q = sanitizeMediaTitleForStorefrontSearch(mediaTitle);
  if (q == null) return;
  pushDedup(bucket, seen, `nflx://www.netflix.com/search?q=${encodeURIComponent(q)}`);
}

/** Optional context for storefront search fallbacks (**Netflix**, **Prime**). */
export type CollectStreamingLaunchOptions = {
  mediaTitle?: string;
};

/**
 * Attempt B / implicit resolver: Netflix **`nflx://`**; Prime **`https://`** only (**Sony-safe**, no **`amzn://`**).
 */
export function toTvImplicitLaunchUri(
  providerIdStr: string,
  uri: string,
  option: StreamingOption
): string {
  const pid = normalizeNumericProviderId(providerIdStr);
  const u = uri.trim();
  if (u === '') return u;

  if (u === TV_HANDOFF_MAIN_LAUNCH_MARKER || u === TV_HANDOFF_JUST_LAUNCH_URI) return u;

  if (pid === 8) {
    if (u.startsWith('nflx://')) return u;
    try {
      const parsed = new URL(u);
      if (parsed.hostname.toLowerCase().includes('netflix.com')) {
        const path = parsed.pathname.replace(/\/$/, '') || '/';
        const m = path.match(NETFLIX_ID_RE);
        if (m?.[1]) {
          return `nflx://www.netflix.com/watch/${encodeURIComponent(m[1])}`;
        }
      }
    } catch {
      /* keep raw */
    }
    return u;
  }

  if (pid === 9) {
    if (u.includes('amazon.com/gp/video/detail/')) return u;
    if (u.includes('app.primevideo.com/detail')) return u;
    try {
      const parsed = new URL(u);
      const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
      if (host === 'amazon.com') {
        const parts = parsed.pathname.replace(/\/$/, '').split('/').filter(Boolean);
        if (parts.length === 1 && isStrictPrimeVideoAsin(parts[0])) return u;
        if (
          parts.length === 2 &&
          parts[0].toLowerCase() === 'dp' &&
          isStrictPrimeVideoAsin(parts[1])
        ) {
          return u;
        }
      }
    } catch {
      /* keep parsing below */
    }
    const fromUriAsin = extractAmazonAsinFromHaystack(u);
    const asin = fromUriAsin ?? extractAmazonAsinFromOption(option);
    if (asin != null) {
      return `https://amazon.com/${encodeURIComponent(asin)}`;
    }
    const gtiFromUri = extractPrimeGtiFromHaystack(u);
    const gti = gtiFromUri ?? extractPrimeGtiFromOption(option);
    if (gti != null) {
      return `https://app.primevideo.com/detail?gti=${encodeURIComponent(gti)}`;
    }
    return u;
  }

  return u;
}

/**
 * Preferred launch URIs for **`providerId`** (TMDB) and RapidAPI **`option`**.
 *
 * **Netflix:** **`TV_HANDOFF_MAIN_LAUNCH_MARKER`** first (**front-door reliability**), then **`nflx://…/watch`**, search, HTTPS watch, links (**marker** is **`MAIN`** only — no VIEW **`data`**).
 * **Prime (ASIN):** **`https://amazon.com/[ASIN]`** → **`https://amazon.com/dp/[ASIN]`** → **`https://www.amazon.com/gp/video/detail/[ASIN]`**; GTI → **`app.primevideo.com/detail?gti=`** (**no **`amzn://`**).
 * **Max (1899; alias **24**):** **`https://play.max.com/video/watch/[ID]`** first (**`com.wbd.stream`**), then API links / registry.
 * **Tubi (33):** **`https://tubitv.com/movies/[ID]`**, links, **`https://tubitv.com/`** home.
 * **Apple TV:** **`https://tv.apple.com/{kind}/…`** first (**Sony web-wrapper**), then **`apple-tv://`**.
 */
export function collectStreamingLaunchCandidates(
  providerId: string,
  option: StreamingOption,
  launchOpts?: CollectStreamingLaunchOptions
): string[] {
  const pid = normalizeNumericProviderId(providerId);
  const entry = pid != null ? REGISTRY[pid] : undefined;
  const storefrontId =
    pid != null ? deriveProviderContentIdForStreamingOption(pid, option) : null;

  const ordered: string[] = [];
  const seen = new Set<string>();

  if (pid === 8) {
    appendTvJustLaunchCandidate(ordered, seen);
    if (storefrontId != null && storefrontId !== '') {
      pushDedup(
        ordered,
        seen,
        `nflx://www.netflix.com/watch/${encodeURIComponent(storefrontId)}`
      );
    }
    appendNetflixSearchCandidate(ordered, seen, launchOpts?.mediaTitle);
    if (storefrontId != null && storefrontId !== '') {
      pushDedup(
        ordered,
        seen,
        `https://www.netflix.com/watch/${encodeURIComponent(storefrontId)}`
      );
    }
    if (option.videoLink) pushDedup(ordered, seen, option.videoLink);
    if (option.link) pushDedup(ordered, seen, option.link);
    if (entry) {
      for (const u of entry.urls) pushDedup(ordered, seen, u);
    }
    return ordered;
  }

  if (pid === 9) {
    const asin = extractAmazonAsinFromOption(option);
    const gti = extractPrimeGtiFromOption(option);

    if (asin != null) {
      const enc = encodeURIComponent(asin);
      pushDedup(ordered, seen, `https://amazon.com/${enc}`);
      pushDedup(ordered, seen, `https://amazon.com/dp/${enc}`);
      pushDedup(ordered, seen, `https://www.amazon.com/gp/video/detail/${enc}`);
    }
    if (gti != null) {
      pushDedup(
        ordered,
        seen,
        `https://app.primevideo.com/detail?gti=${encodeURIComponent(gti)}`
      );
    }
    if (option.videoLink) pushDedup(ordered, seen, option.videoLink);
    if (option.link) pushDedup(ordered, seen, option.link);
    appendPrimeInstantVideoSearchCandidate(ordered, seen, launchOpts?.mediaTitle);
    if (entry) {
      for (const u of entry.urls) pushDedup(ordered, seen, u);
    }
    return ordered;
  }

  if (pid === 350) {
    const umc = extractAppleTvUmcIdFromOption(option);
    if (umc != null) {
      const kind = inferAppleTvPathKind(option);
      pushDedup(ordered, seen, `https://tv.apple.com/${kind}/${umc}`);
      pushDedup(ordered, seen, `apple-tv://${kind}/${encodeURIComponent(umc)}`);
    }
    if (option.videoLink) pushDedup(ordered, seen, option.videoLink);
    if (option.link) pushDedup(ordered, seen, option.link);
    if (entry) {
      for (const u of entry.urls) pushDedup(ordered, seen, u);
    }
    return ordered;
  }

  if (pid === 1899) {
    if (storefrontId != null && storefrontId !== '') {
      pushDedup(
        ordered,
        seen,
        `https://play.max.com/video/watch/${encodeURIComponent(storefrontId)}`
      );
    }
    if (option.videoLink) pushDedup(ordered, seen, option.videoLink);
    if (option.link) pushDedup(ordered, seen, option.link);
    if (entry) {
      for (const u of entry.urls) pushDedup(ordered, seen, u);
    }
    return ordered;
  }

  if (pid === 33) {
    if (storefrontId != null && storefrontId !== '') {
      pushDedup(
        ordered,
        seen,
        `https://tubitv.com/movies/${encodeURIComponent(storefrontId)}`
      );
    }
    if (option.videoLink) pushDedup(ordered, seen, option.videoLink);
    if (option.link) pushDedup(ordered, seen, option.link);
    if (entry) {
      for (const u of entry.urls) pushDedup(ordered, seen, u);
    }
    pushDedup(ordered, seen, 'https://tubitv.com/');
    return ordered;
  }

  if (option.videoLink) pushDedup(ordered, seen, option.videoLink);
  if (option.link) pushDedup(ordered, seen, option.link);

  if (entry) {
    for (const u of entry.urls) {
      pushDedup(ordered, seen, u);
    }
  }

  return ordered;
}

/**
 * First candidate from **`collectStreamingLaunchCandidates`** (typically API **`videoLink`** when present).
 */
export function resolveStreamingLaunchUrl(
  providerId: string,
  option: StreamingOption,
  launchOpts?: CollectStreamingLaunchOptions
): string | null {
  const list = collectStreamingLaunchCandidates(providerId, option, launchOpts);
  return list.length > 0 ? list[0] : null;
}

/**
 * Tries **`collectStreamingLaunchCandidates`** in order with **`Linking.openURL`** until one succeeds.
 */
export async function launchStreamingApp(
  providerId: string,
  option: StreamingOption,
  launchOpts?: CollectStreamingLaunchOptions
): Promise<boolean> {
  const pid = normalizeNumericProviderId(providerId);
  const entry = pid != null ? REGISTRY[pid] : undefined;
  if (!entry || pid == null) return false;

  const candidates = collectStreamingLaunchCandidates(providerId, option, launchOpts);

  for (const url of candidates) {
    if (url === TV_HANDOFF_MAIN_LAUNCH_MARKER || url === TV_HANDOFF_JUST_LAUNCH_URI) continue;
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      /* chain */
    }
  }

  if (__DEV__) {
    console.warn('[linking-utils] launchStreamingApp: no URLs opened for provider', pid, entry.pkg);
  }
  return false;
}
