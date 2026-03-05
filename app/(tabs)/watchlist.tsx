import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { MovieCard, type Movie } from '../../components/MovieCard';

export default function WatchlistScreen() {
  const router = useRouter();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        setLoading(false);
        return;
      }
      fetchWatchlist(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          fetchWatchlist(session.user.id);
        } else {
          setMovies([]);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchWatchlist(userId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from('watchlist')
      .select(`
        media_id,
        media (id, title, poster_url, release_year)
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Watchlist fetch error:', error);
      setMovies([]);
    } else {
      const list = (data ?? [])
        .map((row: { media: unknown }) => row.media)
        .filter(Boolean)
        .map((m: { id: string; title: string; poster_url: string | null; release_year: number | null }) => ({
          id: m.id,
          title: m.title,
          poster_url: m.poster_url,
          release_year: m.release_year,
        }));
      setMovies(list);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>My Watchlist</Text>
        <Text style={styles.subtitle}>Sign in to save movies and shows</Text>
        <Pressable
          style={styles.button}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.buttonText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>My Watchlist</Text>
        <Text style={styles.subtitle}>
          {movies.length} {movies.length === 1 ? 'movie' : 'movies'} saved
        </Text>
        <Pressable
          style={styles.signOutButton}
          onPress={() => supabase.auth.signOut()}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>

      {movies.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Your watchlist is empty</Text>
          <Text style={styles.emptySubtext}>
            Search for a movie and tap "Add to Watchlist" to save it
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {movies.map((movie) => (
            <View key={movie.id} style={styles.cardWrapper}>
              <MovieCard
                movie={movie}
                onPress={() => router.push(`/movie/${movie.id}`)}
              />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  signOutButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  signOutText: {
    color: '#6b7280',
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    color: '#9ca3af',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  cardWrapper: {
    marginBottom: 8,
  },
});
