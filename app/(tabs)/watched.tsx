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
import { getWatchProvidersCached } from '../../lib/watch-provider-cache';
import {
  groupProvidersByBrand,
  isBrandEnabled,
  type BrandedProvider,
} from '../../lib/provider-branding';
import { useCountry } from '../../lib/country-context';
import { WatchedHistoryStatsHeader } from '../../components/WatchedHistoryStats';
import { isTvTarget, shouldUseTvDpadFocus } from '../../lib/isTv';
import { tvFocusable } from '../../lib/tvFocus';

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

function formatAddedAt(iso: string): string {
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
  const [libraryMovies, setLibraryMovies] = useState<LibraryMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [providerBrands, setProviderBrands] = useState<Record<number, BrandedProvider[]>>({});
  const [enabledServiceIds, setEnabledServiceIds] = useState<Set<number>>(new Set());
  const hasEnabledServices = enabledServiceIds.size > 0;
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const hasFetchedOnce = useRef(false);

  const isTV = isTvTarget();
  const tvListRowDpad = shouldUseTvDpadFocus() || isTV;

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
      console.error('Watched tab fetch error:', error);
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
      setProviderBrands({});
      return;
    }

    const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
    if (!apiKey) {
      setProviderBrands({});
      return;
    }

    let cancelled = false;
    const brands: Record<number, BrandedProvider[]> = {};

    Promise.all(
      tmdbIds.map(async (tmdbId) => {
        if (cancelled) return;
        try {
          // Reads the Supabase cache first; only refreshes from TMDB when the
          // cached row is missing or older than the 14-day TTL. Collapse the
          // per-tier TMDB entries to one icon per brand; "My services" only
          // drives the highlight styling at render time.
          const providers = await getWatchProvidersCached(
            tmdbId,
            selectedCountry,
            apiKey
          );
          brands[tmdbId] = groupProvidersByBrand(providers).filter(
            (b) => b.logo_path
          );
        } catch {
          brands[tmdbId] = [];
        }
      })
    ).then(() => {
      if (!cancelled) setProviderBrands(brands);
    });

    return () => {
      cancelled = true;
    };
  }, [libraryMovies, selectedCountry]);

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
    ({ item, index }: { item: LibraryMovie; index: number }) => {
      const tmdb = item.tmdb_id;
      const { vote_average } = item;

      return (
        <Pressable
          {...(tvListRowDpad ? tvFocusable() : {})}
          onFocus={() => setFocusedRowIndex(index)}
          onBlur={() => setFocusedRowIndex((f) => (f === index ? null : f))}
          style={({ pressed }) => [
            styles.row,
            pressed && styles.rowPressed,
            tvListRowDpad && focusedRowIndex === index && styles.rowTvFocused,
          ]}
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
            {tmdb != null && (providerBrands[tmdb] ?? []).length > 0
              ? (providerBrands[tmdb] ?? []).map((brand) => {
                  const isEnabled = isBrandEnabled(brand, enabledServiceIds);
                  return (
                    <Image
                      key={brand.brandKey}
                      source={{ uri: `${TMDB_IMAGE_BASE}${brand.logo_path}` }}
                      style={[
                        styles.providerIcon,
                        hasEnabledServices &&
                          (isEnabled
                            ? styles.providerIconEnabled
                            : styles.providerIconDimmed),
                      ]}
                      resizeMode="cover"
                    />
                  );
                })
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
    [
      handleMoviePress,
      providerBrands,
      enabledServiceIds,
      hasEnabledServices,
      tvListRowDpad,
      focusedRowIndex,
    ]
  );

  const ListEmptyComponent = useCallback(
    () =>
      !loading && !session ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Your history awaits</Text>
          <Text style={styles.emptySubtext}>
            Tap &quot;Sign In&quot; below to get started (or use Sign In in the header on web).
          </Text>
          <Pressable
            testID="maestro-onboarding-login-btn"
            style={styles.emptyLoginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.emptyLoginButtonText}>Sign In</Text>
          </Pressable>
        </View>
      ) : !loading && libraryMovies.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nothing saved to Watched yet</Text>
          <Text style={styles.emptySubtext}>
            {"Add titles from a movie's detail page (saved shelf uses your Watched list)."}
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
        extraData={focusedRowIndex}
        ListHeaderComponent={
          session ? <WatchedHistoryStatsHeader userId={session.user.id} /> : null
        }
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
    textAlign: 'center',
  },
  emptyLoginButton: {
    marginTop: 20,
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  emptyLoginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
  /** Android TV: visible D-pad focus ring (matches Watchlist + home poster ring intent). */
  rowTvFocused: {
    borderColor: '#00F5FF',
    borderWidth: 2,
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
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginHorizontal: 8,
    maxWidth: 96,
  },
  providerIcon: {
    width: 25,
    height: 25,
    borderRadius: 6,
    backgroundColor: '#2d2d2d',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  /** On "My services": ring the matches. */
  providerIconEnabled: {
    borderColor: '#00F5FF',
  },
  /** On "My services": de-emphasize providers the user isn't subscribed to. */
  providerIconDimmed: {
    opacity: 0.4,
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
