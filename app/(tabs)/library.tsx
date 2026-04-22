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
import { getSavedProviderIds } from '../../lib/provider-preferences';
import {
  mergeWatchProviderCountryBuckets,
  filterWatchProvidersByEnabled,
  type WatchProviderCountry,
} from '../../lib/tmdb-watch-providers';
import { useCountry } from '../../lib/country-context';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w92';

interface WatchedMovie {
  id: string;
  tmdb_id: number;
  title: string;
  poster_url: string | null;
  watched_at: string;
  personal_rating: number | null;
  vote_average: number | null;
}

interface ProviderLogo {
  provider_id: number;
  logo_url: string;
}

function formatWatchedDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function WatchedScreen() {
  const router = useRouter();
  const { selectedCountry } = useCountry();
  const [movies, setMovies] = useState<WatchedMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [providerLogos, setProviderLogos] = useState<Record<number, ProviderLogo[]>>({});
  const [enabledServiceIds, setEnabledServiceIds] = useState<Set<number>>(new Set());
  const hasFetchedOnce = useRef(false);

  const enrichWithTmdbVotes = useCallback(async (rows: WatchedMovie[]): Promise<WatchedMovie[]> => {
    const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
    if (!apiKey || rows.length === 0) {
      return rows.map((row) => ({ ...row, vote_average: null }));
    }

    return Promise.all(
      rows.map(async (row) => {
        try {
          const res = await fetch(`${TMDB_BASE}/movie/${row.tmdb_id}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!res.ok) {
            return { ...row, vote_average: null };
          }
          const data = (await res.json()) as { vote_average?: number };
          const vote =
            typeof data.vote_average === 'number' ? data.vote_average : null;
          return { ...row, vote_average: vote };
        } catch {
          return { ...row, vote_average: null };
        }
      })
    );
  }, []);

  const fetchHistory = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('watched_history')
      .select('id, tmdb_id, title, poster_url, watched_at, personal_rating')
      .eq('user_id', userId)
      .order('watched_at', { ascending: false });

    if (error) {
      console.error('Watched list fetch error:', error);
      setMovies([]);
      return;
    }

    const base: WatchedMovie[] = (data ?? []).map((row) => ({
      id: row.id as string,
      tmdb_id: row.tmdb_id as number,
      title: row.title as string,
      poster_url: (row.poster_url as string | null) ?? null,
      watched_at: row.watched_at as string,
      personal_rating:
        row.personal_rating != null ? Number(row.personal_rating) : null,
      vote_average: null,
    }));

    const enriched = await enrichWithTmdbVotes(base);
    setMovies(enriched);
  }, [enrichWithTmdbVotes]);

  useEffect(() => {
    async function loadEnabledServices() {
      if (session) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('enabled_services')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile?.enabled_services) {
          setEnabledServiceIds(new Set(profile.enabled_services as number[]));
          return;
        }
      }
      const localIds = await getSavedProviderIds();
      setEnabledServiceIds(new Set(localIds));
    }

    loadEnabledServices();
  }, [session]);

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
          const countryData = data.results?.[selectedCountry] as
            | WatchProviderCountry
            | undefined;
          const merged = mergeWatchProviderCountryBuckets(countryData);
          const filtered = filterWatchProvidersByEnabled(
            merged,
            enabledServiceIds
          );
          const list: ProviderLogo[] = filtered.map((p) => ({
            provider_id: p.provider_id,
            logo_url: p.logo_path ? `${TMDB_IMAGE_BASE}${p.logo_path}` : '',
          }));
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
  }, [movies, selectedCountry, enabledServiceIds]);

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
    (item: WatchedMovie) => {
      router.push({
        pathname: '/movie/[id]',
        params: { id: String(item.tmdb_id), fromWatched: 'true' },
      });
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: WatchedMovie }) => {
      const { personal_rating, vote_average } = item;

      return (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => handleMoviePress(item)}
        >
          {/* Poster Column */}
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

          {/* Details Column (Left-Aligned) */}
          <View style={[styles.movieInfo, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.movieTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.watchedDate}>
              Watched on {formatWatchedDate(item.watched_at)}
            </Text>
          </View>

          <View style={styles.providerIcons}>
            {(providerLogos[item.tmdb_id] ?? []).length > 0
              ? (providerLogos[item.tmdb_id] ?? []).map((p) => (
                  <Image
                    key={p.provider_id}
                    source={{ uri: p.logo_url }}
                    style={styles.providerIcon}
                    resizeMode="cover"
                  />
                ))
              : null}
          </View>

          {/* Ratings Column (Right-Aligned, Stacked) */}
          <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, color: '#e5e7eb', fontWeight: '500' }}>
              You:{' '}
              <Text style={{ color: '#818cf8', fontWeight: 'bold' }}>
                {personal_rating != null ? `${personal_rating}/10` : '—'}
              </Text>
            </Text>
            <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
              TMDB:{' '}
              {vote_average != null ? `${vote_average.toFixed(1)}/10` : '—'}
            </Text>
          </View>
        </Pressable>
      );
    },
    [handleMoviePress, providerLogos]
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
    minHeight: 80,
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
    marginRight: 4,
    minWidth: 0,
  },
  providerIcons: {
    flexDirection: 'row',
    overflow: 'hidden',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 4,
    maxWidth: 96,
    minHeight: 25,
    justifyContent: 'flex-end',
  },
  providerIcon: {
    width: 25,
    height: 25,
    borderRadius: 6,
    backgroundColor: '#2d2d2d',
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
