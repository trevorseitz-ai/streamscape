import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (__DEV__ && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    '[supabase] Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY — RLS requires a valid anon key and a signed-in session (JWT) on each request.'
  );
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
      'X-Client-Info': 'streamscape-supabase-js',
    },
  },
});
