-- ReelDive Database Schema
-- PostgreSQL / Supabase
-- Run this in your Supabase SQL Editor to initialize the database

-- Enable UUID extension (Supabase has this by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Media: Movies and TV shows
CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tmdb_id INTEGER UNIQUE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('movie', 'tv')),
    title VARCHAR(500) NOT NULL,
    synopsis TEXT,
    release_year INTEGER,
    poster_url TEXT,
    backdrop_url TEXT,
    last_scraped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- People: Actors, directors, crew
CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    headshot_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platforms: Netflix, Hulu, Max, etc.
CREATE TABLE platforms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- JUNCTION TABLES
-- =============================================================================

-- Media_Availability: Where content streams (subscription/rent/buy)
CREATE TABLE media_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    platform_id UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('subscription', 'rent', 'buy')),
    price DECIMAL(10, 2),
    direct_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(media_id, platform_id, access_type)
);

-- Media_Cast_Crew: Links media to people with roles
CREATE TABLE media_cast_crew (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    role_type VARCHAR(30) NOT NULL CHECK (role_type IN ('actor', 'director', 'writer', 'cinematographer', 'assistant_director')),
    character VARCHAR(255),
    job VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- USERS & WATCHLISTS
-- =============================================================================

-- User profiles (extends Supabase auth.users - link via id)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    avatar_url TEXT,
    enabled_services INTEGER[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watchlist: User's saved media with watched status
CREATE TABLE watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    watched BOOLEAN DEFAULT FALSE,
    sort_order INTEGER,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, media_id)
);

-- Watched history: Movies the user has marked as watched
CREATE TABLE watched_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tmdb_id INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    poster_url TEXT,
    personal_rating INTEGER,
    watched_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES (for performance)
-- =============================================================================

CREATE INDEX idx_media_type ON media(type);
CREATE INDEX idx_media_title ON media(title);
CREATE INDEX idx_media_last_scraped ON media(last_scraped_at);
CREATE INDEX idx_media_release_year ON media(release_year);

CREATE INDEX idx_people_name ON people(name);

CREATE INDEX idx_media_availability_media ON media_availability(media_id);
CREATE INDEX idx_media_availability_platform ON media_availability(platform_id);

CREATE INDEX idx_media_cast_crew_media ON media_cast_crew(media_id);
CREATE INDEX idx_media_cast_crew_person ON media_cast_crew(person_id);

CREATE INDEX idx_watchlist_user ON watchlist(user_id);
CREATE INDEX idx_watchlist_media ON watchlist(media_id);
CREATE INDEX idx_watched_history_user ON watched_history(user_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) - Supabase best practice
-- =============================================================================

ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_cast_crew ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_history ENABLE ROW LEVEL SECURITY;

-- Media, People, Platforms, Media_Availability, Media_Cast_Crew: Public read
CREATE POLICY "Media is viewable by everyone" ON media FOR SELECT USING (true);
CREATE POLICY "People is viewable by everyone" ON people FOR SELECT USING (true);
CREATE POLICY "Platforms is viewable by everyone" ON platforms FOR SELECT USING (true);
CREATE POLICY "Media availability is viewable by everyone" ON media_availability FOR SELECT USING (true);
CREATE POLICY "Media cast crew is viewable by everyone" ON media_cast_crew FOR SELECT USING (true);

-- User profiles: Users can read/update/delete own profile
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON user_profiles FOR DELETE USING (auth.uid() = id);

-- Watchlist: Users can only access their own watchlist
CREATE POLICY "Users can view own watchlist" ON watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own watchlist" ON watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own watchlist" ON watchlist FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own watchlist" ON watchlist FOR DELETE USING (auth.uid() = user_id);

-- Watched history: Users can only access their own
CREATE POLICY "Users can view own watched history" ON watched_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own watched history" ON watched_history FOR INSERT WITH CHECK (auth.uid() = user_id);
