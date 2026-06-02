/**
 * Read Stream Finder–synced rows from Supabase for Discover (optional **`movie_availability`** filter via RPC).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { FilmShowDiscoverMovie } from './film-show-rapid-discover';

/**
 * Stored in DB when the upstream API omits a logo (`stream-finder-sync`); must stay in sync with that ingest.
 */
const GENERIC_PROVIDER_LOGO_SENTINEL = '__generic_stream__';

/**
 * TV-safe poster width for synced Stream Finder grids — **`w342`** (not **`original`** / **`w500`**).
 * See **`docs/depts/tv.md`** (Discover feed performance).
 */
export const STREAM_FINDER_TV_POSTER_TMDB_WIDTH = 'w342' as const;
const TMDB_IMG = `https://image.tmdb.org/t/p/${STREAM_FINDER_TV_POSTER_TMDB_WIDTH}`;

/** Pagination page size for default Discover (**Stream Finder** Supabase reads). Matches TV performance standard. */
export const STREAM_FINDER_DISCOVER_PAGE_SIZE = 20;

/** Align with Stream Finder ingestion: w92 logos read better on dense mobile / TV layouts than w45. */
const TMDB_PROVIDER_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

/** Shown when `logo_path` is missing upstream (stored as sentinel in Supabase after sync). */
const GENERIC_STREAM_LOGO_URL =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="92" height="92" viewBox="0 0 92 92">
      <rect width="92" height="92" rx="14" fill="#111827"/>
      <circle cx="46" cy="46" r="18" fill="none" stroke="#818cf8" stroke-width="4"/>
      <polygon points="40,37 56,46 40,55" fill="#c7d2fe"/>
    </svg>`
  );

export type StreamFinderMovieRow = {
  tmdb_id: number;
  title: string;
  popularity: number | null;
  overview: string | null;
  poster_path: string | null;
};

export type StreamFinderProviderRow = {
  provider_id: number;
  name: string;
  logo_path: string | null;
};

function posterUrlFromPath(path: string | null): string | null {
  if (!path || typeof path !== 'string') return null;
  const p = path.trim();
  if (!p) return null;
  return p.startsWith('http') ? p : `${TMDB_IMG}${p}`;
}

/** Full logo URL for a `stream_finder_providers.logo_path` value (w92 + generic fallback). */
export function resolveStreamFinderProviderLogoUrl(
  path: string | null | undefined
): string {
  if (path == null) return GENERIC_STREAM_LOGO_URL;
  const p = path.trim();
  if (!p || p === GENERIC_PROVIDER_LOGO_SENTINEL) return GENERIC_STREAM_LOGO_URL;
  if (p.startsWith('http')) return p;
  return `${TMDB_PROVIDER_LOGO_BASE}${p.startsWith('/') ? p : `/${p}`}`;
}

function logoUrlFromPath(path: string | null | undefined): string {
  return resolveStreamFinderProviderLogoUrl(path);
}

function normalizeCandidateProviderIds(ids: unknown[]): number[] {
  const out: number[] = [];
  for (const x of ids) {
    const n = Math.trunc(Number(x));
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return [...new Set(out)];
}

/**
 * Intersect candidate provider IDs with `stream_finder_providers`. On Supabase error, returns
 * `candidateIds` unchanged (offline-safe).
 */
export async function pruneProviderIdsToStreamFinderCatalog(
  client: SupabaseClient,
  candidateIds: number[]
): Promise<number[]> {
  const uniq = normalizeCandidateProviderIds(candidateIds);
  if (uniq.length === 0) return [];

  const { data, error } = await client
    .from('stream_finder_providers')
    .select('provider_id')
    .in('provider_id', uniq);

  if (error) {
    console.warn(
      '[stream-finder] pruneProviderIdsToStreamFinderCatalog:',
      error.message
    );
    return uniq;
  }

  const allowed = new Set(
    (data ?? []).map((r) => Number((r as { provider_id: number }).provider_id))
  );
  return uniq.filter((id) => allowed.has(id));
}

/**
 * `user_profiles.enabled_services` ∩ `stream_finder_providers` (inner join on id).
 */
export async function getValidUserProviders(
  client: SupabaseClient,
  userId: string
): Promise<number[]> {
  const { data: profile, error } = await client
    .from('user_profiles')
    .select('enabled_services')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[stream-finder] getValidUserProviders profile:', error.message);
    return [];
  }

  const raw = profile?.enabled_services;
  if (!Array.isArray(raw) || raw.length === 0) return [];

  return pruneProviderIdsToStreamFinderCatalog(
    client,
    normalizeCandidateProviderIds(raw)
  );
}

/**
 * Signed-in: `user_profiles.enabled_services` when set, otherwise same local fallback as Profile.
 * Signed-out: AsyncStorage IDs. Results are intersected with `stream_finder_providers`.
 */
export async function resolvePrunedProviderSelections(
  client: SupabaseClient,
  options: { userId: string | null | undefined }
): Promise<number[]> {
  let candidate: number[] = [];

  if (options.userId) {
    const { data: profile, error } = await client
      .from('user_profiles')
      .select('enabled_services')
      .eq('id', options.userId)
      .maybeSingle();

    if (error) {
      console.warn(
        '[stream-finder] resolvePrunedProviderSelections profile:',
        error.message
      );
    } else if (
      profile?.enabled_services &&
      Array.isArray(profile.enabled_services) &&
      profile.enabled_services.length > 0
    ) {
      candidate = normalizeCandidateProviderIds(profile.enabled_services);
    }

    if (candidate.length === 0) {
      const { getSavedProviderIds } = await import('./provider-preferences');
      candidate = await getSavedProviderIds();
    }
  } else {
    const { getSavedProviderIds } = await import('./provider-preferences');
    candidate = await getSavedProviderIds();
  }

  return pruneProviderIdsToStreamFinderCatalog(client, candidate);
}

/** Map DB rows → Discover list shape + structured providers for MovieCard. */
export function mapStreamFinderToDiscover(
  movie: StreamFinderMovieRow,
  providerById: Map<number, StreamFinderProviderRow>,
  linksForMovie: Array<{ provider_id: number }>
): FilmShowDiscoverMovie {
  const seenPid = new Set<number>();
  const structured: Array<{ id: number; name: string; logo_url: string }> = [];

  for (const link of linksForMovie) {
    if (seenPid.has(link.provider_id)) continue;
    const prov = providerById.get(link.provider_id);
    if (!prov) continue;
    seenPid.add(link.provider_id);

    const logo_url = logoUrlFromPath(prov.logo_path);

    structured.push({
      id: prov.provider_id,
      name: prov.name,
      logo_url,
    });
  }

  structured.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  const platformsFixed = structured.map((r) => {
    const prow = providerById.get(r.id);
    return {
      name: r.name,
      access_type: 'subscription' as const,
      logo_path: prow?.logo_path ?? null,
    };
  });

  const out: FilmShowDiscoverMovie = {
    id: String(movie.tmdb_id),
    title: movie.title,
    poster_url: posterUrlFromPath(movie.poster_path),
    backdrop_url: null,
    release_year: null,
    vote_average: null,
    platforms: platformsFixed,
    tmdb_id: movie.tmdb_id,
    providers: structured,
    provider_logo_urls: structured.map((r) => r.logo_url),
  };
  return out;
}

/** Load provider catalog once; reuse across paginated Discover reads. */
export async function fetchStreamFinderProviderCatalog(
  client: SupabaseClient
): Promise<Map<number, StreamFinderProviderRow>> {
  const { data: provRows, error: pErr } = await client
    .from('stream_finder_providers')
    .select('provider_id, name, logo_path');
  if (pErr) throw new Error(pErr.message);
  const providerById = new Map<number, StreamFinderProviderRow>();
  for (const p of (provRows ?? []) as StreamFinderProviderRow[]) {
    providerById.set(p.provider_id, p);
  }
  return providerById;
}

/** Pagination options for Supabase **`stream_finder_movies`** + **`movie_availability`**. */
export type FetchDiscoverMoviesPageStreamFinderOpts = {
  offset: number;
  limit?: number;
  /**
   * Omit or **`null`/empty`: full catalog (**no **`movie_availability`** filter**) — UX “show all movies.”
   * Non-empty: intersect with **`stream_finder_providers`**, then only movies linked in **`movie_availability`** to ≥1 listed provider.
   */
  watchProviderIds?: number[] | null;
};

