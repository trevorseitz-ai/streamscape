-- Optional 1–5 star rating when marking a movie as watched.
ALTER TABLE watched_history
  ADD COLUMN IF NOT EXISTS personal_rating INTEGER;

COMMENT ON COLUMN watched_history.personal_rating IS 'User rating 1–5 when marking watched; NULL if skipped or not provided.';
