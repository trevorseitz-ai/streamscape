-- Optional 1-5 star rating for items in a user's Watched library (user_library).
ALTER TABLE public.user_library
  ADD COLUMN IF NOT EXISTS personal_rating INTEGER;

ALTER TABLE public.user_library
  DROP CONSTRAINT IF EXISTS user_library_personal_rating_check;
ALTER TABLE public.user_library
  ADD CONSTRAINT user_library_personal_rating_check
  CHECK (personal_rating IS NULL OR (personal_rating >= 1 AND personal_rating <= 5));

COMMENT ON COLUMN public.user_library.personal_rating IS
  'User 1-5 star rating for a watched title; NULL if unrated.';

-- user_library had SELECT/INSERT/DELETE policies but no UPDATE; ratings need it.
DROP POLICY IF EXISTS "Users can update own user_library" ON public.user_library;
CREATE POLICY "Users can update own user_library"
  ON public.user_library FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