type StreamFinderFilteredRpcRow = {
  tmdb_id: number;
  title: string;
  popularity: number | null;
  overview: string | null;
  poster_path: string | null;
  matched_total: number;
};

function parseStreamFinderPopularity(pop: unknown): number | null {
  if (pop === null || pop === undefined) return null;
  if (typeof pop === 'number') return Number.isFinite(pop) ? pop : null;
  const n = Number(pop);
  return Number.isFinite(n) ? n : null;
}

/**
 * Paginated curated list (sorted by popularity). Callers should keep **`STREAM_FINDER_DISCOVER_PAGE_SIZE`**
 * aligned with **`docs/depts/tv.md`** and append via Infinite scroll (**`FlatList`**).
 *
 * **`watchProviderIds`** set → Postgres RPC **`stream_finder_discover_page_filtered`** (joined filter). Otherwise legacy unfiltered **`stream_finder_movies`** range (**same total semantics** — full mirror count).
 */
export async function fetchDiscoverMoviesPageFromStreamFinder(
  client: SupabaseClient,
  opts: FetchDiscoverMoviesPageStreamFinderOpts,
  providerById: Map<number, StreamFinderProviderRow>
): Promise<{ movies: FilmShowDiscoverMovie[]; totalAvailable: number }> {
  const limit =
    opts.limit != null ? Math.min(100, Math.max(1, opts.limit)) : STREAM_FINDER_DISCOVER_PAGE_SIZE;
  const offset = Math.max(0, opts.offset);

  const wantsAvailFilter =
    Array.isArray(opts.watchProviderIds) && opts.watchProviderIds.length > 0;

  let prunedFilterIds: number[] | null = null;
  if (wantsAvailFilter) {
    prunedFilterIds = await pruneProviderIdsToStreamFinderCatalog(client, opts.watchProviderIds!);
    if (prunedFilterIds.length === 0) {
      return { movies: [], totalAvailable: 0 };
    }
  }

  let movieRows: StreamFinderMovieRow[];
  let totalAvailable: number;

  if (prunedFilterIds != null) {
    const { data: rows, error: rpcErr } = await client.rpc('stream_finder_discover_page_filtered', {
      p_provider_ids: prunedFilterIds,
      p_offset: offset,
      p_limit: limit,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    const list = (rows ?? []) as StreamFinderFilteredRpcRow[];

    totalAvailable =
      list.length > 0
        ? Math.max(0, Math.trunc(Number(list[0]!.matched_total)))
        : 0;
    if (!Number.isFinite(totalAvailable)) {
      totalAvailable = 0;
    }

    movieRows = list.map((r) => {
      const popularity = parseStreamFinderPopularity(r.popularity);
      return {
        tmdb_id: Number(r.tmdb_id),
        title: String(r.title ?? ''),
        popularity,
        overview: r.overview == null ? null : String(r.overview),
        poster_path: r.poster_path == null ? null : String(r.poster_path),
      };
    });
  } else {
    const { data: movies, error: mErr, count } = await client
      .from('stream_finder_movies')
      .select('tmdb_id, title, popularity, overview, poster_path', { count: 'exact' })
      .order('popularity', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (mErr) throw new Error(mErr.message);
    movieRows = (movies ?? []) as StreamFinderMovieRow[];
    totalAvailable = count ?? 0;
  }

  if (movieRows.length === 0) {
    return { movies: [], totalAvailable };
  }

  const tmdbIds = movieRows.map((m) => m.tmdb_id);

  const { data: links, error: lErr } = await client
    .from('movie_availability')
    .select('movie_id, provider_id')
    .in('movie_id', tmdbIds);
  if (lErr) throw new Error(lErr.message);

  const linksByMovie = new Map<number, Array<{ provider_id: number }>>();
  for (const row of links ?? []) {
    const mid = row.movie_id as number;
    const pid = row.provider_id as number;
    if (!linksByMovie.has(mid)) linksByMovie.set(mid, []);
    linksByMovie.get(mid)!.push({ provider_id: pid });
  }

  const out = movieRows.map((m) =>
    mapStreamFinderToDiscover(m, providerById, linksByMovie.get(m.tmdb_id) ?? [])
  );
  return { movies: out, totalAvailable };
}
