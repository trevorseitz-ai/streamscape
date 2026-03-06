import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { MovieCard, type Movie } from '../../components/MovieCard';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<Movie | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    Keyboard.dismiss();
    setLoading(true);
    setSearchResult(null);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const baseUrl =
        Platform.OS === 'web'
          ? typeof window !== 'undefined'
            ? window.location.origin
            : ''
          : process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8081';
      const url = `${baseUrl || ''}/api/search?q=${encodeURIComponent(trimmed)}`;

      const res = await fetch(url, { method: 'POST', signal: controller.signal });
      clearTimeout(timeoutId);

      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        setError(res.ok ? 'Invalid response from server' : `Request failed (${res.status})`);
        return;
      }

      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : `Request failed (${res.status})`;
        setError(msg);
        return;
      }

      if (data.error) {
        setError(typeof data.error === 'string' ? data.error : 'Unknown error');
        return;
      }

      const mediaId = data.mediaId;
      if (!mediaId) {
        setError('No media ID returned');
        return;
      }

      const { data: media, error: fetchError } = await supabase
        .from('media')
        .select('id, title, poster_url, release_year')
        .eq('id', mediaId)
        .single();

      if (fetchError || !media) {
        setError(fetchError?.message ?? 'Could not load movie');
        return;
      }

      setSearchResult({
        id: media.id,
        title: media.title,
        poster_url: media.poster_url,
        release_year: media.release_year,
      });
    } catch (err) {
      console.error('Search error:', err);
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trending</Text>
        <View style={styles.placeholderGrid}>
          <View style={styles.placeholderCard} />
          <View style={styles.placeholderCard} />
          <View style={styles.placeholderCard} />
          <View style={styles.placeholderCard} />
        </View>
      </View>
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
  placeholderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  placeholderCard: {
    width: '47%',
    aspectRatio: 2 / 3,
    backgroundColor: '#1f1f1f',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
});
