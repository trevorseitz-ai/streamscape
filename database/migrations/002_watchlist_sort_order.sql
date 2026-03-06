-- Migration: Add sort_order column to watchlist for custom user ranking
-- Run this in your Supabase SQL Editor if you already have the schema deployed

ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS sort_order INTEGER;
CREATE INDEX IF NOT EXISTS idx_watchlist_sort_order ON watchlist(user_id, sort_order);
