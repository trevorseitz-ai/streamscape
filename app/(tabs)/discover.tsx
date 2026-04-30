import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  type ReactNode,
  type ComponentRef,
} from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  FlatList,
  Image,
  useWindowDimensions,
  TouchableOpacity,
  Platform,
  findNodeHandle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import {
  MovieRow,
  bucketViewportWidth,
  getMoviePosterLayout,
  MOVIE_POSTER_EDGE_INSET,
} from '../../components/MovieRow';
import { useWatchlistStatus } from '../../lib/watchlist-status-context';
import { useCountry } from '../../lib/country-context';
import { isTvTarget } from '../../lib/isTv';
import { tvFocusable } from '../../lib/tvFocus';
import { tvAndroidNavProps } from '../../lib/tvAndroidNavProps';
import { useTvSearchFocusBridge } from '../../lib/tv-search-focus-context';
import { tvScale } from '../../lib/tvUiScale';
import { TV_SIDEBAR_WIDTH } from '../../components/TvSidebarTabBar';
import { tvBodyFontSize, tvTitleFontSize } from '../../lib/tvTypography';
import { supabase } from '../../lib/supabase';
import { enrichWithTmdbImages } from '../../lib/film-show-rapid-discover';
import { fetchDiscoverMoviesFromStreamFinder, resolvePrunedProviderSelections } from '../../lib/stream-finder-supabase';
import { discoverPosterGridColumns } from '../../lib/viewport-utils';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

/** Local Discover auth snapshot — aligns Supabase Session with tri-state Discover UI. */
type DiscoverLocalSession =
  | { user: { id: string; email?: string | null } }
  | null
  | undefined;

function discoverAuthKey(s: DiscoverLocalSession): string {
  if (s === undefined) return '__pending__';
  if (s === null) return '__signed_out__';
  return `uid:${s.user.id}`;
}

function mergeDiscoverAuth(
  prev: DiscoverLocalSession,
  next: DiscoverLocalSession
): DiscoverLocalSession {
  if (discoverAuthKey(prev) === discoverAuthKey(next)) return prev;
  return next;
}

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
const GRID_GAP_PHONE = 12;
const GRID_GAP_TV = 20;
/** Discover TV: nav + horizontal buffers (content shell padding; includes side inset for width math). */
/** Matches Home’s 20px inset from the main column edge (nav + buffer). */
const DISCOVER_TV_CONTENT_BUFFER = 20;
const DISCOVER_TV_RIGHT_MARGIN = 20;
const DISCOVER_TV_GAP = 20;
const DISCOVER_TV_LIST_VERTICAL_PAD = 20;
/** TV: small bottom pad so the focus “floor” isn’t a huge empty scroll region. */
const DISCOVER_TV_RESULTS_PADDING_BOTTOM = 32;
const YEAR_JUMP_DISTANCE = 350;
const YEAR_CHIP_SNAP_INTERVAL = 70;

interface DiscoverResult {
  id: string;
  title: string;
  poster_url: string | null;
  /** Present when hydrated from Stream Finder cache + TMDB enrichment. */
  backdrop_url?: string | null;
  release_year: number | null;
  vote_average: number | null;
  platforms: Array<{ name: string; access_type: string }>;
  /** TMDB id — enrichment + routing. */
  tmdb_id?: number | null;
  /** Stream Finder: rows joined from `stream_finder_providers`; sorted by name when present. */
  providers?: Array<{ id: number; name: string; logo_url: string }>;
  /** Cached provider logos (Discover stream finder). */
  provider_logo_urls?: string[];
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
    if (monetization === 'flatrate') {
      url += '&with_watch_monetization_types=flatrate|free';
    } else if (monetization === 'rent') {
      url += '&with_watch_monetization_types=rent|buy';
    }
    // "Both": keep providers, omit monetization to show everything on user's platforms
  } else if (monetization === 'flatrate') {
    url += `&with_watch_monetization_types=flatrate|free&watch_region=${watchRegion}`;
  } else if (monetization === 'rent') {
    url += `&with_watch_monetization_types=rent|buy&watch_region=${watchRegion}`;
  }

  console.log('Fetching URL:', url);

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
  | { type: 'row'; movies: DiscoverResult[]; key: string; movieRowIndex: number }
  | { type: 'divider'; title: string; key: string };

