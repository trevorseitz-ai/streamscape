import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client with service role key.
 * Bypasses RLS - use only in API routes for inserting media data.
 */
export function createSupabaseAdmin() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL is required. Set it in your environment variables.'
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for the scrape API. Get it from Supabase Dashboard > Project Settings > API.'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}
