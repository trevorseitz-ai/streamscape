-- Migration: Add deep crew credits support
-- Run this in your Supabase SQL Editor if you already have the schema deployed

-- 1. Drop the old CHECK constraint and add the expanded one
ALTER TABLE media_cast_crew DROP CONSTRAINT IF EXISTS media_cast_crew_role_type_check;
ALTER TABLE media_cast_crew ADD CONSTRAINT media_cast_crew_role_type_check
    CHECK (role_type IN ('actor', 'director', 'writer', 'cinematographer', 'assistant_director'));

-- 2. Widen the role_type column to fit longer values
ALTER TABLE media_cast_crew ALTER COLUMN role_type TYPE VARCHAR(30);

-- 3. Add the job column for storing the original TMDB job title
ALTER TABLE media_cast_crew ADD COLUMN IF NOT EXISTS job VARCHAR(100);
