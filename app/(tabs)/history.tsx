import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

interface HistoryMovie {
  id: string;
  tmdb_id: number;
  title: string;
  poster_url: string | null;
  watched_at: string;
}

function formatWatchedDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function HistoryScreen() {
  const router = useRouter();
  const [movies, setMovies] = useState<HistoryMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const hasFetchedOnce = useRef(false);

  const fetchHistory = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('watched_history')
      .select('id, tmdb_id, title, poster_url, watched_at')
      .eq('user_id', userId)
      .order('watched_at', { ascending: false });

    if (error) {
      console.error('History fetch error:', error);
      setMovies([]);
    } else {
      setMovies((data ?? []) as HistoryMovie[]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        const { data: { session: s } } = await supabase.auth.getSession();
        setSession(s);
        if (s) {
          const isInitial = !hasFetchedOnce.current;
          if (isInitial) setLoading(true);
          await fetchHistory(s.user.id);
          hasFetchedOnce.current = true;
        } else {
          setMovies([]);
        }
        setLoading(false);
      };
      run();
    }, [fetchHistory])
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        if (!s) {
          setMovies([]);
          hasFetchedOnce.current = false;
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const onRefresh = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    await fetchHistory(session.user.id);
    setRefreshing(false);
  }, [session, fetchHistory]);

  const handleMoviePress = useCallback(
    (item: HistoryMovie) => {
      router.push(`/movie/${item.tmdb_id}`);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: HistoryMovie }) => (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => handleMoviePress(item)}
      >
        {item.poster_url ? (
          <Image
            source={{ uri: item.poster_url }}
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
            {item.title}
          </Text>
          <Text style={styles.watchedDate}>
            Watched on {formatWatchedDate(item.watched_at)}
          </Text>
        </View>
      </Pressable>
    ),
    [handleMoviePress]
  );

  const ListEmptyComponent = useCallback(
    () =>
      !loading && !session ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Your history awaits</Text>
          <Text style={styles.emptySubtext}>
            Tap "Sign In" in the top-right to get started
          </Text>
        </View>
      ) : !loading && movies.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No movies watched yet</Text>
          <Text style={styles.emptySubtext}>
            Start tracking your cinematic journey!
          </Text>
        </View>
      ) : null,
    [loading, session, movies.length]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.wrapper}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrapper}>
      <FlatList
        data={movies}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.content,
          movies.length === 0 && styles.contentEmpty,
        ]}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={
          session ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6366f1"
            />
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  contentEmpty: {
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 80,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    marginBottom: 8,
  },
  rowPressed: {
    opacity: 0.8,
  },
  thumbnail: {
    width: 44,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#2d2d2d',
  },
  thumbnailPlaceholder: {
    width: 44,
    height: 56,
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
    minWidth: 0,
  },
  movieTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  watchedDate: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
});
