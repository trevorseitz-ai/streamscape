-- ReelDive RLS Policies
-- PostgreSQL / Supabase
-- Run this AFTER schema.sql. Safe to re-run (drops existing policies first).

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY (if not already enabled)
-- =============================================================================

ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_cast_crew ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- DROP EXISTING POLICIES (for idempotent re-runs)
-- =============================================================================

-- Media
DROP POLICY IF EXISTS "Media is viewable by everyone" ON media;
DROP POLICY IF EXISTS "Authenticated users can insert media" ON media;

-- People
DROP POLICY IF EXISTS "People is viewable by everyone" ON people;

-- Platforms
DROP POLICY IF EXISTS "Platforms is viewable by everyone" ON platforms;

-- Media_Availability
DROP POLICY IF EXISTS "Media availability is viewable by everyone" ON media_availability;

-- Media_Cast_Crew
DROP POLICY IF EXISTS "Media cast crew is viewable by everyone" ON media_cast_crew;

-- User profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON user_profiles;

-- Watchlist
DROP POLICY IF EXISTS "Users can view own watchlist" ON watchlist;
DROP POLICY IF EXISTS "Users can insert own watchlist" ON watchlist;
DROP POLICY IF EXISTS "Users can update own watchlist" ON watchlist;
DROP POLICY IF EXISTS "Users can delete own watchlist" ON watchlist;

-- =============================================================================
-- PUBLIC READ POLICIES
-- Media, People, Platforms, and junction tables are publicly readable
-- =============================================================================

CREATE POLICY "Media is viewable by everyone" ON media
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert media" ON media
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "People is viewable by everyone" ON people
    FOR SELECT USING (true);

CREATE POLICY "Platforms is viewable by everyone" ON platforms
    FOR SELECT USING (true);

CREATE POLICY "Media availability is viewable by everyone" ON media_availability
    FOR SELECT USING (true);

CREATE POLICY "Media cast crew is viewable by everyone" ON media_cast_crew
    FOR SELECT USING (true);

-- =============================================================================
-- USER-OWNED POLICIES
-- User profiles and Watchlist: only readable and writable by the authenticated
-- user who owns that data
-- =============================================================================

-- User profiles: full CRUD for own profile only
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON user_profiles
    FOR DELETE USING (auth.uid() = id);

-- Watchlist: full CRUD for own watchlist items only
CREATE POLICY "Users can view own watchlist" ON watchlist
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist" ON watchlist
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watchlist" ON watchlist
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist" ON watchlist
    FOR DELETE USING (auth.uid() = user_id);
