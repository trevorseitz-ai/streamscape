-- Stream Finder cache: curated Discover feed + provider logos (synced from external API).

CREATE TABLE IF NOT EXISTS public.stream_finder_providers (
  provider_id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_path TEXT
);

CREATE TABLE IF NOT EXISTS public.stream_finder_movies (
  tmdb_id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  popularity DOUBLE PRECISION,
  overview TEXT,
  poster_path TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.movie_availability (
  movie_id BIGINT NOT NULL REFERENCES public.stream_finder_movies (tmdb_id) ON DELETE CASCADE,
  provider_id BIGINT NOT NULL REFERENCES public.stream_finder_providers (provider_id) ON DELETE CASCADE,
  PRIMARY KEY (movie_id, provider_id)
);

-- Numeric sort for ORDER BY popularity DESC (btree appropriate for scalar ordering).
CREATE INDEX IF NOT EXISTS idx_stream_finder_movies_popularity
  ON public.stream_finder_movies (popularity DESC NULLS LAST);

ALTER TABLE public.stream_finder_movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_finder_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stream_finder_movies_select" ON public.stream_finder_movies;
CREATE POLICY "stream_finder_movies_select"
  ON public.stream_finder_movies FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "stream_finder_providers_select" ON public.stream_finder_providers;
CREATE POLICY "stream_finder_providers_select"
  ON public.stream_finder_providers FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "movie_availability_select" ON public.movie_availability;
CREATE POLICY "movie_availability_select"
  ON public.movie_availability FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.stream_finder_movies IS 'Stream Finder API mirror; populated by lib/services/stream-finder-sync (service role).';
COMMENT ON INDEX idx_stream_finder_movies_popularity IS 'Optimizes Discover default list sort by popularity.';

-- One-shot wipe for nightly clean sync (service role / server scripts only).
CREATE OR REPLACE FUNCTION public.truncate_stream_finder_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Truncating all three at once with CASCADE is the only way to satisfy FKs.
  TRUNCATE TABLE
    public.movie_availability,
    public.stream_finder_movies,
    public.stream_finder_providers
  RESTART IDENTITY CASCADE;
END;
$$;

REVOKE ALL ON FUNCTION public.truncate_stream_finder_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.truncate_stream_finder_cache() TO service_role;
