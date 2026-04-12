import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  Keyboard,
  Platform,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MovieCard, type Movie } from '../../components/MovieCard';
import { useWatchlistStatus } from '../../lib/watchlist-status-context';
import { useCountry } from '../../lib/country-context';
import { useSearch } from '../../lib/search-context';
import { HomeHeader } from '../../components/HomeHeader';
import { isTvTarget } from '../../lib/isTv';
import { supabase } from '../../lib/supabase';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

interface TrendingMovie extends Movie {
  backdrop_url: string | null;
}

const MAIN_HORIZONTAL_PADDING = 20;
const TRENDING_GAP = 10;

export default function HomeScreen() {
  const router = useRouter();
  const status = useWatchlistStatus();
  const { width, height } = useWindowDimensions();
  const isTV = isTvTarget();
  const windowWidth = Dimensions.get('window').width;
  const screenBg = isTV ? '#121212' : '#0f0f0f';
  const horizontalPad = isTV
    ? Math.min(80, Math.max(48, windowWidth * 0.04))
    : MAIN_HORIZONTAL_PADDING;
  const heroHeight = height * (isTV ? 0.45 : 0.4);
  const [session, setSession] = useState<{ user: { id: string; email?: string } } | null>(null);

  const handleLogout = useCallback(() => {
    supabase.auth.signOut();
  }, []);

  useFocusEffect(
    useCallback(() => {
      status?.refetch();
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s);
      });
    }, [status])
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => setSession(s)
    );
    return () => subscription.unsubscribe();
  }, []);
  const { selectedCountry } = useCountry();
  const { setSearchResult, setSearchError } = useSearch();
  const [trending, setTrending] = useState<TrendingMovie[]>([]);

  const [trendingLoading, setTrendingLoading] = useState(true);

  useEffect(() => {
    async function fetchTrending() {
      setTrendingLoading(true);
      const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
      if (!apiKey) {
        setTrendingLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `${TMDB_BASE}/trending/movie/day?language=en-US&region=${selectedCountry}`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        if (!res.ok) throw new Error(`TMDB error ${res.status}`);
        const data = await res.json();

        const movies: TrendingMovie[] = (data.results ?? [])
          .slice(0, 10)
          .map((m: { id: number; title: string; poster_path: string | null; backdrop_path: string | null; release_date?: string; vote_average?: number }) => ({
            id: String(m.id),
            title: m.title,
            poster_url: m.poster_path ? `${TMDB_IMAGE_BASE}${m.poster_path}` : null,
            backdrop_url: m.backdrop_path ? `${TMDB_IMAGE_BASE}${m.backdrop_path}` : null,
            release_year: m.release_date
              ? parseInt(m.release_date.slice(0, 4), 10)
              : null,
            vote_average: m.vote_average ?? null,
          }));

        setTrending(movies);
      } catch (err) {
        console.error('Trending fetch error:', err);
      } finally {
        setTrendingLoading(false);
      }
    }

    fetchTrending();
  }, [selectedCountry]);

  const heroMovie = trending.length > 0 ? trending[0] : null;
  const restTrending = trending.slice(1);

  /** Grid: more columns on TV / large screens; 3 on wide phones, 2 on narrow. */
  const gridColumnCount = isTV
    ? Math.min(8, Math.max(4, Math.floor((width - horizontalPad * 2) / 200)))
    : width >= 430
      ? 3
      : 2;
  const trendingContentWidth = width - horizontalPad * 2;
  const trendingCardWidth =
    (trendingContentWidth - TRENDING_GAP * (gridColumnCount - 1)) / gridColumnCount;

  const handleMoviePress = (movie: Movie) => {
    Keyboard.dismiss();
    setSearchResult(null);
    setSearchError(null);
  };

  // Auth guard: blackout when not logged in (immediate effect on signOut)
  if (!session) {
    return (
      <View style={styles.blackout}>
        <Text style={styles.blackoutBrand}>ReelDive</Text>
        <Pressable
          style={styles.blackoutButton}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.blackoutButtonText}>Log In</Text>
        </Pressable>
      </View>
    );
  }

  const HeaderWrapper =
    Platform.OS === 'web' || isTV ? View : SafeAreaView;

  return (
    <View
      style={[
        styles.wrapper,
        { backgroundColor: screenBg },
        isTV && { width: windowWidth, alignSelf: 'stretch' },
      ]}
    >
      <HeaderWrapper style={[styles.safeHeader, { backgroundColor: screenBg }]}>
        <HomeHeader
          session={session}
          onLogout={handleLogout}
          onLogin={() => router.push('/login')}
        />
      </HeaderWrapper>
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[
          styles.mainContentContainer,
          { paddingHorizontal: horizontalPad },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero #1 Trending */}
        {trendingLoading ? (
          <View style={[styles.heroSkeleton, { height: heroHeight }]}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.heroSkeletonText}>Loading trending for your region...</Text>
          </View>
        ) : heroMovie ? (
          <TouchableOpacity
            style={[styles.heroContainer, styles.heroTouchable, { height: heroHeight }]}
            onPress={() => {
              handleMoviePress(heroMovie);
              router.push(`/movie/${heroMovie.id}`);
            }}
            activeOpacity={0.9}
          >
            {heroMovie.backdrop_url ? (
              <Image
                source={{ uri: heroMovie.backdrop_url }}
                style={styles.heroBackdrop}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.heroBackdropPlaceholder} />
            )}
            <View style={styles.heroOverlay} />
            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>#1 Trending Today</Text>
              </View>
              <Text style={styles.heroTitle}>{heroMovie.title}</Text>
              <View style={styles.heroMeta}>
                {heroMovie.release_year != null ? (
                  <Text style={styles.heroYear}>{heroMovie.release_year}</Text>
                ) : null}
                {heroMovie.vote_average != null ? (
                  <View style={styles.heroRating}>
                    <Text style={styles.heroRatingStar}>★</Text>
                    <Text style={styles.heroRatingText}>
                      {(Math.round(heroMovie.vote_average * 10) / 10).toFixed(1)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.heroButton}>
                <Text style={styles.heroButtonText}>View Details</Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Trending Now #2–#10 */}
        {trendingLoading ? (
          <View style={styles.bottomHalf} />
        ) : restTrending.length > 0 ? (
          <View style={styles.bottomHalf}>
            <Text style={styles.sectionTitle}>Trending Now</Text>
            <View style={styles.trendingGrid}>
              {restTrending.map((movie) => (
                <View key={movie.id} style={{ width: trendingCardWidth }}>
                  <MovieCard
                    movie={movie}
                    onPress={() => handleMoviePress(movie)}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.bottomHalf}>
            <Text style={styles.trendingEmpty}>
              {trending.length === 0 ? 'Could not load trending movies' : 'No more trending'}
            </Text>
          </View>
        )}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  blackout: {
    flex: 1,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  blackoutBrand: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 32,
  },
  blackoutButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  blackoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  wrapper: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  mainScroll: {
    flex: 1,
  },
  mainContentContainer: {
    paddingTop: 12,
    paddingBottom: 40,
  },
  bottomHalf: {
    flex: 1,
    paddingTop: 12,
  },
  safeHeader: {
    backgroundColor: '#0f0f0f',
    zIndex: 10,
    elevation: 10,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  heroSkeleton: {
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroSkeletonText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  heroContainer: {
    borderRadius: 16,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  heroTouchable: {
    zIndex: 10,
  },
  heroBackdrop: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroBackdropPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  heroContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 20,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#6366f1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  heroYear: {
    fontSize: 14,
    color: '#d1d5db',
    fontWeight: '500',
  },
  heroRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroRatingStar: {
    fontSize: 13,
    color: '#facc15',
  },
  heroRatingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  heroButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  heroButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  trendingGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: TRENDING_GAP,
  },
  trendingEmpty: {
    fontSize: 14,
    color: '#6b7280',
  },
});