type DiscoverTvHorizontalRowProps = {
  movies: DiscoverResult[];
  router: ReturnType<typeof useRouter>;
  /** Pixel width/height of one poster cell; must match 5× `rowGap` ladder math. */
  posterWidth: number;
  posterHeight: number;
  rowGap: number;
  /** Ordinal of this row among all movie rows (0-based). */
  movieRowIndex: number;
  /** First cell of the next row (Z-pattern: right on last item → first of next). */
  nextRowEntryTag: number | null;
  /** Last row’s last cell tag for `nextFocusRightSelf` (right-edge wall on bottom-right). */
  lastRowLastCellWallTag: number | null;
  setRowEntryRef: (rowIdx: number) => (node: ComponentRef<typeof Pressable> | null) => void;
  setRowExitRef: (rowIdx: number) => (node: ComponentRef<typeof Pressable> | null) => void;
  renderMovieFooter?: (movie: DiscoverResult) => ReactNode;
  isLastMovieRow: boolean;
  /** Bumps when row entry/exit native tags change so cells re-apply D-pad links. */
  wrapNavVersion: number;
  discoverSidebarLeftTag?: number | null;
  mainContentEntryNavTag?: number | null;
};

function DiscoverTvPosterCell({
  movie,
  posterWidth,
  posterHeight,
  onPress,
  footer,
  colIndex,
  rowLen,
  isLastMovieRow,
  nextRowEntryTag,
  lastRowLastCellWallTag,
  setRowEntryRef,
  setRowExitRef,
  rowRefIndex,
  discoverSidebarLeftTag,
  mainContentEntryNavTag,
}: {
  movie: DiscoverResult;
  posterWidth: number;
  posterHeight: number;
  onPress: () => void;
  footer: ReactNode | null;
  colIndex: number;
  rowLen: number;
  isLastMovieRow: boolean;
  nextRowEntryTag: number | null;
  lastRowLastCellWallTag: number | null;
  setRowEntryRef: (rowIdx: number) => (node: ComponentRef<typeof Pressable> | null) => void;
  setRowExitRef: (rowIdx: number) => (node: ComponentRef<typeof Pressable> | null) => void;
  rowRefIndex: number;
  discoverSidebarLeftTag: number | null;
  mainContentEntryNavTag: number | null;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [posterLoadFailed, setPosterLoadFailed] = useState(false);
  /** Native tag of this cell’s `Pressable` (self-trap when cross-row target not registered yet). */
  const [localTag, setLocalTag] = useState<number | null>(null);

  const cellWrapStyle = useMemo(
    () => [discoverTvPosterStyles.posterCellWrap, { width: posterWidth, flexShrink: 0 }],
    [posterWidth]
  );

  useEffect(() => {
    setPosterLoadFailed(false);
  }, [movie.id, movie.poster_url]);

  const showPlaceholder = !movie.poster_url || posterLoadFailed;
  const useNav = Platform.OS === 'android';
  const isLastInRow = colIndex === rowLen - 1;
  const isFirstInRow = colIndex === 0;
  /** Z-pattern: right from last col → first of next row, or self until that tag exists. */
  const rightCarriage =
    isLastInRow && !isLastMovieRow
      ? (nextRowEntryTag ?? localTag)
      : null;
  /** Bottom-right: right wall; prefer shared ref tag else local so first frame is trapped. */
  const rightWallSelf =
    isLastInRow && isLastMovieRow
      ? (lastRowLastCellWallTag ?? localTag)
      : null;
  /** Every row’s first cell: left goes to sidebar, or self-trap if sidebar tag not ready. */
  const leftToSidebar =
    isFirstInRow ? (discoverSidebarLeftTag ?? localTag) : null;

  const pressableRef = useCallback(
    (node: ComponentRef<typeof Pressable> | null) => {
      if (Platform.OS === 'android') {
        setLocalTag(node ? findNodeHandle(node) : null);
      } else {
        setLocalTag(null);
      }
      if (isFirstInRow) setRowEntryRef(rowRefIndex)(node);
      if (isLastInRow) setRowExitRef(rowRefIndex)(node);
    },
    [
      isFirstInRow,
      isLastInRow,
      rowRefIndex,
      setRowEntryRef,
      setRowExitRef,
    ]
  );

  const posterPressStyle = useMemo(
    () => [
      discoverTvPosterStyles.posterPressable,
      { width: posterWidth, height: posterHeight },
      ...(isFocused ? [discoverTvPosterStyles.posterPressableFocused] : []),
    ],
    [posterWidth, posterHeight, isFocused]
  );

  return (
    <View style={cellWrapStyle} collapsable={false}>
      <Pressable
        ref={pressableRef}
        {...tvFocusable()}
        focusable={true}
        {...(useNav
          ? tvAndroidNavProps({
              ...(isFirstInRow && leftToSidebar != null
                ? { nextFocusLeft: leftToSidebar }
                : {}),
              ...(isLastInRow && !isLastMovieRow && rightCarriage != null
                ? { nextFocusRight: rightCarriage }
                : {}),
              ...(isLastInRow && isLastMovieRow && rightWallSelf != null
                ? { nextFocusRightSelf: rightWallSelf }
                : {}),
              ...(isLastMovieRow && mainContentEntryNavTag != null
                ? { nextFocusDown: mainContentEntryNavTag }
                : {}),
            })
          : {})}
        onFocus={() => {
          setIsFocused(true);
          if (__DEV__) {
            console.log(
              `[D-PAD FOCUS] Landed on: ${movie.title || 'Unknown'}`
            );
          }
        }}
        onBlur={() => {
          setIsFocused(false);
          if (__DEV__) {
            console.log(`[D-PAD BLUR] Left: ${movie.title || 'Unknown'}`);
          }
        }}
        onPress={onPress}
        android_ripple={null}
        style={posterPressStyle}
      >
        {!showPlaceholder ? (
          <Image
            source={{ uri: movie.poster_url as string }}
            style={discoverTvPosterStyles.posterImageFill}
            resizeMode="cover"
            onError={() => setPosterLoadFailed(true)}
          />
        ) : (
          <View
            focusable={false}
            style={[
              discoverTvPosterStyles.placeholder,
              discoverTvPosterStyles.posterImageFill,
            ]}
          >
            <Text style={discoverTvPosterStyles.placeholderTitle} numberOfLines={3}>
              {movie.title}
            </Text>
          </View>
        )}
      </Pressable>
      {footer}
    </View>
  );
}

function DiscoverTvHorizontalMovieRow({
  movies,
  router,
  posterWidth,
  posterHeight,
  rowGap,
  movieRowIndex,
  nextRowEntryTag,
  lastRowLastCellWallTag,
  setRowEntryRef,
  setRowExitRef,
  renderMovieFooter,
  isLastMovieRow,
  wrapNavVersion,
  discoverSidebarLeftTag = null,
  mainContentEntryNavTag = null,
}: DiscoverTvHorizontalRowProps) {
  const rowLen = movies.length;
  const rowContentStyle = useMemo(
    () => ({
      paddingVertical: DISCOVER_TV_LIST_VERTICAL_PAD,
      gap: rowGap,
    }),
    [rowGap]
  );
  return (
    <View style={discoverTvRowStyles.rowWrap}>
      <FlatList
        horizontal
        data={movies}
        keyExtractor={(m) => m.id}
        showsHorizontalScrollIndicator={false}
        removeClippedSubviews={false}
        style={discoverTvRowStyles.rowFlatList}
        contentContainerStyle={rowContentStyle}
        extraData={wrapNavVersion}
        renderItem={({ item, index: colIndex }) => (
          <DiscoverTvPosterCell
            movie={item}
            posterWidth={posterWidth}
            posterHeight={posterHeight}
            onPress={() => router.push(`/movie/${item.id}`)}
            footer={renderMovieFooter?.(item) ?? null}
            colIndex={colIndex}
            rowLen={rowLen}
            isLastMovieRow={isLastMovieRow}
            nextRowEntryTag={nextRowEntryTag}
            lastRowLastCellWallTag={lastRowLastCellWallTag}
            setRowEntryRef={setRowEntryRef}
            setRowExitRef={setRowExitRef}
            rowRefIndex={movieRowIndex}
            discoverSidebarLeftTag={discoverSidebarLeftTag}
            mainContentEntryNavTag={mainContentEntryNavTag}
          />
        )}
      />
    </View>
  );
}

const discoverTvRowStyles = StyleSheet.create({
  rowWrap: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    marginBottom: 12,
    overflow: 'visible',
  },
  rowFlatList: {
    width: '100%',
    overflow: 'visible',
  },
});

