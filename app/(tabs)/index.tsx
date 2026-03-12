import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Keyboard,
} from 'react-native';
import { MovieCard, type Movie } from '../../components/MovieCard';
import { useRouter } from 'expo-router';
import { useCountry } from '../../lib/country-context';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

interface TrendingMovie extends Movie {
  backdrop_url: string | null;
}

export default function HomeScreen() {
  const router = useRouter();
  const { selectedCountry } = useCountry();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<Movie | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    Keyboard.dismiss();
    setLoading(true);
    setSearchResult(null);
    setError(null);

    const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
    if (!apiKey) {
      setError('TMDB API key not configured');
      setLoading(false);
      return;
    }

    console.log('Using Key:', process.env.EXPO_PUBLIC_TMDB_API_KEY?.slice(0, 5) + '...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const searchUrl = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(trimmed)}&language=en-US`;

      const res = await fetch(searchUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const responseText = await res.text();

      let data: { results?: Array<{ id: number; title: string; poster_path: string | null; release_date?: string; vote_average?: number }> };
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseErr) {
        console.error('[Search] Invalid JSON response:', {
          status: res.status,
          statusText: res.statusText,
          url: searchUrl,
          bodyPreview: responseText.slice(0, 200),
          parseError: parseErr,
        });
        setError(res.ok ? 'Invalid response from server' : `Request failed (${res.status})`);
        return;
      }

      if (!res.ok) {
        const errData = (data as Record<string, unknown>)?.status_message ?? (data as Record<string, unknown>)?.error;
        console.error('[Search] Non-OK response:', {
          status: res.status,
          statusText: res.statusText,
          data: errData,
        });
        setError(typeof errData === 'string' ? errData : `Request failed (${res.status})`);
        return;
      }

      const movie = data.results?.[0];
      if (!movie) {
        setError('No results found');
        return;
      }

      const releaseYear = movie.release_date
        ? parseInt(movie.release_date.slice(0, 4), 10)
        : null;

      setSearchResult({
        id: String(movie.id),
        title: movie.title,
        poster_url: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
        release_year: releaseYear,
        vote_average: movie.vote_average ?? null,
      });
    } catch (err) {
      console.error('[Search] Error:', {
        error: err,
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : undefined,
      });
      if (err instanceof Error) {
        setError(err.name === 'AbortError' ? 'Request timed out. Try again.' : err.message);
      } else {
        setError('Request failed');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleMoviePress = (movie: Movie) => {
    router.push(`/movie/${movie.id}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>StreamScape</Text>
        <Text style={styles.subtitle}>Find where to stream it</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search movies, shows, actors..."
          placeholderTextColor="#6b7280"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          editable={!loading}
        />
      </View>

      {loading && (
        <View style={styles.resultBox}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.resultText}>Searching...</Text>
        </View>
      )}

      {error ? (
        !loading ? (
          <View style={styles.resultBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null
      ) : null}

      {searchResult && !loading && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search Result</Text>
          <View style={styles.resultRow}>
            <MovieCard
              movie={searchResult}
              onPress={() => handleMoviePress(searchResult)}
            />
          </View>
        </View>
      )}

      {/* Hero: #1 Trending */}
      {trendingLoading ? (
        <View style={styles.heroSkeleton}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.heroSkeletonText}>Loading trending for your region...</Text>
        </View>
      ) : heroMovie ? (
        <Pressable
          style={({ pressed }) => [
            styles.heroContainer,
            pressed && styles.heroPressed,
          ]}
          onPress={() => handleMoviePress(heroMovie)}
        >
          {heroMovie.backdrop_url ? (
            <Image
              source={{ uri: heroMovie.backdrop_url }}
              style={styles.heroBackdrop}
              resizeMode="cover"
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
        </Pressable>
      ) : null}

      {/* Trending Now: #2–#10 */}
      {!trendingLoading && restTrending.length > 0 ? (
        <View style={styles.section}>
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
      ) : !trendingLoading && trending.length === 0 ? (
        <View style={styles.section}>
          <Text style={styles.trendingEmpty}>
            Could not load trending movies
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 4,
  },
  searchContainer: {
    marginBottom: 32,
  },
  searchInput: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  resultBox: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    alignItems: 'center',
  },
  resultText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
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
  resultRow: {
    flexDirection: 'row',
    width: 120,
  },
  heroSkeleton: {
    height: 280,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  heroSkeletonText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  heroContainer: {
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 28,
    position: 'relative',
  },
  heroPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
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
