-- Migration: Allow authenticated users to insert media (for watchlist from Discover/Trending)
-- Run this in your Supabase SQL Editor

CREATE POLICY "Authenticated users can insert media" ON media
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
