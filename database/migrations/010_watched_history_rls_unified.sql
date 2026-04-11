-- Unified RLS for watched_history: single FOR ALL policy for authenticated users.
-- Replaces separate SELECT/INSERT policies that omitted UPDATE/DELETE.

ALTER TABLE public.watched_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to manage own history" ON public.watched_history;
DROP POLICY IF EXISTS "Users can insert own watched history" ON public.watched_history;
DROP POLICY IF EXISTS "Users can view own watched history" ON public.watched_history;
DROP POLICY IF EXISTS "Users can view their own watched history" ON public.watched_history;

CREATE POLICY "Allow users to manage own history"
ON public.watched_history
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
