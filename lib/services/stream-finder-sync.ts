/**
 * Server / CI only: pull Stream Finder API → Supabase clean sync.
 * Requires STREAM_FINDER_KEY and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Run: `npm run sync:stream-finder` from project root (.env loaded).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** TMDB profile size for provider logos (sync stores relative paths only; UI uses full URL with this base via `stream-finder-supabase`). */
export const TMDB_PROVIDER_LOGO_IMAGE_BASE = 'https://image.tmdb.org/t/p/w92';

/** Stored when the API omits `logo_path`; client maps this to a generic icon URL. */
export const GENERIC_PROVIDER_LOGO_SENTINEL = '__generic_stream__';

const STREAM_FINDER_URL =
  process.env.STREAM_FINDER_MOVIES_URL?.trim() ||
  'https://stream-finder--trevorseitzai.replit.app/api/movies';

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
  /** TMDB-relative path, full TMDB logo URL, or `GENERIC_PROVIDER_LOGO_SENTINEL` when unknown. */
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
 * Turn API logo values into a storable path/string; use sentinel when nothing usable is present.
 */
function normalizeProviderLogoPath(raw: unknown): string {
  if (raw == null) return GENERIC_PROVIDER_LOGO_SENTINEL;
  if (typeof raw !== 'string') return GENERIC_PROVIDER_LOGO_SENTINEL;
  let t = raw.trim();
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

export function parseOneProviderObject(o: Record<string, unknown>): ParsedProvider | null {
  const provNested = maybeRecord(o.provider);
  const id =
    num(
      o.provider_id ??
      o.providerId ??
      o.tm ??
      o.id ??
      provNested?.provider_id ??
      provNested?.providerId ??
      provNested?.id
    );
  if (id == null || id <= 0) return null;
  const tid = Math.trunc(id);
  const name =
    typeof o.name === 'string' && o.name.trim()
      ? o.name.trim()
      : `Provider ${tid}`;
  const lp =
    o.logo_path ?? o.logoPath ?? o.logo_uri ?? o.logoUri ?? o.logo ?? o.logoUrl;
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

const PAYLOAD_PROVIDER_KEYS = ['providers', 'master_providers', 'provider_list', 'watch_providers'] as const;

/** Pull provider rows from optional top-level arrays on the JSON root (same Set merge as movie-level). */
export function extractProvidersFromPayload(payload: unknown): ParsedProvider[] {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;
  const out: ParsedProvider[] = [];
  for (const key of PAYLOAD_PROVIDER_KEYS) {
    const raw = root[key];
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      if (
        Array.isArray(row.providers) ||
        Array.isArray(row.watch_providers) ||
        Array.isArray(row.watchProviders) ||
        Array.isArray(row.streaming_providers) ||
        Array.isArray(row.streamingProviders) ||
        Array.isArray(row.flatrate)
      ) {
        out.push(...readProviders(row));
      } else {
        const one = parseOneProviderObject(row);
        if (one) out.push(one);
      }
    }
  }
  return out;
}

function isGenericLogoPath(path: string | null | undefined): boolean {
  return !path || path === GENERIC_PROVIDER_LOGO_SENTINEL;
}

function mergeProviderIntoMap(map: Map<number, ParsedProvider>, incoming: ParsedProvider): void {
  const cur = map.get(incoming.provider_id);
  if (!cur) {
    map.set(incoming.provider_id, { ...incoming });
    return;
  }
  const name = cur.name.length >= incoming.name.length ? cur.name : incoming.name;
  let logo_path = cur.logo_path;
  if (isGenericLogoPath(cur.logo_path) && !isGenericLogoPath(incoming.logo_path)) {
    logo_path = incoming.logo_path;
  } else if (!isGenericLogoPath(cur.logo_path)) {
    logo_path = cur.logo_path;
  } else {
    logo_path = incoming.logo_path;
  }
  map.set(incoming.provider_id, {
    provider_id: incoming.provider_id,
    name,
    logo_path: isGenericLogoPath(logo_path) ? GENERIC_PROVIDER_LOGO_SENTINEL : logo_path!,
  });
}

/** Dedup by `provider_id` (Set semantics); merges movie-level rows with optional root-level catalog rows. */
export function buildMasterProviderList(movies: ParsedStreamMovie[], payload: unknown): ParsedProvider[] {
  const map = new Map<number, ParsedProvider>();
  for (const m of movies) {
    for (const p of m.providers) mergeProviderIntoMap(map, p);
  }
  for (const p of extractProvidersFromPayload(payload)) mergeProviderIntoMap(map, p);
  return [...map.values()];
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
- **Active Services:** ${providerCount} unique providers in Master Provider List (\`stream_finder_providers\`).
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
  console.log("🧹 Database cleared via CASCADE. Inserting 300+ movies...");

  const providers = buildMasterProviderList(sorted, json);
  for (const batch of chunk(providers, CHUNK)) {
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

  const avail = buildAvailability(sorted);
  for (const batch of chunk(avail, CHUNK)) {
    const { error } = await supabase.from('movie_availability').upsert(batch, {
      onConflict: 'movie_id,provider_id',
    });
    if (error) throw new Error(`movie_availability: ${error.message}`);
  }

  const iso = new Date().toISOString();
  logStreamFinderSyncToHq(iso, sorted.length, providers.length);

  return { movieCount: sorted.length, providerCount: providers.length };
}
