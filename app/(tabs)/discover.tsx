import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
  FlatList,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { MovieCard, type Movie } from '../../components/MovieCard';
import { useRouter } from 'expo-router';
import { getSavedProviderIds } from '../../lib/provider-preferences';

const CURRENT_YEAR = new Date().getFullYear();
const START_YEAR = 1980;
const YEARS = Array.from(
  { length: CURRENT_YEAR - START_YEAR + 1 },
  (_, i) => CURRENT_YEAR - i
);

const GENRES = [
  { id: 28, name: 'Action' },
  { id: 35, name: 'Comedy' },
  { id: 18, name: 'Drama' },
  { id: 27, name: 'Horror' },
  { id: 878, name: 'Sci-Fi' },
  { id: 53, name: 'Thriller' },
  { id: 10749, name: 'Romance' },
  { id: 16, name: 'Animation' },
  { id: 99, name: 'Documentary' },
  { id: 80, name: 'Crime' },
  { id: 14, name: 'Fantasy' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];

const HORIZONTAL_PADDING = 20;
const GRID_GAP = 12;
const MIN_POSTER_WIDTH = 100;
const MAX_POSTER_WIDTH = 180;

interface DiscoverResult {
  id: string;
  title: string;
  poster_url: string | null;
  release_year: number | null;
  vote_average: number | null;
  platforms: Array<{ name: string; access_type: string }>;
}

type ListItem =
  | { type: 'row'; movies: DiscoverResult[]; key: string }
  | { type: 'divider'; title: string; key: string };

function useNumColumns() {
  const { width } = useWindowDimensions();
  return useMemo(() => {
    const available = width - HORIZONTAL_PADDING * 2;
    const cols = Math.floor((available + GRID_GAP) / (MIN_POSTER_WIDTH + GRID_GAP));
    const clamped = Math.max(2, Math.min(cols, 10));
    const itemWidth = (available - GRID_GAP * (clamped - 1)) / clamped;
    if (itemWidth > MAX_POSTER_WIDTH && clamped < 10) {
      const wider = Math.floor((available + GRID_GAP) / (MAX_POSTER_WIDTH + GRID_GAP));
      return Math.max(2, wider);
    }
    return clamped;
  }, [width]);
}

export default function DiscoverScreen() {
  const router = useRouter();
  const numColumns = useNumColumns();
  const { width: screenWidth } = useWindowDimensions();

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [phase1Movies, setPhase1Movies] = useState<DiscoverResult[]>([]);
  const [phase2Movies, setPhase2Movies] = useState<DiscoverResult[]>([]);
  const [fetchPhase, setFetchPhase] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingOnly, setStreamingOnly] = useState(true);
  const [providerIds, setProviderIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const loadingMoreRef = useRef(false);
  const phase1IdsRef = useRef<Set<string>>(new Set());
  const yearListRef = useRef<FlatList>(null);

  useEffect(() => {
    getSavedProviderIds().then(setProviderIds);
  }, []);

  useEffect(() => {
    phase1IdsRef.current = new Set(phase1Movies.map((m) => m.id));
  }, [phase1Movies]);

  const itemWidth = useMemo(() => {
    const available = screenWidth - HORIZONTAL_PADDING * 2;
    return (available - GRID_GAP * (numColumns - 1)) / numColumns;
  }, [screenWidth, numColumns]);

  const buildUrl = useCallback(
    (year: number, streaming: boolean, pg: number, providers: number[], genres: number[], phase: number) => {
      const baseUrl =
        Platform.OS === 'web'
          ? typeof window !== 'undefined'
            ? window.location.origin
            : ''
          : process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8081';

      let url = `${baseUrl}/api/discover?year=${year}&streamingOnly=${streaming}&page=${pg}&phase=${phase}`;
      if (providers.length > 0) {
        url += `&providers=${providers.join('|')}`;
      }
      if (genres.length > 0) {
        url += `&genre=${genres.join('|')}`;
      }
      return url;
    },
    []
  );

  const fetchMovies = useCallback(
    async (year: number, streaming: boolean, genres: number[]) => {
      setLoading(true);
      setPhase1Movies([]);
      setPhase2Movies([]);
      setFetchPhase(1);
      setError(null);
      setPage(1);
      setTotalPages(1);

      try {
        const freshProviders = await getSavedProviderIds();
        setProviderIds(freshProviders);

        const res = await fetch(buildUrl(year, streaming, 1, freshProviders, genres, 1));
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? `Request failed (${res.status})`);
          return;
        }

        const phase1Results: DiscoverResult[] = data.movies ?? [];
        setPhase1Movies(phase1Results);

        if (phase1Results.length === 0) {
          setFetchPhase(2);
          const res2 = await fetch(buildUrl(year, streaming, 1, freshProviders, genres, 2));
          const data2 = await res2.json();
          if (res2.ok && data2.movies) {
            setPhase2Movies(data2.movies);
            setTotalPages(data2.total_pages ?? 1);
          }
          setPage(1);
        } else {
          setTotalPages(data.total_pages ?? 1);
          setPage(1);
        }
      } catch (err) {
        console.error('Discover error:', err);
        setError(err instanceof Error ? err.message : 'Request failed');
      } finally {
        setLoading(false);
      }
    },
    [buildUrl]
  );

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || loading || !selectedYear) return;

    if (page >= totalPages) {
      if (fetchPhase === 1) {
        loadingMoreRef.current = true;
        setLoadingMore(true);
        setFetchPhase(2);

        try {
          const res = await fetch(
            buildUrl(selectedYear, streamingOnly, 1, providerIds, selectedGenres, 2)
          );
          const data = await res.json();

          if (res.ok && data.movies) {
            const deduped = (data.movies as DiscoverResult[]).filter(
              (m) => !phase1IdsRef.current.has(m.id)
            );
            setPhase2Movies(deduped);
            setPage(1);
            setTotalPages(data.total_pages ?? 1);
          }
        } catch (err) {
          console.error('Phase 2 fetch error:', err);
        } finally {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
        return;
      }
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;

    try {
      const res = await fetch(
        buildUrl(selectedYear, streamingOnly, nextPage, providerIds, selectedGenres, fetchPhase)
      );
      const data = await res.json();

      if (res.ok && data.movies) {
        if (fetchPhase === 1) {
          setPhase1Movies((prev) => [...prev, ...data.movies]);
        } else {
          const deduped = (data.movies as DiscoverResult[]).filter(
            (m) => !phase1IdsRef.current.has(m.id)
          );
          setPhase2Movies((prev) => [...prev, ...deduped]);
        }
        setPage(nextPage);
        setTotalPages(data.total_pages ?? totalPages);
      }
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [loading, selectedYear, page, totalPages, fetchPhase, streamingOnly, providerIds, selectedGenres, buildUrl]);

  const triggerFetch = useCallback(
    (year: number | null, streaming: boolean, genres: number[]) => {
      if (year) fetchMovies(year, streaming, genres);
    },
    [fetchMovies]
  );

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    triggerFetch(year, streamingOnly, selectedGenres);
  };

  const handleStreamingToggle = (value: boolean) => {
    setStreamingOnly(value);
    triggerFetch(selectedYear, value, selectedGenres);
  };

  const handleGenreToggle = (genreId: number) => {
    setSelectedGenres((prev) => {
      const next = prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId];
      triggerFetch(selectedYear, streamingOnly, next);
      return next;
    });
  };

  const handleMoviePress = (movie: Movie) => {
    router.push(`/movie/${movie.id}`);
  };

  const renderYearChip = ({ item: year }: { item: number }) => {
    const isSelected = year === selectedYear;
    return (
      <Pressable
        style={[styles.chip, isSelected && styles.chipSelected]}
        onPress={() => handleYearSelect(year)}
      >
        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
          {year}
        </Text>
      </Pressable>
    );
  };

  const renderGenreChip = ({ item }: { item: (typeof GENRES)[number] }) => {
    const isSelected = selectedGenres.includes(item.id);
    return (
      <Pressable
        style={[styles.chip, isSelected && styles.chipSelected]}
        onPress={() => handleGenreToggle(item.id)}
      >
        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
          {item.name}
        </Text>
      </Pressable>
    );
  };

  const activeGenreNames = useMemo(
    () => GENRES.filter((g) => selectedGenres.includes(g.id)).map((g) => g.name),
    [selectedGenres]
  );

  const sectionLabel =
    activeGenreNames.length === 0
      ? `Top Rated Movies of ${selectedYear}`
      : activeGenreNames.length <= 2
        ? `Top ${activeGenreNames.join(' & ')} Movies of ${selectedYear}`
        : `Top Movies of ${selectedYear} (${activeGenreNames.length} genres)`;

  const dividerTitle = useMemo(() => {
    if (activeGenreNames.length === 0) return 'Other streaming movies';
    if (activeGenreNames.length <= 2)
      return `Other streaming ${activeGenreNames.join(' & ')} movies`;
    return `Other streaming movies (${activeGenreNames.length} genres)`;
  }, [activeGenreNames]);

  const hasMovies = phase1Movies.length > 0 || phase2Movies.length > 0;

  const listData = useMemo(() => {
    const items: ListItem[] = [];

    for (let i = 0; i < phase1Movies.length; i += numColumns) {
      items.push({
        type: 'row',
        movies: phase1Movies.slice(i, i + numColumns),
        key: `p1-${i}`,
      });
    }

    if (fetchPhase >= 2) {
      if (phase1Movies.length > 0) {
        items.push({ type: 'divider', title: dividerTitle, key: 'phase-divider' });
      }
      for (let i = 0; i < phase2Movies.length; i += numColumns) {
        items.push({
          type: 'row',
          movies: phase2Movies.slice(i, i + numColumns),
          key: `p2-${i}`,
        });
      }
    }

    return items;
  }, [phase1Movies, phase2Movies, numColumns, fetchPhase, dividerTitle]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <Text style={styles.subtitle}>Browse movies by year & genre</Text>
      </View>

      <View style={styles.chipRowContainer}>
        <FlatList
          ref={yearListRef}
          data={YEARS}
          keyExtractor={(item) => String(item)}
          renderItem={renderYearChip}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipListContent}
        />
      </View>

      <View style={styles.chipRowContainer}>
        <FlatList
          data={GENRES}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderGenreChip}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipListContent}
        />
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Streaming Only</Text>
        <Switch
          value={streamingOnly}
          onValueChange={handleStreamingToggle}
          trackColor={{ false: '#2d2d2d', true: '#4f46e5' }}
          thumbColor={streamingOnly ? '#a5b4fc' : '#6b7280'}
        />
      </View>

      {!selectedYear && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎬</Text>
          <Text style={styles.emptyText}>
            Select a year above to discover movies
          </Text>
        </View>
      )}

      {loading && !hasMovies && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>
            Discovering {selectedYear} movies...
          </Text>
        </View>
      )}

      {error ? (
        !loading ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null
      ) : null}

      {hasMovies && (
        <FlatList
          key={`grid-${numColumns}`}
          data={listData}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.resultsContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={1.5}
          windowSize={5}
          maxToRenderPerBatch={10}
          initialNumToRender={20}
          removeClippedSubviews={true}
          ListHeaderComponent={
            phase1Movies.length > 0 ? (
              <Text style={styles.sectionTitle}>{sectionLabel}</Text>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerContainer}>
                <ActivityIndicator size="small" color="#6366f1" />
                <Text style={styles.footerText}>Loading more...</Text>
              </View>
            ) : fetchPhase >= 2 && page >= totalPages && hasMovies ? (
              <View style={styles.footerContainer}>
                <Text style={styles.endOfListEmoji}>🎬</Text>
                <Text style={styles.endOfListText}>That's all, folks!</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            if (item.type === 'divider') {
              return (
                <View style={styles.phaseDivider}>
                  <View style={styles.phaseDividerLine} />
                  <Text style={styles.phaseDividerText}>{item.title}</Text>
                  <View style={styles.phaseDividerLine} />
                </View>
              );
            }

            return (
              <View style={[styles.gridRow, { gap: GRID_GAP }]}>
                {item.movies.map((movie) => (
                  <View key={movie.id} style={{ width: itemWidth, maxWidth: MAX_POSTER_WIDTH }}>
                    <MovieCard
                      movie={{
                        id: movie.id,
                        title: movie.title,
                        poster_url: movie.poster_url,
                        release_year: movie.release_year,
                        vote_average: movie.vote_average,
                      }}
                      onPress={() =>
                        handleMoviePress({
                          id: movie.id,
                          title: movie.title,
                          poster_url: movie.poster_url,
                          release_year: movie.release_year,
                        })
                      }
                    />
                    {movie.platforms.length > 0 && (
                      <View style={styles.platformBadges}>
                        {movie.platforms
                          .filter((p) => p.access_type === 'subscription')
                          .slice(0, 2)
                          .map((p, i) => (
                            <View key={i} style={styles.platformBadge}>
                              <Text style={styles.platformBadgeText}>
                                {p.name}
                              </Text>
                            </View>
                          ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            );
          }}
        />
      )}

      {!loading && selectedYear && !hasMovies && !error && (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            No movies found for {selectedYear}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    paddingTop: 8,
  },
  header: {
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: 12,
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
  chipRowContainer: {
    marginBottom: 10,
  },
  chipListContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  chipSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#d1d5db',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  loadingText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  resultsContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  phaseDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
    gap: 12,
  },
  phaseDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2d2d2d',
  },
  phaseDividerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  footerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  endOfListEmoji: {
    fontSize: 32,
  },
  endOfListText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  platformBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  platformBadge: {
    backgroundColor: '#1e1b4b',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  platformBadgeText: {
    fontSize: 9,
    color: '#a5b4fc',
    fontWeight: '600',
  },
});
