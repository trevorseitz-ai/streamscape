import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  FlatList,
  Switch,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { MovieCard, type Movie } from '../../components/MovieCard';
import { useWatchlistStatus } from '../../lib/watchlist-status-context';
import { getSavedProviderIds } from '../../lib/provider-preferences';
import { useCountry } from '../../lib/country-context';
import { supabase } from '../../lib/supabase';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

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
const YEAR_JUMP_DISTANCE = 350;
const YEAR_CHIP_SNAP_INTERVAL = 70;

interface DiscoverResult {
  id: string;
  title: string;
  poster_url: string | null;
  release_year: number | null;
  vote_average: number | null;
  platforms: Array<{ name: string; access_type: string }>;
}

interface TMDBDiscoverResponse {
  results?: Array<{
    id: number;
    title: string;
    poster_path: string | null;
    release_date: string;
    vote_average: number;
  }>;
  total_pages?: number;
}

function toFullImageUrl(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/')) return null;
  return `${TMDB_IMAGE_BASE}${path}`;
}

type MonetizationType = 'flatrate' | 'rent' | 'both';

async function fetchDiscoverFromTMDB(
  year: number | null,
  monetization: MonetizationType,
  page: number,
  providers: number[],
  genres: number[],
  phase: number,
  watchRegion: string
): Promise<{ movies: DiscoverResult[]; total_pages: number }> {
  const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
  if (!apiKey) throw new Error('TMDB API key not configured');

  let url = `${TMDB_BASE}/discover/movie?region=${watchRegion}&page=${page}&language=en-US`;

  if (year != null) {
    url += `&primary_release_year=${year}`;
  }
  if (genres.length > 0) {
    url += `&with_genres=${genres.join('|')}`;
  }

  if (phase === 2) {
    url += '&sort_by=popularity.desc';
  } else {
    url += '&sort_by=vote_average.desc&vote_count.gte=10';
  }

  if (providers.length > 0) {
    url += `&with_watch_providers=${providers.join('|')}&watch_region=${watchRegion}`;
  } else if (monetization === 'flatrate') {
    url += `&with_watch_monetization_types=flatrate&watch_region=${watchRegion}`;
  } else if (monetization === 'rent') {
    url += `&with_watch_monetization_types=rent,buy&watch_region=${watchRegion}`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);

  const data: TMDBDiscoverResponse = await res.json();

  const movies: DiscoverResult[] = (data.results ?? []).map((m) => ({
    id: String(m.id),
    title: m.title,
    poster_url: toFullImageUrl(m.poster_path),
    release_year: m.release_date
      ? parseInt(m.release_date.slice(0, 4), 10)
      : null,
    vote_average: m.vote_average ?? null,
    platforms: [],
  }));

  return {
    movies,
    total_pages: Math.min(data.total_pages ?? 1, 500),
  };
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
  const status = useWatchlistStatus();
  const { selectedCountry } = useCountry();
  const [session, setSession] = useState<{ user: { id: string; email?: string } } | null>(null);

  useFocusEffect(
    useCallback(() => {
      status?.refetch();
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s);
      });
    }, [status])
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => setSession(s)
    );
    return () => subscription.unsubscribe();
  }, []);
  const numColumns = useNumColumns();
  const { width: screenWidth } = useWindowDimensions();
  const { isLandscape } = useBreakpoint();

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [phase1Movies, setPhase1Movies] = useState<DiscoverResult[]>([]);
  const [phase2Movies, setPhase2Movies] = useState<DiscoverResult[]>([]);
  const [fetchPhase, setFetchPhase] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monetization, setMonetization] = useState<MonetizationType>('both');
  const [providerIds, setProviderIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const loadingMoreRef = useRef(false);
  const phase1IdsRef = useRef<Set<string>>(new Set());
  const yearListRef = useRef<FlatList>(null);
  const [yearScrollX, setYearScrollX] = useState(0);
  const [yearContentWidth, setYearContentWidth] = useState(0);

  const canScrollYearLeft = yearScrollX > 10;
  const canScrollYearRight = yearContentWidth > screenWidth && yearScrollX < yearContentWidth - screenWidth - 10;

  const scrollYear = useCallback((direction: 'left' | 'right') => {
    const offset = direction === 'left' ? -YEAR_JUMP_DISTANCE : YEAR_JUMP_DISTANCE;
    const currentX = yearScrollX;
    const maxScroll = Math.max(0, yearContentWidth - screenWidth);
    const nextX = Math.max(0, Math.min(maxScroll, currentX + offset));
    yearListRef.current?.scrollToOffset({ offset: nextX, animated: true });
  }, [yearScrollX, yearContentWidth, screenWidth]);

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

  const fetchMovies = useCallback(
    async (year: number | null, monet: MonetizationType, genres: number[]) => {
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

        const data = await fetchDiscoverFromTMDB(year, monet, 1, freshProviders, genres, 1, selectedCountry);
        const phase1Results = data.movies;
        setPhase1Movies(phase1Results);

        if (phase1Results.length === 0) {
          setFetchPhase(2);
          const data2 = await fetchDiscoverFromTMDB(year, monet, 1, freshProviders, genres, 2, selectedCountry);
          setPhase2Movies(data2.movies);
          setTotalPages(data2.total_pages);
          setPage(1);
        } else {
          setTotalPages(data.total_pages);
          setPage(1);
        }
      } catch (err) {
        console.error('Discover error:', err);
        setError(err instanceof Error ? err.message : 'Request failed');
      } finally {
        setLoading(false);
      }
    },
    [selectedCountry]
  );

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || loading) return;

    if (page >= totalPages) {
      if (fetchPhase === 1) {
        loadingMoreRef.current = true;
        setLoadingMore(true);
        setFetchPhase(2);

        try {
          const data = await fetchDiscoverFromTMDB(
            selectedYear, monetization, 1, providerIds, selectedGenres, 2, selectedCountry
          );
          const deduped = data.movies.filter(
            (m) => !phase1IdsRef.current.has(m.id)
          );
          setPhase2Movies(deduped);
          setPage(1);
          setTotalPages(data.total_pages);
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
      const data = await fetchDiscoverFromTMDB(
        selectedYear, monetization, nextPage, providerIds, selectedGenres, fetchPhase, selectedCountry
      );

      if (fetchPhase === 1) {
        setPhase1Movies((prev) => [...prev, ...data.movies]);
      } else {
        const deduped = data.movies.filter(
          (m) => !phase1IdsRef.current.has(m.id)
        );
        setPhase2Movies((prev) => [...prev, ...deduped]);
      }
      setPage(nextPage);
      setTotalPages(data.total_pages);
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [loading, page, totalPages, fetchPhase, monetization, providerIds, selectedYear, selectedGenres, selectedCountry]);

  const triggerFetch = useCallback(
    (year: number | null, monet: MonetizationType, genres: number[]) => {
      setPage(1);
      setFetchPhase(1);
      fetchMovies(year, monet, genres);
    },
    [fetchMovies]
  );

  useEffect(() => {
    triggerFetch(selectedYear, monetization, selectedGenres);
  }, [selectedYear, selectedGenres, selectedCountry, triggerFetch, monetization]);

  const handleYearSelect = (year: number) => {
    const nextYear = selectedYear === year ? null : year;
    setSelectedYear(nextYear);
    triggerFetch(nextYear, monetization, selectedGenres);
  };

  const handleMonetizationChange = (value: MonetizationType) => {
    setMonetization(value);
    triggerFetch(selectedYear, value, selectedGenres);
  };

  const handleGenreToggle = (genreId: number) => {
    setSelectedGenres((prev) => {
      const next = prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId];
      setPage(1);
      setFetchPhase(1);
      triggerFetch(selectedYear, monetization, next);
      return next;
    });
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
      ? selectedYear != null
        ? `Top Rated Movies of ${selectedYear}`
        : 'Top Rated Movies'
      : activeGenreNames.length <= 2
        ? selectedYear != null
          ? `Top ${activeGenreNames.join(' & ')} Movies of ${selectedYear}`
          : `Top ${activeGenreNames.join(' & ')} Movies`
        : selectedYear != null
          ? `Top Movies of ${selectedYear} (${activeGenreNames.length} genres)`
          : `Top Movies (${activeGenreNames.length} genres)`;

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

  // Auth guard: blackout when not logged in (after all hooks)
  if (!session) {
    return (
      <View style={styles.blackout}>
        <TouchableOpacity
          style={styles.blackoutButton}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.blackoutText}>Sign in to discover movies</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <Text style={styles.subtitle}>Browse movies by year & genre</Text>
      </View>

      <View style={styles.chipRowContainer}>
        <View style={styles.yearListWrapper}>
          <FlatList
            ref={yearListRef}
            data={YEARS}
            keyExtractor={(item) => String(item)}
            renderItem={renderYearChip}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipListContent}
            onScroll={(e) => setYearScrollX(e.nativeEvent.contentOffset.x)}
            onContentSizeChange={(w) => setYearContentWidth(w)}
            scrollEventThrottle={16}
            snapToInterval={YEAR_CHIP_SNAP_INTERVAL}
            snapToAlignment="start"
            decelerationRate="fast"
          />
          {isLandscape && (canScrollYearLeft || canScrollYearRight) ? (
            <>
              {canScrollYearLeft ? (
                <TouchableOpacity
                  style={[styles.yearScrollArrow, styles.yearScrollArrowLeft]}
                  onPress={() => scrollYear('left')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={24} color="#ffffff" />
                </TouchableOpacity>
              ) : null}
              {canScrollYearRight ? (
                <TouchableOpacity
                  style={[styles.yearScrollArrow, styles.yearScrollArrowRight]}
                  onPress={() => scrollYear('right')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-forward" size={24} color="#ffffff" />
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}
        </View>
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

      <View style={styles.monetizationRow}>
        <Pressable
          style={[styles.monetizationPill, monetization === 'flatrate' && styles.monetizationPillActive]}
          onPress={() => handleMonetizationChange('flatrate')}
        >
          <Text style={[styles.monetizationPillText, monetization === 'flatrate' && styles.monetizationPillTextActive]}>
            Free/Stream
          </Text>
        </Pressable>
        <Pressable
          style={[styles.monetizationPill, monetization === 'rent' && styles.monetizationPillActive]}
          onPress={() => handleMonetizationChange('rent')}
        >
          <Text style={[styles.monetizationPillText, monetization === 'rent' && styles.monetizationPillTextActive]}>
            Rent/Buy
          </Text>
        </Pressable>
        <Pressable
          style={[styles.monetizationPill, monetization === 'both' && styles.monetizationPillActive]}
          onPress={() => handleMonetizationChange('both')}
        >
          <Text style={[styles.monetizationPillText, monetization === 'both' && styles.monetizationPillTextActive]}>
            All
          </Text>
        </Pressable>
      </View>

      {!hasMovies && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎬</Text>
          <Text style={styles.emptyText}>
            {!selectedYear && selectedGenres.length === 0
              ? 'Select a year or genre to discover movies'
              : 'No movies found. Try a different year or genre.'}
          </Text>
        </View>
      )}

      {loading && !hasMovies && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>
            {selectedYear != null
              ? `Discovering ${selectedYear} movies for your region...`
              : 'Discovering movies for your region...'}
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
    </View>
  );
}

const styles = StyleSheet.create({
  blackout: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  blackoutButton: {
    padding: 16,
  },
  blackoutText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
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
  yearListWrapper: {
    position: 'relative',
  },
  yearScrollArrow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 10,
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  yearScrollArrowLeft: {
    left: 0,
  },
  yearScrollArrowRight: {
    right: 0,
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
  monetizationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: 12,
  },
  monetizationPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  monetizationPillActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  monetizationPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  monetizationPillTextActive: {
    color: '#ffffff',
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
