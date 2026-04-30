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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { resolvePrunedProviderSelections } from '../../lib/stream-finder-supabase';
import {
  mergeWatchProviderCountryBuckets,
  filterWatchProvidersByEnabled,
  type WatchProviderCountry,
} from '../../lib/tmdb-watch-providers';
import { useCountry } from '../../lib/country-context';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w92';

/** Row from `user_library` with embedded `media` (same join shape as watchlist). */
interface LibraryMovie {
  libraryRowId: string;
  id: string;
  tmdb_id: number | null;
  title: string;
  poster_url: string | null;
  added_at: string;
  vote_average: number | null;
}

interface ProviderLogo {
  provider_id: number;
  logo_url: string;
}

function formatAddedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function LibraryScreen() {
  const router = useRouter();
  const { selectedCountry } = useCountry();
  const [libraryMovies, setLibraryMovies] = useState<LibraryMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [providerLogos, setProviderLogos] = useState<Record<number, ProviderLogo[]>>({});
  const [enabledServiceIds, setEnabledServiceIds] = useState<Set<number>>(new Set());
  const hasFetchedOnce = useRef(false);

  const enrichWithTmdbVotes = useCallback(async (rows: LibraryMovie[]): Promise<LibraryMovie[]> => {
    const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
    if (!apiKey || rows.length === 0) {
      return rows.map((row) => ({ ...row, vote_average: null }));
    }

    return Promise.all(
      rows.map(async (row) => {
        if (row.tmdb_id == null) {
          return { ...row, vote_average: null };
        }
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

  const fetchLibrary = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('user_library')
      .select('id, created_at, media_id, media (id, tmdb_id, title, poster_url, release_year)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Library fetch error:', error);
      setLibraryMovies([]);
      return;
    }

    const base: LibraryMovie[] = (data ?? [])
      .map((row: Record<string, unknown>) => {
        const m = row.media as Record<string, unknown> | null;
        if (!m) return null;
        return {
          libraryRowId: row.id as string,
          id: m.id as string,
          tmdb_id: (m.tmdb_id as number | null) ?? null,
          title: m.title as string,
          poster_url: (m.poster_url as string | null) ?? null,
          added_at: row.created_at as string,
          vote_average: null,
        };
      })
      .filter((m): m is LibraryMovie => m !== null);

    const enriched = await enrichWithTmdbVotes(base);
    setLibraryMovies(enriched);
  }, [enrichWithTmdbVotes]);

  useEffect(() => {
    async function loadEnabledServices() {
      const ids = await resolvePrunedProviderSelections(supabase, {
        userId: session?.user?.id ?? null,
      });
      setEnabledServiceIds(new Set(ids));
    }

    void loadEnabledServices();
  }, [session]);

  useEffect(() => {
    const tmdbIds = libraryMovies
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
  }, [libraryMovies, selectedCountry, enabledServiceIds]);

  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        const { data: { session: s } } = await supabase.auth.getSession();
        setSession(s);
        if (s) {
          const isInitial = !hasFetchedOnce.current;
          if (isInitial) setLoading(true);
          await fetchLibrary(s.user.id);
          hasFetchedOnce.current = true;
        } else {
          setLibraryMovies([]);
        }
        setLoading(false);
      };
      run();
    }, [fetchLibrary])
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        if (!s) {
          setLibraryMovies([]);
          hasFetchedOnce.current = false;
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const onRefresh = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    await fetchLibrary(session.user.id);
    setRefreshing(false);
  }, [session, fetchLibrary]);

  const handleMoviePress = useCallback(
    (item: LibraryMovie) => {
      if (item.tmdb_id == null) return;
      router.push({
        pathname: '/movie/[id]',
        params: { id: String(item.tmdb_id) },
      });
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: LibraryMovie }) => {
      const tmdb = item.tmdb_id;
      const { vote_average } = item;

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
            <Text style={styles.addedDate}>
              Added {formatAddedAt(item.added_at)}
            </Text>
          </View>

          <View style={styles.providerIcons}>
            {tmdb != null && (providerLogos[tmdb] ?? []).length > 0
              ? (providerLogos[tmdb] ?? []).map((p) => (
                  <Image
                    key={p.provider_id}
                    source={{ uri: p.logo_url }}
                    style={styles.providerIcon}
                    resizeMode="cover"
                  />
                ))
              : null}
          </View>

          <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, color: '#9ca3af' }}>
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
      ) : !loading && libraryMovies.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No titles in your library</Text>
          <Text style={styles.emptySubtext}>
            Add movies from a title’s details page
          </Text>
        </View>
      ) : null,
    [loading, session, libraryMovies.length]
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
        data={libraryMovies}
        keyExtractor={(item) => item.libraryRowId}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.content,
          libraryMovies.length === 0 && styles.contentEmpty,
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
  addedDate: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
});
