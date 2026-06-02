import { supabase } from './supabase';
import {
  mergeWatchProviderCountryBuckets,
  type WatchProviderCountry,
} from './tmdb-watch-providers';

const TMDB_BASE = 'https://api.themoviedb.org/3';

/** Refresh the cached watch-provider logos every two weeks. */
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const CACHE_TABLE = 'tmdb_watch_provider_cache';

/** Minimal provider shape persisted in `tmdb_watch_provider_cache.providers`. */
export interface CachedProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}

function isFresh(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return false;
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < CACHE_TTL_MS;
}

function parseCachedProviders(raw: unknown): CachedProvider[] | null {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value)) return null;
  const out: CachedProvider[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = Number(o.provider_id);
    if (!Number.isFinite(id) || id <= 0) continue;
    out.push({
      provider_id: id,
      provider_name: typeof o.provider_name === 'string' ? o.provider_name : '',
      logo_path: typeof o.logo_path === 'string' ? o.logo_path : null,
    });
  }
  return out;
}

async function fetchProvidersFromTmdb(
  tmdbId: number,
  country: string,
  apiKey: string
): Promise<CachedProvider[]> {
  const res = await fetch(`${TMDB_BASE}/movie/${tmdbId}/watch/providers`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`TMDB watch/providers ${res.status}`);
  }
  const data = (await res.json()) as {
    results?: Record<string, WatchProviderCountry>;
  };
  const countryData = data.results?.[country];
  // Merge every tier (flatrate/free/ads/rent/buy) and dedupe by provider id.
  return mergeWatchProviderCountryBuckets(countryData).map((p) => ({
    provider_id: p.provider_id,
    provider_name: p.provider_name,
    logo_path: p.logo_path,
  }));
}

/**
 * Returns the watch-provider logos for a title + country, reading from the
 * Supabase cache first and only hitting TMDB when the row is missing or older
 * than the 14-day TTL. On a refresh failure, falls back to stale cache data so
 * the UI degrades gracefully.
 */
export async function getWatchProvidersCached(
  tmdbId: number,
  country: string,
  apiKey: string
): Promise<CachedProvider[]> {
  let stale: CachedProvider[] | null = null;

  try {
    const { data, error } = await supabase
      .from(CACHE_TABLE)
      .select('providers, updated_at')
      .eq('tmdb_id', tmdbId)
      .eq('country', country)
      .maybeSingle();

    if (!error && data) {
      const parsed = parseCachedProviders((data as Record<string, unknown>).providers);
      if (parsed) {
        if (isFresh((data as Record<string, unknown>).updated_at as string)) {
          return parsed;
        }
        stale = parsed;
      }
    }
  } catch {
    // Cache unavailable; fall through to live fetch.
  }

  try {
    const fresh = await fetchProvidersFromTmdb(tmdbId, country, apiKey);
    try {
      await supabase.from(CACHE_TABLE).upsert(
        {
          tmdb_id: tmdbId,
          country,
          providers: fresh as unknown as Record<string, unknown>[],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tmdb_id,country' }
      );
    } catch {
      // Best-effort cache write; ignore failures.
    }
    return fresh;
  } catch {
    return stale ?? [];
  }
}
