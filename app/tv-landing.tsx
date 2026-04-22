import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, Stack, useRouter } from 'expo-router';
import { fetchTmdb } from '../lib/tmdbFetch';
import { shouldUseTvDpadFocus } from '../lib/isTv';

const TMDB_ORIGINAL = 'https://image.tmdb.org/t/p/original';
const BRAND = '#6366f1';

interface FeaturedMovie {
  title: string;
  overview: string;
  backdropUrl: string | null;
}

export default function TvLandingScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [featured, setFeatured] = useState<FeaturedMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tvFocus = shouldUseTvDpadFocus();

  useEffect(() => {
    if (!Platform.isTV) return;

    let cancelled = false;

    async function load() {
      const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
      if (!apiKey) {
        setError('TMDB API key not configured');
        setLoading(false);
        return;
      }

      try {
        const res = await fetchTmdb(
          '/trending/movie/day',
          { language: 'en-US' },
          apiKey
        );
        if (!res.ok) {
          setError(`TMDB error (${res.status})`);
          setLoading(false);
          return;
        }
        const data = (await res.json()) as {
          results?: Array<{
            title?: string;
            overview?: string;
            backdrop_path?: string | null;
          }>;
        };
        const m = data.results?.[0];
        if (cancelled) return;
        if (!m?.title) {
          setError('No trending movie');
          setLoading(false);
          return;
        }
        setFeatured({
          title: m.title,
          overview:
            typeof m.overview === 'string' && m.overview.trim()
              ? m.overview.trim()
              : 'Discover what’s streaming now.',
          backdropUrl: m.backdrop_path ? `${TMDB_ORIGINAL}${m.backdrop_path}` : null,
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const btnStyle = useCallback(
    (focused: boolean, pressed: boolean): ViewStyle[] => [
      styles.actionBtn,
      focused && styles.actionBtnFocused,
      pressed && styles.actionBtnPressed,
    ],
    []
  );

  /** RN types omit `focused` on TV; it is provided at runtime. */
  function tvBtnState(s: { pressed: boolean; focused?: boolean }) {
    return btnStyle(!!s.focused, s.pressed);
  }

  if (!Platform.isTV) {
    return <Redirect href="/" />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      <View style={styles.root} testID="tv-landing-root">
        {featured?.backdropUrl ? (
          <Image
            source={{ uri: featured.backdropUrl }}
            style={[StyleSheet.absoluteFill, styles.backdrop]}
            resizeMode="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.backdropFallback]} />
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', '#000000']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={BRAND} />
          </View>
        ) : error && !featured ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.bottomLeft,
                { maxWidth: width * 0.55, paddingBottom: height * 0.22 },
              ]}
            >
              <Text style={styles.featuredTitle} numberOfLines={2}>
                {featured?.title ?? 'ReelDive'}
              </Text>
              <Text style={styles.featuredOverview} numberOfLines={5}>
                {featured?.overview}
              </Text>
            </View>

            <View style={[styles.actionsRow, { paddingHorizontal: width * 0.06 }]}>
              <Pressable
                {...(tvFocus ? { focusable: true, hasTVPreferredFocus: true } : {})}
                onPress={() => router.replace('/(tabs)')}
                style={tvBtnState}
              >
                <Text style={styles.actionLabel}>Explore Library</Text>
              </Pressable>
              <Pressable
                {...(tvFocus ? { focusable: true } : {})}
                onPress={() => router.push('/search')}
                style={tvBtnState}
              >
                <Text style={styles.actionLabel}>Search</Text>
              </Pressable>
              <Pressable
                {...(tvFocus ? { focusable: true } : {})}
                onPress={() => router.push('/(tabs)/profile')}
                style={tvBtnState}
              >
                <Text style={styles.actionLabel}>Settings</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    width: '100%',
    minHeight: '100%',
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  backdropFallback: {
    backgroundColor: '#121212',
  },
  centered: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 16,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  bottomLeft: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    paddingLeft: '6%',
    paddingRight: 16,
    zIndex: 2,
  },
  featuredTitle: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  featuredOverview: {
    color: '#e5e7eb',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  actionsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '5%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 20,
    zIndex: 3,
  },
  actionBtn: {
    minWidth: 200,
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnFocused: {
    backgroundColor: BRAND,
    borderColor: BRAND,
    transform: [{ scale: 1.1 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 14,
  },
  actionBtnPressed: {
    opacity: 0.92,
  },
  actionLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
});
