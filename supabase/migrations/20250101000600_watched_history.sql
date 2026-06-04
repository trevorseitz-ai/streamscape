-- Migration: Create watched_history table for tracking watched movies
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS watched_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tmdb_id INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    poster_url TEXT,
    watched_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE watched_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watched history" ON watched_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watched history" ON watched_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_watched_history_user ON watched_history(user_id);
