-- Per-title/country cache of TMDB watch/providers logos for the Watchlist list view.
-- Refreshed from the client on a 14-day TTL (see lib/watch-provider-cache.ts) so that
-- every saved title can show all of the services it streams on without re-hitting TMDB
-- on every render.

CREATE TABLE IF NOT EXISTS public.tmdb_watch_provider_cache (
  tmdb_id BIGINT NOT NULL,
  country TEXT NOT NULL,
  providers JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tmdb_id, country)
);

ALTER TABLE public.tmdb_watch_provider_cache ENABLE ROW LEVEL SECURITY;

-- Public catalog data: any visitor may read.
DROP POLICY IF EXISTS "tmdb_watch_provider_cache_select" ON public.tmdb_watch_provider_cache;
CREATE POLICY "tmdb_watch_provider_cache_select"
  ON public.tmdb_watch_provider_cache FOR SELECT
  TO anon, authenticated
  USING (true);

-- Signed-in clients populate/refresh the cache when a row is missing or stale.
DROP POLICY IF EXISTS "tmdb_watch_provider_cache_insert" ON public.tmdb_watch_provider_cache;
CREATE POLICY "tmdb_watch_provider_cache_insert"
  ON public.tmdb_watch_provider_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "tmdb_watch_provider_cache_update" ON public.tmdb_watch_provider_cache;
CREATE POLICY "tmdb_watch_provider_cache_update"
  ON public.tmdb_watch_provider_cache FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.tmdb_watch_provider_cache IS
  'Per-title/country TMDB watch-provider logo cache for the Watchlist; client-refreshed on a 14-day TTL.';
