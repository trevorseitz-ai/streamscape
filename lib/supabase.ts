import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import { isTvTarget } from './isTv';

const rawEnvSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
/** Trimmed Supabase REST origin (no trailing slash). */
const supabaseUrl = (rawEnvSupabaseUrl || '').trim().replace(/\/$/, '');
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

if (isTvTarget() && !(rawEnvSupabaseUrl ?? '').trim()) {
  console.error(
    '🚨 TV BUNDLE ERROR: No Supabase URL found. Check your .env and restart Metro.'
  );
}

if (__DEV__ && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    '[supabase] Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY — RLS requires a valid anon key and a signed-in session (JWT) on each request.'
  );
}

if (__DEV__ && supabaseUrl) {
  try {
    const u = new URL(supabaseUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      console.warn(`[supabase] Use an https:// (or dev-only http://) Supabase URL; got scheme: ${u.protocol}`);
    }
    const h = u.hostname.toLowerCase();
    const looksLocal = h === 'localhost' || h === '127.0.0.1' || /^10\.\d+\.\d+\.\d+$/.test(h) || /^192\.168\.\d+\.\d+$/.test(h);
    if (isTvTarget() && (looksLocal || u.protocol === 'http:')) {
      console.warn(
        '[supabase/TV] Prefer the public dashboard URL `https://<ref>.supabase.co`. Localhost/LAN or HTTP only work when the TV can route there (same Wi‑Fi, cleartext) — see docs/depts/tv.md#troubleshooting-network-request-failed.'
      );
    }
    if (u.protocol !== 'https:') {
      console.warn(
        '[supabase] Production and most device builds should use a public https:// Supabase URL, not cleartext http://'
      );
    }
  } catch {
    console.warn('[supabase] EXPO_PUBLIC_SUPABASE_URL is not a valid absolute URL');
  }
}

if (__DEV__ && isTvTarget()) {
  console.log('📺 TV App connecting to Supabase at:', rawEnvSupabaseUrl ?? '');
}

const webStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};

function getStorage() {
  if (typeof window === 'undefined') return webStorage;
  if (Platform.OS === 'web') return webStorage;
  return require('@react-native-async-storage/async-storage').default;
}

const storage = getStorage();

/**
 * Anon key identifies the Supabase project; PostgREST sends it as `apikey`.
 * After sign-in, `@supabase/supabase-js` attaches `Authorization: Bearer <access_token>`
 * so RLS policies (`auth.uid()`) apply. Use this client for all DB calls — avoid raw
 * `fetch` to REST without the session token.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Info': 'streamscape-supabase-js',
    },
  },
});
