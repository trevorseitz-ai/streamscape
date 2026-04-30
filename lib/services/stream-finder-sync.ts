/**
 * Server / CI only: pull Stream Finder API → Supabase clean sync.
 * Requires STREAM_FINDER_KEY and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Run: `npm run sync:stream-finder` from project root (.env loaded).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Same base as authoritative `/api/providers` ingest (logo_path stores full TMDB URLs at w92 where possible). */
export const TMDB_PROVIDER_LOGO_IMAGE_BASE = 'https://image.tmdb.org/t/p/w92';

/** Stored when the API omits `logo_path`; client maps this to a generic icon URL. */
export const GENERIC_PROVIDER_LOGO_SENTINEL = '__generic_stream__';

const STREAM_FINDER_URL =
  process.env.STREAM_FINDER_MOVIES_URL?.trim() ||
  'https://stream-finder--trevorseitzai.replit.app/api/movies';

/** Authoritative Stream Finder catalog (not overridden by env). */
const OFFICIAL_STREAM_FINDER_PROVIDERS_URL =
  'https://stream-finder--trevorseitzai.replit.app/api/providers';

const CHUNK = 80;

export type ParsedStreamMovie = {
  tmdb_id: number;
  title: string;
  popularity: number | null;
  overview: string | null;
  poster_path: string | null;
  providers: ParsedProvider[];
};

export type ParsedProvider = {
  provider_id: number;
  name: string;
  /** Full TMDB w92 logo URL, TMDB-relative path, or `GENERIC_PROVIDER_LOGO_SENTINEL` when unknown. */
  logo_path: string;
};

export type ParsedAvailability = {
  movie_id: number;
  provider_id: number;
};

