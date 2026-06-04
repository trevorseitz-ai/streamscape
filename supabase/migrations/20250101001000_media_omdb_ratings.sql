-- Optional columns for OMDb-derived scores and IMDb linkage (apply when architecture is approved).
-- imdb_id: TMDB external_ids.imdb_id (e.g. tt1375666) for OMDb ?i= lookups.

ALTER TABLE public.media ADD COLUMN IF NOT EXISTS imdb_id VARCHAR(20) UNIQUE;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS imdb_rating TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS rt_score TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS metascore TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS ratings_fetched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_media_imdb_id ON public.media(imdb_id) WHERE imdb_id IS NOT NULL;

COMMENT ON COLUMN public.media.imdb_rating IS 'OMDb imdbRating (e.g. 8.4)';
COMMENT ON COLUMN public.media.rt_score IS 'Rotten Tomatoes Tomatometer from OMDb Ratings (e.g. 93%)';
COMMENT ON COLUMN public.media.metascore IS 'Metacritic score from OMDb Metascore';
COMMENT ON COLUMN public.media.ratings_fetched_at IS 'Last successful OMDb fetch for cache/TTL';
