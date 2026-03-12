import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useCountry } from '../../lib/country-context';
import { useSearch } from '../../lib/search-context';
import { SearchResultsOverlay } from '../../components/SearchResultsOverlay';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w92';

interface WatchlistMovie {
  watchlistId: string;
  sortOrder: number;
  id: string;
  tmdb_id: number | null;
  title: string;
  poster_url: string | null;
  release_year: number | null;
}

interface ProviderLogo {
  provider_id: number;
  logo_url: string;
}

export default function WatchlistScreen() {
  const router = useRouter();
  const { selectedCountry } = useCountry();
  const {
    isSearching,
    query,
    searchResult,
    searchError,
    searchLoading,
    setIsSearching,
    setSearchResult,
    setSearchError,
  } = useSearch();
  const [movies, setMovies] = useState<WatchlistMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderSaving, setOrderSaving] = useState(false);
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [providerLogos, setProviderLogos] = useState<Record<number, ProviderLogo[]>>({});

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

  useEffect(() => {
    const tmdbIds = movies
      .map((m) => m.tmdb_id)
      .filter((id): id is number => id != null);

    if (tmdbIds.length === 0) {
      setProviderLogos({});
      return;
    }

    const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
    if (!apiKey) {
      setProviderLogos({});
      return;
    }

    let cancelled = false;
    const logos: Record<number, ProviderLogo[]> = {};

    Promise.all(
      tmdbIds.map(async (tmdbId) => {
        if (cancelled) return;
        try {
          const res = await fetch(
            `${TMDB_BASE}/movie/${tmdbId}/watch/providers`,
            { headers: { Authorization: `Bearer ${apiKey}` } }
          );
          if (!res.ok) return;
          const data = await res.json();
          const countryData = data.results?.[selectedCountry];
          const flatrate = countryData?.flatrate ?? [];
          const list: ProviderLogo[] = flatrate.map(
            (p: { provider_id: number; logo_path: string | null }) => ({
              provider_id: p.provider_id,
              logo_url: p.logo_path
                ? `${TMDB_IMAGE_BASE}${p.logo_path}`
                : '',
            })
          );
          logos[tmdbId] = list.filter((p) => p.logo_url);
        } catch {
          logos[tmdbId] = [];
        }
      })
    ).then(() => {
      if (!cancelled) setProviderLogos(logos);
    });

    return () => {
      cancelled = true;
    };
  }, [movies, selectedCountry]);

  async function fetchWatchlist(userId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from('watchlist')
      .select('id, sort_order, order_index, watched, media_id, media (id, tmdb_id, title, poster_url, release_year)')
      .eq('user_id', userId)
      .eq('watched', false)
      .order('order_index', { ascending: true, nullsFirst: false })
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
            sortOrder: (row.order_index as number) ?? (row.sort_order as number) ?? index,
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

  const updateDatabaseOrder = useCallback(
    async (reorderedList: WatchlistMovie[]) => {
      if (!session) return;

      setOrderSaving(true);
      try {
        await Promise.all(
          reorderedList.map((item, index) =>
            supabase
              .from('watchlist')
              .update({ order_index: index })
              .eq('id', item.watchlistId)
              .eq('user_id', session.user.id)
          )
        );
      } catch (err) {
        console.error('Reorder sync error:', err);
      } finally {
        setOrderSaving(false);
      }
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
      updateDatabaseOrder(updated);
    },
    [movies, updateDatabaseOrder]
  );

  const handleWatched = useCallback(
    async (watchlistId: string, movie: WatchlistMovie) => {
      if (!session) return;

      setMovies((prev) => prev.filter((m) => m.watchlistId !== watchlistId));

      try {
        if (movie.tmdb_id == null) {
          throw new Error('Movie has no TMDB ID');
        }

        const { error: insertError } = await supabase
          .from('watched_history')
          .insert({
            user_id: session.user.id,
            tmdb_id: movie.tmdb_id,
            title: movie.title,
            poster_url: movie.poster_url ?? null,
          });

        if (insertError) throw insertError;

        const { error: deleteError } = await supabase
          .from('watchlist')
          .delete()
          .eq('id', watchlistId)
          .eq('user_id', session.user.id);

        if (deleteError) throw deleteError;
      } catch (err) {
        console.error('Watched error:', err);
        fetchWatchlist(session.user.id);
        Alert.alert(
          'Could not mark as watched',
          'Failed to save. Please try again.'
        );
      }
    },
    [session]
  );

  const filteredMovies = useMemo(() => {
    if (!isSearching || !query.trim()) return movies;
    const q = query.trim().toLowerCase();
    return movies.filter((m) => m.title.toLowerCase().includes(q));
  }, [movies, isSearching, query]);

  const handleMoviePress = useCallback(
    (movie: { id: string; tmdb_id: number | null }) => {
      setIsSearching(false);
      setSearchResult(null);
      setSearchError(null);
      router.push(`/movie/${movie.tmdb_id ?? movie.id}`);
    },
    [router, setIsSearching, setSearchResult, setSearchError]
  );

  const handleRemove = useCallback(
    async (watchlistId: string) => {
      if (!session) return;

      setMovies((prev) => prev.filter((m) => m.watchlistId !== watchlistId));

      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('id', watchlistId)
        .eq('user_id', session.user.id);

      if (error) {
        console.error('Watchlist remove error:', error);
        fetchWatchlist(session.user.id);
        Alert.alert(
          'Could not remove',
          'Failed to remove from watchlist. Please try again.'
        );
      }
    },
    [session]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const showSearchOverlay =
    isSearching && (searchResult || searchError || searchLoading);

  if (!session) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.center}>
          <Ionicons name="list" size={48} color="#2d2d2d" />
          <Text style={styles.emptyText}>Your watchlist awaits</Text>
          <Text style={styles.emptySubtext}>
            Tap "Sign In" in the top-right to get started
          </Text>
        </View>
        {showSearchOverlay && (
          <SearchResultsOverlay
            searchLoading={searchLoading}
            searchError={searchError}
            searchResult={searchResult}
            onResultPress={(m) =>
              handleMoviePress({ id: m.id, tmdb_id: Number(m.id) })
            }
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

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.subtitle}>
            {movies.length} {movies.length === 1 ? 'movie' : 'movies'} saved
          </Text>
          {orderSaving ? (
            <View style={styles.savingOrderBanner}>
              <ActivityIndicator size="small" color="#6366f1" />
              <Text style={styles.savingOrderText}>Saving order...</Text>
            </View>
          ) : null}
        </View>

        {movies.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Your watchlist is empty</Text>
          <Text style={styles.emptySubtext}>
            Search for a movie and tap "Add to Watchlist" to save it
          </Text>
        </View>
      ) : filteredMovies.length === 0 && query.trim() ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No matches in your watchlist</Text>
          <Text style={styles.emptySubtext}>
            Try "Search Global" to find it on TMDB
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filteredMovies.map((movie, index) => (
            <Pressable
              key={movie.watchlistId}
              style={styles.row}
              onPress={() =>
                router.push(
                  `/movie/${movie.tmdb_id ?? movie.id}`
                )
              }
            >
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

              <View style={styles.providerIcons}>
                {movie.tmdb_id != null && (providerLogos[movie.tmdb_id] ?? []).length > 0
                  ? (providerLogos[movie.tmdb_id] ?? []).map((p) => (
                      <Image
                        key={p.provider_id}
                        source={{ uri: p.logo_url }}
                        style={styles.providerIcon}
                        resizeMode="cover"
                      />
                    ))
                  : null}
              </View>

              <View style={styles.actionButtons}>
                <Pressable
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleWatched(movie.watchlistId, movie);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                </Pressable>
                <Pressable
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleRemove(movie.watchlistId);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={24} color="#dc2626" />
                </Pressable>
                <Pressable
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    moveItem(movies.indexOf(movie), 'up');
                  }}
                  hitSlop={8}
                  disabled={movies.indexOf(movie) === 0}
                >
                  <Ionicons
                    name="chevron-up"
                    size={24}
                    color={movies.indexOf(movie) === 0 ? '#4b5563' : '#a5b4fc'}
                  />
                </Pressable>
                <Pressable
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    moveItem(movies.indexOf(movie), 'down');
                  }}
                  hitSlop={8}
                  disabled={movies.indexOf(movie) === movies.length - 1}
                >
                  <Ionicons
                    name="chevron-down"
                    size={24}
                    color={
                      movies.indexOf(movie) === movies.length - 1 ? '#4b5563' : '#a5b4fc'
                    }
                  />
                </Pressable>
              </View>
            </Pressable>
          ))}
        </View>
      )}
      </ScrollView>

      {showSearchOverlay && (
        <SearchResultsOverlay
          searchLoading={searchLoading}
          searchError={searchError}
          searchResult={searchResult}
          onResultPress={(m) =>
            handleMoviePress({ id: m.id, tmdb_id: Number(m.id) })
          }
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
  wrapper: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
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
  savingOrderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  savingOrderText: {
    fontSize: 13,
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
    height: 80,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2d2d2d',
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
    flex: 2,
    marginLeft: 12,
    marginRight: 8,
    minWidth: 0,
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
  providerIcons: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 8,
    minWidth: 0,
  },
  providerIcon: {
    width: 25,
    height: 25,
    borderRadius: 6,
    backgroundColor: '#2d2d2d',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
