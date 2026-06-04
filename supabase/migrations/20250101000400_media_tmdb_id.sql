-- Migration: Add tmdb_id to media for watchlist from Discover/Trending
-- Run this in your Supabase SQL Editor if you already have the schema deployed

ALTER TABLE media ADD COLUMN IF NOT EXISTS tmdb_id INTEGER UNIQUE;
