-- Fixes truncate_stream_finder_cache: single TRUNCATE (+ CASCADE) for all Stream Finder FK-linked tables.

CREATE OR REPLACE FUNCTION public.truncate_stream_finder_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  TRUNCATE TABLE
    public.movie_availability,
    public.stream_finder_movies,
    public.stream_finder_providers
  RESTART IDENTITY CASCADE;
END;
$$;
