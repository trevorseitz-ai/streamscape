-- User "Library" (owned / saved in collection), distinct from watchlist.

CREATE TABLE IF NOT EXISTS user_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_user_library_user ON user_library(user_id);
CREATE INDEX IF NOT EXISTS idx_user_library_media ON user_library(media_id);

ALTER TABLE user_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user_library" ON user_library
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own user_library" ON user_library
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own user_library" ON user_library
  FOR DELETE USING (auth.uid() = user_id);
