import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fetchTmdb } from '../../lib/tmdbFetch';
import { getMetroDevServerOrigin, getMetroNetworkSetupHints } from '../../lib/metroOrigin';
import { tvFocusable } from '../../lib/tvFocus';

/**
 * Dev-only: run the same fetches the app uses (TMDB HTTPS, Metro HTTP, Supabase HTTPS)
 * without relying on the TV system browser or keyboard.
 */
export default function NetworkDiagnosticsScreen() {
  const router = useRouter();
  const [output, setOutput] = useState<string>('Tap “Run checks” to test from this app.');
  const [running, setRunning] = useState(false);

  const runChecks = useCallback(async () => {
    setRunning(true);
    try {
      const lines: string[] = [];
      const metro = getMetroDevServerOrigin();
      lines.push(`Packager origin (Expo API routes): ${metro}`);
      lines.push(`Platform: ${Platform.OS}`);

      const tmdbKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
      if (!tmdbKey) {
        lines.push('TMDB: skipped (set EXPO_PUBLIC_TMDB_API_KEY)');
      } else {
        try {
          const res = await fetchTmdb('/configuration', {}, tmdbKey);
          lines.push(`TMDB GET /configuration: HTTP ${res.status}${res.ok ? ' — OK' : ''}`);
        } catch (e) {
          lines.push(`TMDB: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      try {
        const ac = new AbortController();
        const tid = setTimeout(() => ac.abort(), 10000);
        const res = await fetch(`${metro}/`, { method: 'GET', signal: ac.signal });
        clearTimeout(tid);
        lines.push(`Metro GET ${metro}/: HTTP ${res.status} (dev server reachable)`);
      } catch (e) {
        lines.push(
          `Metro: ${e instanceof Error ? e.message : String(e)} — is “npm run dev” running?`
        );
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/$/, '');
      const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
      if (supabaseUrl) {
        try {
          const headers: Record<string, string> = { Accept: 'application/json' };
          if (anon) headers.apikey = anon;
          const res = await fetch(`${supabaseUrl}/auth/v1/health`, { headers });
          lines.push(`Supabase GET /auth/v1/health: HTTP ${res.status}`);
        } catch (e) {
          lines.push(`Supabase: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        lines.push('Supabase: skipped (set EXPO_PUBLIC_SUPABASE_URL)');
      }

      lines.push('');
      lines.push('— Setup hints (physical TV / dev server) —');
      lines.push(getMetroNetworkSetupHints());

      setOutput(lines.join('\n'));
    } catch (e) {
      setOutput(
        `Checks crashed: ${e instanceof Error ? e.message : String(e)}\n\n` +
          'This text means an unexpected error — not a normal network failure.'
      );
    } finally {
      setRunning(false);
    }
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.topBar}>
          <Pressable
            {...tvFocusable()}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color="#a5b4fc" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Network checks</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint}>
            Runs inside ReelDive — no TV browser or keyboard. Use after “Network request failed”
            to see whether TMDB, Metro, or Supabase is unreachable from the device.
          </Text>

          <Pressable
            {...tvFocusable()}
            onPress={runChecks}
            disabled={running}
            style={({ pressed }) => [styles.primaryBtn, pressed && !running && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Run network checks"
          >
            {running ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Run checks</Text>
            )}
          </Pressable>

          <View style={styles.outBox}>
            <Text style={styles.outText} selectable>
              {output}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d2d',
    gap: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    color: '#a5b4fc',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  hint: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  outBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  outText: {
    color: '#e5e7eb',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
  },
});