export function extractMovies(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    for (const k of ['movies', 'data', 'results', 'items', 'content']) {
      const v = o[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

function maybeRecord(v: unknown): Record<string, unknown> | undefined {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return parseFloat(v);
  return null;
}

/**
 * Turn API logo values into a normalized relative TMDB fragment or full URL fallback;
 * returns sentinel when nothing usable is present.
 */
function normalizeProviderLogoPath(raw: unknown): string {
  if (raw == null) return GENERIC_PROVIDER_LOGO_SENTINEL;
  if (typeof raw !== 'string') return GENERIC_PROVIDER_LOGO_SENTINEL;
  let t = raw.trim();
  if (!t.length) return GENERIC_PROVIDER_LOGO_SENTINEL;
  const q = t.indexOf('?');
  if (q >= 0) t = t.slice(0, q).trim();
  if (!t.length) return GENERIC_PROVIDER_LOGO_SENTINEL;
  if (t.includes('image.tmdb.org')) {
    const idx = t.toLowerCase().indexOf('/t/p/');
    if (idx >= 0) {
      const after = t.slice(idx + '/t/p/'.length);
      const slash = after.indexOf('/');
      const pathRest = slash >= 0 ? after.slice(slash) : '';
      if (pathRest.length > 1) t = pathRest;
    }
  }
  return t.startsWith('http') ? t : (t.startsWith('/') ? t : `/${t}`);
}

/**
 * `/api/providers` shape: normalize path then persist as canonical w92 TMDB URL (per Stream Finder catalog contract).
 */
function officialCatalogLogoToStoredLogoPath(logoPath: unknown): string {
  const normalized = normalizeProviderLogoPath(logoPath);
  if (normalized === GENERIC_PROVIDER_LOGO_SENTINEL) return GENERIC_PROVIDER_LOGO_SENTINEL;
  if (normalized.startsWith('http')) return normalized;
  const base = TMDB_PROVIDER_LOGO_IMAGE_BASE.replace(/\/?$/, '');
  const pathPart = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${base}${pathPart}`;
}

/** Root array keys for standalone GET `/api/providers` JSON wrappers (includes nested wrappers). */
const STANDALONE_PROVIDER_ARRAY_KEYS = [
  'providers',
  'master_providers',
  'data',
  'results',
  'items',
  'catalog_providers',
  'streaming_services',
  'all_providers',
  'catalog',
] as const;

function appendInnerProviderArrays(bucket: Record<string, unknown>, out: unknown[][]): void {
  for (const key of STANDALONE_PROVIDER_ARRAY_KEYS) {
    const raw = bucket[key];
    if (Array.isArray(raw)) out.push(raw);
  }
}

function extractProviderArrayRoots(blob: unknown): unknown[][] {
  if (blob == null) return [];
  if (Array.isArray(blob)) return [blob];
  if (typeof blob !== 'object') return [];
  const o = blob as Record<string, unknown>;
  const out: unknown[][] = [];
  appendInnerProviderArrays(o, out);
  for (const v of Object.values(o)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    appendInnerProviderArrays(v as Record<string, unknown>, out);
  }
  return out;
}

function catalogRowLooksLikeProvider(o: Record<string, unknown>): boolean {
  return (
    typeof o.name === 'string' ||
    typeof o.displayName === 'string' ||
    typeof o.providerName === 'string' ||
    typeof o.provider_name === 'string' ||
    o.logoPath !== undefined ||
    o.logo_path !== undefined ||
    o.logo !== undefined ||
    typeof o.movieCount === 'number' ||
    o.display_priority !== undefined
  );
}

/**
 * Strict mapping from official `/api/providers` rows: providerId → provider_id, name, logoPath → w92 TMDB logo URL.
 * Omits **no** row for missing logos or zero movie counts (sentinel logo is stored instead).
 */
function parseOfficialCatalogRow(o: Record<string, unknown>): ParsedProvider | null {
  const explicit = num(o.providerId ?? o.provider_id);
  const inferredFromId = num(catalogRowLooksLikeProvider(o) ? o.id : undefined);
  const id = explicit ?? inferredFromId;
  if (id == null || id <= 0) return null;
  const tid = Math.trunc(id);
  const nameRaw =
    (typeof o.name === 'string' && o.name.trim()) ||
    (typeof o.displayName === 'string' && o.displayName.trim()) ||
    (typeof o.providerName === 'string' && o.providerName.trim()) ||
    (typeof o.provider_name === 'string' && o.provider_name.trim()) ||
    '';
  const name = (nameRaw.length ? nameRaw : `Provider ${tid}`).slice(0, 320);
  const logo_path = officialCatalogLogoToStoredLogoPath(o.logoPath ?? o.logo_path ?? o.logo);
  return { provider_id: tid, name, logo_path };
}

/** Parse authoritative catalog JSON → provider rows (dedup last-wins by `provider_id`). */
export function parseOfficialProvidersCatalog(json: unknown): ParsedProvider[] {
  const buckets = extractProviderArrayRoots(json);
  const map = new Map<number, ParsedProvider>();
  for (const bucket of buckets) {
    for (const item of bucket) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const parsed = parseOfficialCatalogRow(row);
      if (parsed) map.set(parsed.provider_id, parsed);
    }
  }
  return [...map.values()];
}

export function parseOneProviderObject(o: Record<string, unknown>): ParsedProvider | null {
  const provNested = maybeRecord(o.provider);
  /**
   * Accept TMDB-style watch-provider rows (`provider_name`, `display_priority`) and any row with
   * explicit logo fields — do **not** require `logoPath` (sentinel is fine).
   */
  const looksLikeProviderRow =
    o.provider_id != null ||
    o.providerId != null ||
    provNested !== undefined ||
    o.logo_path != null ||
    o.logoPath != null ||
    o.logo_uri != null ||
    o.logoUri != null ||
    o.logo != null ||
    o.logoUrl != null ||
    o.tm != null ||
    typeof o.provider_name === 'string' ||
    typeof o.providerName === 'string' ||
    o.display_priority !== undefined;
  const id =
    num(
      o.provider_id ??
      o.providerId ??
      o.tm ??
      provNested?.provider_id ??
      provNested?.providerId ??
      (looksLikeProviderRow ? provNested?.id : undefined) ??
      (looksLikeProviderRow ? o.id : undefined)
    );
  if (id == null || id <= 0) return null;
  const tid = Math.trunc(id);
  const name =
    typeof o.name === 'string' && o.name.trim()
      ? o.name.trim()
      : `Provider ${tid}`;
  const lp =
    o.logo_path ??
    o.logoPath ??
    o.logo_uri ??
    o.logoUri ??
    o.logo ??
    o.logoUrl ??
    o.image ??
    o.icon ??
    o.avatar;
  const logo_path = normalizeProviderLogoPath(lp);
  return { provider_id: tid, name: name.slice(0, 320), logo_path };
}

function readProviders(row: Record<string, unknown>): ParsedProvider[] {
  const flat = row.flatrate ?? row.flatRate;
  const raw =
    row.providers ??
    row.watch_providers ??
    row.watchProviders ??
    row.streaming_providers ??
    row.streamingProviders ??
    row.watch_providers_flatrate ??
    flat;
  if (!Array.isArray(raw)) return [];
  const out: ParsedProvider[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const parsed = parseOneProviderObject(p as Record<string, unknown>);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function normalizeStreamFinderMovie(
  row: unknown,
  index: number
): ParsedStreamMovie | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  const ids = maybeRecord(o.ids);
  /** Prefer TMDB-specific keys; fallback to generic `id` last (many APIs misuse it). */
  const tmdbRaw =
    o.tmdb_id ??
    o.tmdbId ??
    ids?.tmdb_id ??
    ids?.tmdbId ??
    ids?.TMDB ??
    ids?.tmdb ??
    o.movie_tmdb_id ??
    o.movieTmdbId ??
    o.movie_id ??
    o.movieId ??
    o.id ??
    ids?.id;
  const tmdb_id = num(tmdbRaw);
  if (tmdb_id == null || tmdb_id <= 0) return null;

  const title =
    typeof o.title === 'string' && o.title.trim()
      ? o.title.trim()
      : typeof o.name === 'string' && o.name.trim()
        ? o.name.trim()
        : `Movie ${index}`;

  const popularity = num(o.popularity ?? o.popularity_score ?? o.popularityScore ?? o.rank);
  const overview =
    typeof o.overview === 'string'
      ? o.overview
      : typeof o.tagline === 'string'
        ? o.tagline
        : null;

  let poster_path: string | null = null;
  const pp =
    o.poster_path ??
    o.posterPath ??
    o.thumbnail ??
    o.thumbnailPath ??
    (typeof o.poster === 'string' ? o.poster : null);
  if (typeof pp === 'string' && pp.trim()) poster_path = pp.trim();

  const providers = readProviders(o);
  console.log('Movie:', title, 'Found Providers:', providers.length);

  return {
    tmdb_id: Math.trunc(tmdb_id),
    title,
    popularity,
    overview,
    poster_path,
    providers,
  };
}

function sortByPopularityDesc(movies: ParsedStreamMovie[]): ParsedStreamMovie[] {
  return [...movies].sort((a, b) => {
    const pa = a.popularity ?? -1;
    const pb = b.popularity ?? -1;
    return pb - pa;
  });
}

function longestProvidersArrayInPayload(blob: unknown): number {
  let max = 0;
  for (const arr of extractProviderArrayRoots(blob)) max = Math.max(max, arr.length);
  return max;
}

function getDeclaredCatalogTotal(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const o = payload as Record<string, unknown>;
  const meta = maybeRecord(o.meta);
  const pagination = maybeRecord(o.pagination);
  const page = maybeRecord(o.page);
  const candidates = [
    o.total,
    o.totalCount,
    o.total_count,
    o.total_providers,
    o.totalProviders,
    meta?.total,
    meta?.totalCount,
    page?.total,
    pagination?.total,
  ];
  for (const c of candidates) {
    const n = num(c);
    if (n != null && n > 0) return Math.trunc(n);
  }
  return null;
}

/** Links-style `next`, relative paths, nested `pagination`/`meta`. */
export function resolveNextCatalogUrl(payload: unknown, currentRequestUrl: string): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const o = payload as Record<string, unknown>;
  const meta = maybeRecord(o.meta);
  const pagination = maybeRecord(o.pagination);

  const fromLink = (link: unknown): string | null => {
    if (!link || typeof link !== 'object') return null;
    const r = link as Record<string, unknown>;
    const href = typeof r.href === 'string' ? r.href : typeof r.url === 'string' ? r.url : null;
    if (!href?.trim()) return null;
    const h = href.trim();
    if (h.startsWith('http')) return h;
    try {
      return new URL(h, currentRequestUrl).href;
    } catch {
      return null;
    }
  };

  const tryString = (s: unknown): string | null => {
    if (typeof s !== 'string' || !s.trim()) return null;
    const t = s.trim();
    if (t === currentRequestUrl) return null;
    if (t.startsWith('http')) return t;
    try {
      return new URL(t, currentRequestUrl).href;
    } catch {
      return null;
    }
  };

  const candidates: unknown[] = [
    o.next,
    o.nextUrl,
    o.next_url,
    o.nextPage,
    o.next_page,
    (o.links as Record<string, unknown>)?.next,
    (o._links as Record<string, unknown>)?.next,
    pagination?.next,
    pagination?.nextUrl,
    pagination?.next_url,
    meta?.next,
    meta?.nextPage,
    meta?.next_url,
  ];

  for (const c of candidates) {
    const fromS = tryString(c);
    if (fromS) return fromS;
    const fromO = fromLink(c);
    if (fromO) return fromO;
  }
  return null;
}

async function probeNumericCatalogPages(
  apiKey: string,
  merged: Map<number, ParsedProvider>,
  declaredTotal: number,
  lastPayload: unknown
): Promise<void> {
  const pageSize = Math.max(1, longestProvidersArrayInPayload(lastPayload));
  const maxPage = Math.min(60, Math.max(2, Math.ceil(declaredTotal / pageSize) + 2));
  const base = new URL(OFFICIAL_STREAM_FINDER_PROVIDERS_URL);
  for (let p = 2; p <= maxPage && merged.size < declaredTotal; p++) {
    base.searchParams.set('page', String(p));
    const pageUrl = base.href;
    const res = await fetch(pageUrl, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) break;
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      break;
    }
    const batch = parseOfficialProvidersCatalog(json);
    if (batch.length === 0) break;
    const before = merged.size;
    for (const row of batch) merged.set(row.provider_id, row);
    if (merged.size === before) break;
  }
}

/** GET official catalog — required for a successful sync; follows `next` / `?page=` when totals hint at more rows. */
async function fetchStreamFinderProvidersCatalog(apiKey: string): Promise<ParsedProvider[]> {
  const merged = new Map<number, ParsedProvider>();
  const seen = new Set<string>();
  const queue: string[] = [OFFICIAL_STREAM_FINDER_PROVIDERS_URL];
  let lastPayload: unknown = null;
  let firstRequest = true;

  while (queue.length > 0) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });
    } catch (e) {
      throw new Error(
        `[stream-finder-sync] Providers catalog fetch failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    if (firstRequest) {
      firstRequest = false;
      if (res.status === 404 || res.status === 401) {
        throw new Error(
          `[stream-finder-sync] Providers catalog required but HTTP ${res.status}: ${OFFICIAL_STREAM_FINDER_PROVIDERS_URL}`
        );
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(
          `[stream-finder-sync] Providers catalog HTTP ${res.status}: ${t.slice(0, 400)}`
        );
      }
    } else if (!res.ok) {
      continue;
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      if (merged.size === 0) {
        throw new Error('[stream-finder-sync] Providers catalog response is not valid JSON');
      }
      continue;
    }

    lastPayload = json;
    for (const p of parseOfficialProvidersCatalog(json)) {
      merged.set(p.provider_id, p);
    }

    const next = resolveNextCatalogUrl(json, url);
    if (next && !seen.has(next)) queue.push(next);
  }

  const declared = lastPayload ? getDeclaredCatalogTotal(lastPayload) : null;
  if (typeof declared === 'number' && merged.size < declared && lastPayload !== null) {
    console.warn(
      `[stream-finder-sync] Catalog declares totalProviders/total=${declared} but collected ${merged.size}; probing ?page=2…`
    );
    await probeNumericCatalogPages(apiKey, merged, declared, lastPayload);
  }

  if (merged.size === 0) {
    throw new Error('[stream-finder-sync] Providers catalog parsed to zero rows (check `/api/providers` payload shape)');
  }

  return [...merged.values()];
}

async function fetchStreamFinderPayload(apiKey: string): Promise<unknown> {
  const res = await fetch(STREAM_FINDER_URL, {
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Stream Finder HTTP ${res.status}: ${t.slice(0, 500)}`);
  }
  return res.json();
}

function buildAvailability(movies: ParsedStreamMovie[]): ParsedAvailability[] {
  const out: ParsedAvailability[] = [];
  for (const m of movies) {
    for (const p of m.providers) {
      out.push({ movie_id: m.tmdb_id, provider_id: p.provider_id });
    }
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Append or replace sync block in HQ.md (project root). */
export function logStreamFinderSyncToHq(
  isoTime: string,
  movieCount: number,
  providerCount: number
): void {
  try {
    const hqPath = path.join(process.cwd(), 'HQ.md');
    if (!fs.existsSync(hqPath)) {
      console.warn('[stream-finder-sync] HQ.md not found — skipping HQ report');
      console.log(
        `[stream-finder-sync] OK ${movieCount} movies, ${providerCount} providers at ${isoTime}`
      );
      return;
    }
    let text = fs.readFileSync(hqPath, 'utf8');
    const block = `<!-- STREAM_FINDER_SYNC -->
### Stream Finder cache sync
- **Last successful run:** ${isoTime} — **${movieCount}** movies written to Supabase (\`stream_finder_movies\`).
- **Active Services:** ${providerCount} unique providers from official catalog (\`/api/providers\`) in \`stream_finder_providers\`.
<!-- /STREAM_FINDER_SYNC -->`;
    if (text.includes('<!-- STREAM_FINDER_SYNC -->')) {
      text = text.replace(
        /<!-- STREAM_FINDER_SYNC -->[\s\S]*?<!-- \/STREAM_FINDER_SYNC -->/,
        block
      );
    } else {
      text = text.trimEnd() + '\n\n' + block + '\n';
    }
    fs.writeFileSync(hqPath, text, 'utf8');
    console.log(
      `[stream-finder-sync] OK ${movieCount} movies, ${providerCount} providers at ${isoTime} · HQ.md updated`
    );
  } catch (e) {
    console.warn('[stream-finder-sync] Failed to write HQ.md (ignored):', e);
  }
}

export async function runStreamFinderSync(
  options: { supabase?: SupabaseClient } = {}
): Promise<{ movieCount: number; providerCount: number }> {
  const apiKey = process.env.STREAM_FINDER_KEY?.trim();
  const url = process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!apiKey) {
    throw new Error('Set STREAM_FINDER_KEY in the environment.');
  }
  if (!url || !serviceKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for sync writes.');
  }

  const supabase =
    options.supabase ??
    createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  const officialProviders = await fetchStreamFinderProvidersCatalog(apiKey);
  const json = await fetchStreamFinderPayload(apiKey);

  const items = extractMovies(json);
  const parsed: ParsedStreamMovie[] = [];
  for (let i = 0; i < items.length; i++) {
    try {
      const m = normalizeStreamFinderMovie(items[i], i);
      if (m) parsed.push(m);
    } catch (e) {
      console.warn(`[stream-finder-sync] skip movie row ${i} (normalize failed):`, e);
    }
  }
  const sorted = sortByPopularityDesc(parsed);

  const { error: truncErr } = await supabase.rpc('truncate_stream_finder_cache');
  if (truncErr) throw new Error(`truncate_stream_finder_cache: ${truncErr.message}`);
  console.log('🧹 Database cleared via CASCADE. Inserting official providers, then movies…');

  console.log(`✅ Synced ${officialProviders.length} official providers from /api/providers`);
  console.log('🔍 Found Providers:', officialProviders.map((p) => p.name).join(', '));

  const catalogIds = new Set(officialProviders.map((p) => p.provider_id));

  for (const batch of chunk(officialProviders, CHUNK)) {
    const { error } = await supabase.from('stream_finder_providers').upsert(
      batch.map((p) => ({
        provider_id: p.provider_id,
        name: p.name,
        logo_path: p.logo_path,
      })),
      { onConflict: 'provider_id' }
    );
    if (error) throw new Error(`stream_finder_providers: ${error.message}`);
  }

  const movieRows = sorted.map((m) => ({
    tmdb_id: m.tmdb_id,
    title: m.title,
    popularity: m.popularity,
    overview: m.overview,
    poster_path: m.poster_path,
    updated_at: new Date().toISOString(),
  }));

  for (const batch of chunk(movieRows, CHUNK)) {
    const { error } = await supabase.from('stream_finder_movies').upsert(batch, {
      onConflict: 'tmdb_id',
    });
    if (error) throw new Error(`stream_finder_movies: ${error.message}`);
  }

  const availAll = buildAvailability(sorted);
  const avail = availAll.filter((a) => catalogIds.has(a.provider_id));
  const dropped = availAll.length - avail.length;
  if (dropped > 0) {
    console.warn(
      `[stream-finder-sync] Dropped ${dropped} movie_availability rows (provider_id not in official catalog)`
    );
  }

  for (const batch of chunk(avail, CHUNK)) {
    const { error } = await supabase.from('movie_availability').upsert(batch, {
      onConflict: 'movie_id,provider_id',
    });
    if (error) throw new Error(`movie_availability: ${error.message}`);
  }

  const iso = new Date().toISOString();
  logStreamFinderSyncToHq(iso, sorted.length, officialProviders.length);

  return { movieCount: sorted.length, providerCount: officialProviders.length };
}
