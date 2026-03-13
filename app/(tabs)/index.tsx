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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MovieCard, type Movie } from '../../components/MovieCard';
import { SearchResultsOverlay } from '../../components/SearchResultsOverlay';
import { useWatchlistStatus } from '../../lib/watchlist-status-context';
import { useCountry } from '../../lib/country-context';
import { useSearch } from '../../lib/search-context';
import { HomeHeader } from '../../components/HomeHeader';
import { supabase } from '../../lib/supabase';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

const HEADER_AND_TAB_HEIGHT = 120;

interface TrendingMovie extends Movie {
  backdrop_url: string | null;
}

export default function HomeScreen() {
  const router = useRouter();
  const status = useWatchlistStatus();
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
  const { height: screenHeight } = Dimensions.get('window');
  const availableHeight = screenHeight - HEADER_AND_TAB_HEIGHT;
  const halfHeight = availableHeight * 0.5;
  const { selectedCountry } = useCountry();
  const {
    isSearching,
    searchResult,
    searchError,
    searchLoading,
    setIsSearching,
    setSearchResult,
    setSearchError,
  } = useSearch();
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

  const handleMoviePress = (movie: Movie) => {
    setIsSearching(false);
    setSearchResult(null);
    setSearchError(null);
  };

  const showSearchOverlay = isSearching && (searchResult || searchError || searchLoading);

  // Auth guard: blackout when not logged in (immediate effect on signOut)
  if (!session) {
    return (
      <View style={styles.blackout}>
        <Text style={styles.blackoutBrand}>StreamScape</Text>
        <Pressable
          style={styles.blackoutButton}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.blackoutButtonText}>Log In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.safeHeader}>
        <HomeHeader
          session={session}
          onLogout={handleLogout}
          onLogin={() => router.push('/login')}
        />
      </SafeAreaView>
      <View style={styles.mainContainer}>
        {/* Top Half: Hero #1 Trending */}
        {trendingLoading ? (
          <View style={[styles.heroSkeleton, { height: halfHeight }]}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.heroSkeletonText}>Loading trending for your region...</Text>
          </View>
        ) : heroMovie ? (
          <TouchableOpacity
            style={[styles.heroContainer, styles.heroTouchable, { height: halfHeight }]}
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

        {/* Bottom Half: Trending Now #2–#10 */}
        {trendingLoading ? (
          <View style={[styles.bottomHalf, { height: halfHeight }]} />
        ) : restTrending.length > 0 ? (
          <View style={[styles.bottomHalf, { height: halfHeight }]}>
            <Text style={styles.sectionTitle}>Trending Now</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendingScroll}
            >
              {restTrending.map((movie) => (
                <View key={movie.id} style={styles.trendingCard}>
                  <MovieCard
                    movie={movie}
                    onPress={() => handleMoviePress(movie)}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={[styles.bottomHalf, { height: halfHeight }]}>
            <Text style={styles.trendingEmpty}>
              {trending.length === 0 ? 'Could not load trending movies' : 'No more trending'}
            </Text>
          </View>
        )}
      </View>

      {showSearchOverlay && (
        <SearchResultsOverlay
          searchLoading={searchLoading}
          searchError={searchError}
          searchResult={searchResult}
          onResultPress={handleMoviePress}
          onDismiss={() => {
            Keyboard.dismiss();
            setIsSearching(false);
            setSearchResult(null);
            setSearchError(null);
          }}
        />
      )}
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
  mainContainer: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  bottomHalf: {
    paddingTop: 16,
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
    marginBottom: 16,
  },
  heroSkeletonText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  heroContainer: {
    borderRadius: 16,
    marginBottom: 16,
    position: 'relative',
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
  trendingScroll: {
    gap: 12,
    paddingRight: 20,
  },
  trendingCard: {
    width: 130,
  },
  trendingEmpty: {
    fontSize: 14,
    color: '#6b7280',
  },
});
