-- Discover Stream Finder pagination filtered by user's enabled provider selections (movie_availability).
-- Empty p_provider_ids = full catalog (unchanged UX: "show all movies" when nothing selected).

CREATE OR REPLACE FUNCTION public.stream_finder_discover_page_filtered(
  p_provider_ids bigint[],
  p_offset integer,
  p_limit integer
)
RETURNS TABLE (
  tmdb_id bigint,
  title text,
  popularity double precision,
  overview text,
  poster_path text,
  matched_total bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH eligible AS (
    SELECT
      m.tmdb_id,
      m.title,
      m.popularity,
      m.overview,
      m.poster_path
    FROM public.stream_finder_movies m
    WHERE COALESCE(cardinality(p_provider_ids), 0) = 0
      OR EXISTS (
        SELECT 1
        FROM public.movie_availability a
        WHERE a.movie_id = m.tmdb_id
          AND a.provider_id = ANY (p_provider_ids)
      )
  ),
  totals AS (
    SELECT
      e.tmdb_id,
      e.title,
      e.popularity,
      e.overview,
      e.poster_path,
      COUNT(*) OVER () AS matched_total
    FROM eligible e
  )
  SELECT
    t.tmdb_id,
    t.title,
    t.popularity,
    t.overview,
    t.poster_path,
    t.matched_total
  FROM totals t
  ORDER BY t.popularity DESC NULLS LAST
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
  OFFSET GREATEST(p_offset, 0);
$$;

COMMENT ON FUNCTION public.stream_finder_discover_page_filtered(bigint[], integer, integer) IS
  'Paginates stream_finder_movies by popularity after filtering to movies available on optional provider IDs (movie_availability).';

GRANT EXECUTE ON FUNCTION public.stream_finder_discover_page_filtered(bigint[], integer, integer) TO anon, authenticated;
