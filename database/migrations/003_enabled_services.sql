-- Migration: Add enabled_services column to user_profiles for streaming provider preferences
-- Run this in your Supabase SQL Editor if you already have the schema deployed

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS enabled_services INTEGER[] DEFAULT '{}';
