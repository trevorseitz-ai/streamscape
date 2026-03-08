import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

interface WatchlistMovie {
  watchlistId: string;
  sortOrder: number;
  id: string;
  tmdb_id: number | null;
  title: string;
  poster_url: string | null;
  release_year: number | null;
}

export default function WatchlistScreen() {
  const router = useRouter();
  const [movies, setMovies] = useState<WatchlistMovie[]>([]);
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
      .select('id, sort_order, media_id, media (id, tmdb_id, title, poster_url, release_year)')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('added_at', { ascending: true });

    if (error) {
      console.error('Watchlist fetch error:', error);
      setMovies([]);
    } else {
      const list: WatchlistMovie[] = (data ?? [])
        .map((row: Record<string, unknown>, index: number) => {
          const m = row.media as Record<string, unknown> | null;
          if (!m) return null;
          return {
            watchlistId: row.id as string,
            sortOrder: (row.sort_order as number) ?? index,
            id: m.id as string,
            tmdb_id: (m.tmdb_id as number | null) ?? null,
            title: m.title as string,
            poster_url: (m.poster_url as string | null) ?? null,
            release_year: (m.release_year as number | null) ?? null,
          };
        })
        .filter((m): m is WatchlistMovie => m !== null);
      setMovies(list);
    }
    setLoading(false);
  }

  const syncOrder = useCallback(
    (items: WatchlistMovie[]) => {
      if (!session) return;

      const baseUrl =
        Platform.OS === 'web'
          ? typeof window !== 'undefined'
            ? window.location.origin
            : ''
          : process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8081';

      fetch(`${baseUrl}/api/watchlist-reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          items: items.map((m) => ({
            id: m.watchlistId,
            sort_order: m.sortOrder,
          })),
        }),
      }).catch((err) => console.error('Reorder sync error:', err));
    },
    [session]
  );

  const moveItem = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= movies.length) return;

      const updated = [...movies];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      updated.forEach((m, i) => {
        m.sortOrder = i;
      });

      setMovies(updated);
      syncOrder(updated);
    },
    [movies, syncOrder]
  );

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
        <Ionicons name="list" size={48} color="#2d2d2d" />
        <Text style={styles.emptyText}>Your watchlist awaits</Text>
        <Text style={styles.emptySubtext}>
          Tap "Sign In" in the top-right to get started
        </Text>
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
        <Text style={styles.subtitle}>
          {movies.length} {movies.length === 1 ? 'movie' : 'movies'} saved
        </Text>
      </View>

      {movies.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Your watchlist is empty</Text>
          <Text style={styles.emptySubtext}>
            Search for a movie and tap "Add to Watchlist" to save it
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {movies.map((movie, index) => (
            <Pressable
              key={movie.watchlistId}
              style={styles.row}
              onPress={() =>
                router.push(
                  `/movie/${movie.tmdb_id ?? movie.id}`
                )
              }
            >
              <Text style={styles.rank}>{index + 1}</Text>

              {movie.poster_url ? (
                <Image
                  source={{ uri: movie.poster_url }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <Text style={styles.thumbnailPlaceholderText}>?</Text>
                </View>
              )}

              <View style={styles.movieInfo}>
                <Text style={styles.movieTitle} numberOfLines={2}>
                  {movie.title}
                </Text>
                {movie.release_year != null ? (
                  <Text style={styles.movieYear}>{movie.release_year}</Text>
                ) : null}
              </View>

              <View style={styles.arrows}>
                {index > 0 ? (
                  <Pressable
                    style={styles.arrowButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      moveItem(index, 'up');
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="chevron-up" size={22} color="#a5b4fc" />
                  </Pressable>
                ) : (
                  <View style={styles.arrowSpacer} />
                )}
                {index < movies.length - 1 ? (
                  <Pressable
                    style={styles.arrowButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      moveItem(index, 'down');
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="chevron-down" size={22} color="#a5b4fc" />
                  </Pressable>
                ) : (
                  <View style={styles.arrowSpacer} />
                )}
              </View>
            </Pressable>
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
    paddingTop: 16,
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
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
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
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  rank: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366f1',
    width: 28,
    textAlign: 'center',
  },
  thumbnail: {
    width: 44,
    height: 66,
    borderRadius: 6,
    backgroundColor: '#2d2d2d',
  },
  thumbnailPlaceholder: {
    width: 44,
    height: 66,
    borderRadius: 6,
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    fontSize: 16,
    color: '#6b7280',
  },
  movieInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  movieTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  movieYear: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  arrows: {
    gap: 4,
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1e1b4b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowSpacer: {
    width: 36,
    height: 36,
  },
});