const discoverTvPosterStyles = StyleSheet.create({
  posterCellWrap: {
    overflow: 'visible',
  },
  posterPressable: {
    backgroundColor: 'transparent',
    overflow: 'visible',
    borderRadius: 8,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  posterPressableFocused: {
    borderColor: '#00F5FF',
    transform: [{ scale: 1.05 }],
    zIndex: 2,
    elevation: 10,
  },
  posterImageFill: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#080C10',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  placeholderTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e5e7eb',
    textAlign: 'center',
  },
});

export default function DiscoverScreen() {
  const router = useRouter();
  const status = useWatchlistStatus();
  /** Keep focus callback stable: `status` from context changes identity when watchlists update; if it is a `useFocusEffect` dep, the effect re-runs while the screen stays focused (bad on mobile web). */
  const watchlistRefetchRef = useRef(status?.refetch);
  watchlistRefetchRef.current = status?.refetch;
  const { selectedCountry } = useCountry();
  /** `undefined` = auth not resolved yet — do not treat as signed-out or gate on this for redirects. */
  const [session, setSession] = useState<DiscoverLocalSession>(undefined);

  useEffect(() => {
    console.log('🍏 [Discover] MOUNTED on platform:', Platform.OS);
    return () => console.log('🍎 [Discover] UNMOUNTED');
  }, []);

  useFocusEffect(
    useCallback(() => {
      watchlistRefetchRef.current?.();
      let cancelled = false;
      supabase.auth.getSession().then(({ data: { session: incoming } }) => {
        if (cancelled) return;
        setSession((prev) =>
          mergeDiscoverAuth(prev, incoming as DiscoverLocalSession)
        );
        const uid = incoming?.user?.id ?? null;
        resolvePrunedProviderSelections(supabase, { userId: uid }).then(
          (ids) => {
            if (!cancelled) setProviderIds(ids);
          }
        );
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) =>
        setSession((prev) => mergeDiscoverAuth(prev, s as DiscoverLocalSession))
    );
    return () => subscription.unsubscribe();
  }, []);

  const { width: rawWidth } = useWindowDimensions();
  const screenWidth = useMemo(() => bucketViewportWidth(rawWidth), [rawWidth]);
  const { isLandscape } = useBreakpoint();
  const isTV = isTvTarget();

  /** Phone / Web Discover — wider viewports stack more posters to avoid billboard tiles on desktop & large tablets. */
  const numColumns = useMemo(() => discoverPosterGridColumns(screenWidth), [screenWidth]);
  const { sidebarSlotNativeTags, mainContentEntryNativeTag } = useTvSearchFocusBridge();
  const discoverSidebarLeftTag =
    isTV && Platform.OS === 'android' ? (sidebarSlotNativeTags['discover'] ?? null) : null;
  /** TV: shell `discoverTvContentWrap` supplies 20 / 20 horizontal padding — no extra horizontal inset here. */
  const contentPadX = isTV ? 0 : HORIZONTAL_PADDING;
  const [tvDiscoverShellW, setTvDiscoverShellW] = useState(0);
  /** TV rail applies only on native TV builds — never on mobile web (bottom tabs / no rail). */
  const discoverTvSidebarOffset =
    isTV && Platform.OS !== 'web' ? TV_SIDEBAR_WIDTH : 0;
  const tvRowUsableWidth = useMemo(() => {
    if (!isTV) return 0;
    if (tvDiscoverShellW > 0) {
      return (
        tvDiscoverShellW -
        DISCOVER_TV_CONTENT_BUFFER -
        DISCOVER_TV_RIGHT_MARGIN
      );
    }
    return (
      screenWidth -
      discoverTvSidebarOffset -
      DISCOVER_TV_CONTENT_BUFFER -
      DISCOVER_TV_RIGHT_MARGIN
    );
  }, [
    isTV,
    tvDiscoverShellW,
    screenWidth,
    discoverTvSidebarOffset,
  ]);
  /**
   * TV grid: column count scales with usable row width (3 / 4 / 6) so 65" layouts don’t use huge cells.
   * Inner width ≈ shell minus buffers; gaps = columns - 1.
   */
  const discoverTvGridLayout = useMemo(() => {
    if (!isTV) {
      return { itemWidth: 0, itemHeight: 0, rowGap: DISCOVER_TV_GAP, columns: 0 };
    }
    const rowGap = DISCOVER_TV_GAP;
    const inner = Math.max(0, tvRowUsableWidth);
    const columns = discoverPosterGridColumns(inner);
    const itemWidth = Math.max(
      0,
      (inner - rowGap * (columns - 1)) / columns
    );
    const itemHeight = itemWidth * 1.5;
    return { itemWidth, itemHeight, rowGap, columns };
  }, [isTV, tvRowUsableWidth]);
  const gridGap = isTV ? Math.round(GRID_GAP_TV * tvScale) : GRID_GAP_PHONE;

  const discoverPosterLayout = useMemo(
    () => getMoviePosterLayout(screenWidth, 'phone', numColumns),
    [screenWidth, numColumns]
  );

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
  const [streamFinderListHydrating, setStreamFinderListHydrating] = useState(false);
  const loadingMoreRef = useRef(false);
  const fetchingRef = useRef(false);
  /** True while the default grid is the Stream Finder–cached list (no TMDB discover pagination). */
  const streamFinderCuratedFeedActiveRef = useRef(false);
  /** Ensures Stream Finder cache hydration runs once per mount. */
  const streamFinderCuratedFetchedRef = useRef(false);
  const phase1IdsRef = useRef<Set<string>>(new Set());
  const yearListRef = useRef<FlatList>(null);
  const genreListRef = useRef<FlatList>(null);
  const [yearScrollX, setYearScrollX] = useState(0);
  const [yearContentWidth, setYearContentWidth] = useState(0);
  const [genreScrollX, setGenreScrollX] = useState(0);
  const [genreContentWidth, setGenreContentWidth] = useState(0);

  const canScrollYearLeft = yearScrollX > 10;
  const canScrollYearRight = yearContentWidth > screenWidth && yearScrollX < yearContentWidth - screenWidth - 10;

  const canScrollGenreLeft = genreScrollX > 10;
  const canScrollGenreRight =
    genreContentWidth > screenWidth && genreScrollX < genreContentWidth - screenWidth - 10;

  const scrollYear = useCallback((direction: 'left' | 'right') => {
    const offset = direction === 'left' ? -YEAR_JUMP_DISTANCE : YEAR_JUMP_DISTANCE;
    const currentX = yearScrollX;
    const maxScroll = Math.max(0, yearContentWidth - screenWidth);
    const nextX = Math.max(0, Math.min(maxScroll, currentX + offset));
    yearListRef.current?.scrollToOffset({ offset: nextX, animated: true });
  }, [yearScrollX, yearContentWidth, screenWidth]);

  const scrollGenre = useCallback((direction: 'left' | 'right') => {
    const offset = direction === 'left' ? -YEAR_JUMP_DISTANCE : YEAR_JUMP_DISTANCE;
    const currentX = genreScrollX;
    const maxScroll = Math.max(0, genreContentWidth - screenWidth);
    const nextX = Math.max(0, Math.min(maxScroll, currentX + offset));
    genreListRef.current?.scrollToOffset({ offset: nextX, animated: true });
  }, [genreScrollX, genreContentWidth, screenWidth]);

  /** Fixed web shell — responsive min height below tablet width. */
  const webDiscoverLoadingAreaStyle = useMemo(
    () =>
      Platform.OS !== 'web'
        ? undefined
        : ({
            minHeight: screenWidth < 768 ? 300 : 400,
            width: '100%' as const,
            maxWidth: 720,
            alignSelf: 'center' as const,
          } as const),
    [screenWidth]
  );

  /** Extra bottom padding so the next row peeks (phone). TV uses a fixed large inset. */
  const verticalPeekPadding = useMemo(() => {
    if (isTV) return 0;
    const posterH = discoverPosterLayout.posterHeight;
    const titleAndMeta = 88;
    const rowHeight = posterH + titleAndMeta + gridGap;
    return Math.round(rowHeight * 0.5);
  }, [discoverPosterLayout.posterHeight, gridGap, isTV]);

  useEffect(() => {
    let cancelled = false;
    const uid =
      session === undefined ? undefined : (session?.user?.id ?? null);
    resolvePrunedProviderSelections(supabase, { userId: uid }).then((ids) => {
      if (!cancelled) setProviderIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [discoverAuthKey(session)]);

  useEffect(() => {
    phase1IdsRef.current = new Set(phase1Movies.map((m) => m.id));
  }, [phase1Movies]);

  /**
   * Curated default Discover — Stream Finder cache in Supabase (+ TMDB poster/backdrop enrichment).
   */
  useEffect(() => {
    if (streamFinderCuratedFetchedRef.current) return;
    streamFinderCuratedFetchedRef.current = true;

    let cancelled = false;
    streamFinderCuratedFeedActiveRef.current = true;
    setStreamFinderListHydrating(true);

    (async () => {
      try {
        const mapped = await fetchDiscoverMoviesFromStreamFinder(supabase);
        if (cancelled) return;
        if (__DEV__) {
          console.log(`[Discover] Stream Finder hydrate: ${mapped.length} titles (cache read OK)`);
        }
        const enriched = await enrichWithTmdbImages(mapped);
        if (cancelled) return;
        setPhase1Movies(enriched as DiscoverResult[]);
      } catch (e) {
        console.warn('[Discover] Stream Finder cache load failed:', e);
        streamFinderCuratedFeedActiveRef.current = false;
      } finally {
        if (!cancelled) setStreamFinderListHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const providerIdsString = useMemo(
    () => providerIds.join('|'),
    [providerIds]
  );

  const fetchMovies = useCallback(
    async (year: number | null, monet: MonetizationType, genres: number[]) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      streamFinderCuratedFeedActiveRef.current = false;
      setLoading(true);
      setPhase1Movies([]);
      setPhase2Movies([]);
      setFetchPhase(1);
      setError(null);
      setPage(1);
      setTotalPages(1);

      try {
        const providers = providerIdsString
          ? providerIdsString.split('|').map(Number).filter(Boolean)
          : [];
        const data = await fetchDiscoverFromTMDB(year, monet, 1, providers, genres, 1, selectedCountry);
        const phase1Results = data.movies;
        setPhase1Movies(phase1Results);

        if (phase1Results.length === 0) {
          setFetchPhase(2);
          const data2 = await fetchDiscoverFromTMDB(year, monet, 1, providers, genres, 2, selectedCountry);
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
        fetchingRef.current = false;
        setLoading(false);
      }
    },
    [selectedCountry, providerIdsString]
  );

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || loading) return;
    /**
     * Same guard on Web and native: infinite scroll must not append TMDB /discover pages into the
     * Stream Finder–cached default list while `streamFinderCuratedFeedActiveRef` is true.
     */
    if (streamFinderCuratedFeedActiveRef.current) return;

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


  const renderYearChip = ({ item: year }: { item: number }) => (
    <DiscoverFilterChip
      label={String(year)}
      isSelected={year === selectedYear}
      onPress={() => handleYearSelect(year)}
    />
  );

  const renderGenreChip = ({ item }: { item: (typeof GENRES)[number] }) => (
    <DiscoverFilterChip
      label={item.name}
      isSelected={selectedGenres.includes(item.id)}
      onPress={() => handleGenreToggle(item.id)}
    />
  );

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
    const perRow = isTV ? Math.max(1, discoverTvGridLayout.columns) : numColumns;
    let movieRowIndex = 0;

    for (let i = 0; i < phase1Movies.length; i += perRow) {
      items.push({
        type: 'row',
        movies: phase1Movies.slice(i, i + perRow),
        key: `p1-${i}`,
        movieRowIndex: movieRowIndex++,
      });
    }

    if (fetchPhase >= 2) {
      if (phase1Movies.length > 0) {
        items.push({ type: 'divider', title: dividerTitle, key: 'phase-divider' });
      }
      for (let i = 0; i < phase2Movies.length; i += perRow) {
        items.push({
          type: 'row',
          movies: phase2Movies.slice(i, i + perRow),
          key: `p2-${i}`,
          movieRowIndex: movieRowIndex++,
        });
      }
    }

    return items;
  }, [phase1Movies, phase2Movies, fetchPhase, dividerTitle, isTV, numColumns, discoverTvGridLayout.columns]);

  const totalMovieRows = useMemo(
    () => listData.filter((x) => x.type === 'row').length,
    [listData]
  );
  const rowEntryTags = useRef<(number | null)[]>([]);
  const rowExitTags = useRef<(number | null)[]>([]);
  const [wrapNavVersion, setWrapNavVersion] = useState(0);
  const setRowEntryRef = useCallback(
    (rowIdx: number) => (node: ComponentRef<typeof Pressable> | null) => {
      if (Platform.OS !== 'android') return;
      const t = node ? findNodeHandle(node) : null;
      const arr = rowEntryTags.current;
      while (arr.length <= rowIdx) arr.push(null);
      if (arr[rowIdx] === t) return;
      arr[rowIdx] = t;
      setWrapNavVersion((n) => n + 1);
    },
    []
  );
  const setRowExitRef = useCallback(
    (rowIdx: number) => (node: ComponentRef<typeof Pressable> | null) => {
      if (Platform.OS !== 'android') return;
      const t = node ? findNodeHandle(node) : null;
      const arr = rowExitTags.current;
      while (arr.length <= rowIdx) arr.push(null);
      if (arr[rowIdx] === t) return;
      arr[rowIdx] = t;
      setWrapNavVersion((n) => n + 1);
    },
    []
  );
  useLayoutEffect(() => {
    rowEntryTags.current = new Array(totalMovieRows).fill(null);
    rowExitTags.current = new Array(totalMovieRows).fill(null);
    setWrapNavVersion((n) => n + 1);
  }, [totalMovieRows]);

  /** Auth still resolving — never show signed-out UI or curated feed on `undefined`. */
  if (session === undefined) {
    return (
      <View style={styles.blackout}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={[styles.blackoutText, { marginTop: 16, fontSize: 14 }]}>
          Checking session…
        </Text>
      </View>
    );
  }

  // Auth resolved: explicit signed-out (`null`).
  if (session === null) {
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

  const discoverMain = (
    <>
      <View style={[styles.header, { paddingHorizontal: contentPadX }]}>
        <Text style={[styles.title, isTV && { fontSize: tvTitleFontSize(32) }]}>Discover</Text>
        <Text style={[styles.subtitle, isTV && { fontSize: tvBodyFontSize(16) }]}>
          Browse movies by year & genre
        </Text>
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
            removeClippedSubviews={false}
            contentContainerStyle={[
              styles.chipListContent,
              { paddingHorizontal: contentPadX },
            ]}
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
        <View style={styles.yearListWrapper}>
          <FlatList
            ref={genreListRef}
            data={GENRES}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderGenreChip}
            horizontal
            showsHorizontalScrollIndicator={false}
            removeClippedSubviews={false}
            contentContainerStyle={[
              styles.chipListContent,
              { paddingHorizontal: contentPadX },
            ]}
            onScroll={(e) => setGenreScrollX(e.nativeEvent.contentOffset.x)}
            onContentSizeChange={(w) => setGenreContentWidth(w)}
            scrollEventThrottle={16}
          />
          {isLandscape && (canScrollGenreLeft || canScrollGenreRight) ? (
            <>
              {canScrollGenreLeft ? (
                <TouchableOpacity
                  style={[styles.yearScrollArrow, styles.yearScrollArrowLeft]}
                  onPress={() => scrollGenre('left')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={24} color="#ffffff" />
                </TouchableOpacity>
              ) : null}
              {canScrollGenreRight ? (
                <TouchableOpacity
                  style={[styles.yearScrollArrow, styles.yearScrollArrowRight]}
                  onPress={() => scrollGenre('right')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-forward" size={24} color="#ffffff" />
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}
        </View>
      </View>

      <View style={[styles.monetizationRow, { paddingHorizontal: contentPadX }]}>
        <MonetizationFilterChip
          label="Free/Stream"
          isSelected={monetization === 'flatrate'}
          onPress={() => handleMonetizationChange('flatrate')}
        />
        <MonetizationFilterChip
          label="Rent/Buy"
          isSelected={monetization === 'rent'}
          onPress={() => handleMonetizationChange('rent')}
        />
        <MonetizationFilterChip
          label="All"
          isSelected={monetization === 'both'}
          onPress={() => handleMonetizationChange('both')}
        />
      </View>

      {!hasMovies && !loading && !streamFinderListHydrating && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎬</Text>
          <Text style={styles.emptyText}>
            {!selectedYear && selectedGenres.length === 0
              ? 'Select a year or genre to discover movies'
              : 'No movies found. Try a different year or genre.'}
          </Text>
        </View>
      )}

      {(loading || streamFinderListHydrating) && !hasMovies && (
        <View
          style={[
            styles.centered,
            webDiscoverLoadingAreaStyle,
            { paddingHorizontal: contentPadX },
          ]}
        >
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>
            {streamFinderListHydrating && !loading
              ? 'Loading curated picks…'
              : selectedYear != null
                ? `Discovering ${selectedYear} movies for your region...`
                : 'Discovering movies for your region...'}
          </Text>
        </View>
      )}

      {error ? (
        !loading ? (
          <View style={[styles.centered, { paddingHorizontal: contentPadX }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null
      ) : null}

      {hasMovies && (
        /* Non-TV row spread via MoviePosterRow + distributePosterRow (vertical list cannot use columnWrapperStyle / numColumns with divider rows). */
        <FlatList
          key={
            isTV ? `discover-tv-grid-${discoverTvGridLayout.columns}` : `discover-poster-grid-${numColumns}`
          }
          data={listData}
          extraData={isTV ? wrapNavVersion : undefined}
          keyExtractor={(item) => item.key}
          contentContainerStyle={[
            styles.resultsContent,
            {
              paddingHorizontal: isTV ? 0 : MOVIE_POSTER_EDGE_INSET,
              paddingBottom: isTV
                ? DISCOVER_TV_RESULTS_PADDING_BOTTOM
                : 40 + verticalPeekPadding,
            },
          ]}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          onEndReached={loadMore}
          onEndReachedThreshold={1.5}
          windowSize={5}
          maxToRenderPerBatch={10}
          initialNumToRender={20}
          removeClippedSubviews={false}
          ListHeaderComponent={
            phase1Movies.length > 0 ? (
              isTV ? (
                <View focusable={false} collapsable={false}>
                  <Text style={[styles.sectionTitle, { fontSize: tvTitleFontSize(18) }]}>
                    {sectionLabel}
                  </Text>
                </View>
              ) : (
                <Text style={styles.sectionTitle}>{sectionLabel}</Text>
              )
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

            const renderDiscoverFooter = (movie: DiscoverResult) =>
              movie.platforms.length > 0 ? (
                <View style={styles.platformBadges}>
                  {movie.platforms
                    .filter((p) => p.access_type === 'subscription')
                    .slice(0, 2)
                    .map((p, i) => (
                      <View key={i} style={styles.platformBadge}>
                        <Text style={styles.platformBadgeText}>{p.name}</Text>
                      </View>
                    ))}
                </View>
              ) : null;

            if (isTV) {
              const movieRowIndex = item.movieRowIndex;
              const isLastMovieRow = movieRowIndex === totalMovieRows - 1;
              const nextRowEntryTag =
                rowEntryTags.current[movieRowIndex + 1] ?? null;
              const lastRowLastCellWallTag = isLastMovieRow
                ? (rowExitTags.current[movieRowIndex] ?? null)
                : null;
              return (
                <DiscoverTvHorizontalMovieRow
                  movies={item.movies}
                  router={router}
                  posterWidth={discoverTvGridLayout.itemWidth}
                  posterHeight={discoverTvGridLayout.itemHeight}
                  rowGap={discoverTvGridLayout.rowGap}
                  movieRowIndex={movieRowIndex}
                  nextRowEntryTag={nextRowEntryTag}
                  lastRowLastCellWallTag={lastRowLastCellWallTag}
                  setRowEntryRef={setRowEntryRef}
                  setRowExitRef={setRowExitRef}
                  renderMovieFooter={renderDiscoverFooter}
                  isLastMovieRow={isLastMovieRow}
                  wrapNavVersion={wrapNavVersion}
                  discoverSidebarLeftTag={discoverSidebarLeftTag}
                  mainContentEntryNavTag={mainContentEntryNativeTag}
                />
              );
            }

            return (
              <MovieRow
                movies={item.movies}
                phoneLayout="horizontal"
                wrapWithHorizontalInset={false}
                tvSidebarLeftNavTag={discoverSidebarLeftTag}
                phonePosterColumns={numColumns}
                distributePosterRow={!isTV}
                renderMovieFooter={(movie) => renderDiscoverFooter(movie as DiscoverResult)}
              />
            );
          }}
        />
      )}
    </>
  );

  return (
    <View style={styles.container}>
      {isTV ? (
        <View
          style={styles.discoverTvContentWrap}
          onLayout={(e) => setTvDiscoverShellW(e.nativeEvent.layout.width)}
        >
          {discoverMain}
        </View>
      ) : (
        discoverMain
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
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  /**
   * TV: fills space beside sidebar (`flex:1`), left/right from constants.
   * Poster math: inner width = `onLayout.width - CONTENT_BUFFER - RIGHT_MARGIN` (see `tvRowUsableWidth`).
   */
  discoverTvContentWrap: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingLeft: DISCOVER_TV_CONTENT_BUFFER,
    paddingRight: DISCOVER_TV_RIGHT_MARGIN,
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
  chipTextTvFocus: {
    color: '#ffffff',
  },
  chipTvFocused: {
    borderColor: '#ffffff',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
    zIndex: 2,
    elevation: 4,
  },
  chipPressed: {
    opacity: 0.88,
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
  monetizationPillTvFocused: {
    borderColor: '#ffffff',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
    zIndex: 2,
    elevation: 4,
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
    textAlign: 'center' as const,
    maxWidth: 480,
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

type DiscoverFilterChipProps = {
  label: string;
  isSelected: boolean;
  onPress: () => void;
};

function DiscoverFilterChip({ label, isSelected, onPress }: DiscoverFilterChipProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        isSelected && styles.chipSelected,
        isFocused && styles.chipTvFocused,
        pressed && styles.chipPressed,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          isSelected && styles.chipTextSelected,
          isFocused && !isSelected && styles.chipTextTvFocus,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type MonetizationFilterChipProps = {
  label: string;
  isSelected: boolean;
  onPress: () => void;
};

function MonetizationFilterChip({
  label,
  isSelected,
  onPress,
}: MonetizationFilterChipProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.monetizationPill,
        isSelected && styles.monetizationPillActive,
        isFocused && styles.monetizationPillTvFocused,
        pressed && styles.chipPressed,
      ]}
    >
      <Text
        style={[
          styles.monetizationPillText,
          isSelected && styles.monetizationPillTextActive,
          isFocused && !isSelected && styles.chipTextTvFocus,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
