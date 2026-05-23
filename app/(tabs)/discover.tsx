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
import { useTvSearchFocusBridge } from '../../lib/tv-search-focus-context';
import { tvScale } from '../../lib/tvUiScale';
import { tvBodyFontSize, tvTitleFontSize } from '../../lib/tvTypography';
import { supabase } from '../../lib/supabase';
import {
  enrichWithTmdbImages,
  enrichTmdbReleaseYearsForDiscover,
} from '../../lib/film-show-rapid-discover';
import {
  STREAM_FINDER_DISCOVER_PAGE_SIZE,
  fetchDiscoverMoviesPageFromStreamFinder,
  fetchStreamFinderProviderCatalog,
  resolvePrunedProviderSelections,
  type StreamFinderProviderRow,
} from '../../lib/stream-finder-supabase';
import { subscribeDiscoverFeedFlushAfterProfileSave } from '../../lib/discover-streaming-preferences-reset';
import { discoverPosterGridColumns } from '../../lib/viewport-utils';
import {
  TvMovieGridRow,
  TV_MOVIE_GRID_COLUMNS,
  TV_MOVIE_GRID_LIST_VERTICAL_PAD,
  TV_MOVIE_GRID_POSTER_HEIGHT,
} from '../../components/TvMovieGridRow';

const TMDB_BASE = 'https://api.themoviedb.org/3';
/** Discover list posters — **`w342`** / **`w185`** tier only; avoid **`original`** on TV grids. */
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';

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
/** TV content shell: left inset clears sidebar-adjacent focus ring; right keeps bezel breathing room. */
const DISCOVER_TV_CONTENT_PAD_LEFT = 24;
const DISCOVER_TV_RIGHT_MARGIN = 20;
/** TV: small bottom pad so the focus “floor” isn’t a huge empty scroll region. */
const DISCOVER_TV_RESULTS_PADDING_BOTTOM = 32;
const YEAR_JUMP_DISTANCE = 350;
const YEAR_CHIP_SNAP_INTERVAL = 70;

/**
 * Single Year chip rail height (`styles.chip`: paddingVertical 8×2 + label line for fontSize 14).
 * Page-level `paddingTop` above the Year row — ground truth **34px**.
 */
const DISCOVER_YEAR_CHIP_ROW_HEIGHT_PX = 34;
/**
 * Vertical gap between section headings and poster rails — matches `TvMovieGridRow` `sectionTitleWrap.marginBottom` (**12px**).
 */
const DISCOVER_HEADER_TO_RAIL_GAP_PX = 12;

/** Baseline title size before compact scales — see **`DISCOVER_POSTER_META_TITLE_PX`**. */
const DISCOVER_POSTER_META_TITLE_BASE_PX = 14;
/**
 * Footer meta: **75%** of baseline, then **−10%** (**11 × 0.9 → 10**) — single **`Title - Year`** string.
 */
const DISCOVER_POSTER_META_TITLE_PX = Math.round(
  Math.round(DISCOVER_POSTER_META_TITLE_BASE_PX * 0.75) * 0.9
);

/** Bounded Discover poster footer — matches **140px** poster width; **56px** fits **2** wrapped lines of unified **`Title - Year`** without clipping. */
const DISCOVER_POSTER_META_FOOTER_MARGIN_TOP_PX = 6;
const DISCOVER_POSTER_META_FOOTER_CONTENT_HEIGHT_PX = 56;
const DISCOVER_POSTER_META_FOOTER_TOTAL_PX =
  DISCOVER_POSTER_META_FOOTER_MARGIN_TOP_PX + DISCOVER_POSTER_META_FOOTER_CONTENT_HEIGHT_PX;

/**
 * Former single-line title slot height — subtracted from Discover TV list vertical pad to tighten row rhythm
 * while the footer keeps a fixed-height **`Title - Year`** block.
 */
const DISCOVER_POSTER_META_LEGACY_TITLE_SLOT_HEIGHT_PX = 20;
const DISCOVER_TV_MOVIE_GRID_LIST_VERTICAL_PAD_PX = Math.max(
  0,
  TV_MOVIE_GRID_LIST_VERTICAL_PAD - DISCOVER_POSTER_META_LEGACY_TITLE_SLOT_HEIGHT_PX
);

/**
 * Canonical **286px** vertical stride for Discover TV results **`FlatList`** (**`getItemLayout`** / **`snapToInterval`**):
 * **210** (`TV_MOVIE_GRID_POSTER_HEIGHT`) poster image + **56** (`DISCOVER_POSTER_META_FOOTER_CONTENT_HEIGHT_PX`) unified meta footer block + **20px** vertical list gap token (`DISCOVER_TV_LIST_INTER_ROW_VERTICAL_GAP_PX`).
 * Uniform movie-row lists use **`offset: index × 286`**; lists that include a phase divider fall back to cumulative offsets (row slot still **286px**).
 */
const DISCOVER_TV_LIST_INTER_ROW_VERTICAL_GAP_PX = 20;
const DISCOVER_TV_VERTICAL_ROW_SCROLL_UNIT_PX =
  TV_MOVIE_GRID_POSTER_HEIGHT +
  DISCOVER_POSTER_META_FOOTER_CONTENT_HEIGHT_PX +
  DISCOVER_TV_LIST_INTER_ROW_VERTICAL_GAP_PX;

const DISCOVER_TV_LIST_MOVIE_ROW_LAYOUT_HEIGHT_PX = DISCOVER_TV_VERTICAL_ROW_SCROLL_UNIT_PX;

/** Must track **`styles.phaseDivider`** vertical footprint (margins + text). */
const DISCOVER_TV_LIST_PHASE_DIVIDER_HEIGHT_PX = 56;

interface DiscoverResult {
  id: string;
  title: string;
  poster_url: string | null;
  /** Present when hydrated from Stream Finder cache + TMDB enrichment. */
  backdrop_url?: string | null;
  release_year: number | null;
  /** TMDB / API **`YYYY-MM-DD`** when hydrated (Stream Finder + TMDB merges). */
  release_date?: string | null;
  vote_average: number | null;
  platforms: Array<{ name: string; access_type: string; logo_path?: string | null }>;
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

function parseYearLeadingFromString(input: string | null | undefined): number | null {
  if (!input || typeof input !== 'string') return null;
  const t = input.trim();
  if (t.length < 4 || !/^\d{4}/.test(t)) return null;
  const y = parseInt(t.slice(0, 4), 10);
  if (!Number.isFinite(y) || y < 1800 || y > 2100) return null;
  return y;
}

/** Resolves footer year from **`release_year`**, **`release_date`**, or loose **`year` / `releaseDate`** keys. */
function getDiscoverReleaseYearForFooter(movie: DiscoverResult): number | null {
  if (movie.release_year != null && Number.isFinite(movie.release_year)) {
    const y = Math.trunc(movie.release_year);
    if (y >= 1800 && y <= 2100) return y;
  }
  const fromPrimaryDate = parseYearLeadingFromString(movie.release_date ?? undefined);
  if (fromPrimaryDate != null) return fromPrimaryDate;

  const loose = movie as DiscoverResult & { year?: unknown; releaseDate?: string | null };
  if (typeof loose.year === 'number' && Number.isFinite(loose.year)) {
    const y = Math.floor(loose.year);
    if (y >= 1800 && y <= 2100) return y;
  }
  if (typeof loose.year === 'string') {
    const y = parseYearLeadingFromString(loose.year);
    if (y != null) return y;
  }
  return parseYearLeadingFromString(loose.releaseDate ?? undefined);
}

/** Discover poster footer: **`Title - YYYY`** (year omitted when unknown). */
function formatDiscoverPosterMetaLine(movie: DiscoverResult): string {
  const y = getDiscoverReleaseYearForFooter(movie);
  return y != null ? `${movie.title} - ${y}` : movie.title;
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
    release_date: m.release_date ?? null,
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

/** Pre-network Supabase / TMDB payload dump for Metro + device Logcat. */
function logDiscoverDatabaseNetworkPayloadAudit(
  auditLabel: string,
  debugQueryPayload: Record<string, unknown>
): void {
  console.log('🚨 [ReelDive Debug] DATABASE NETWORK PAYLOAD AUDIT —————————————————');
  console.log(`🔖 ${auditLabel}`);
  console.log('📦 FULL RAW PARAMETERS:', JSON.stringify(debugQueryPayload, null, 2));
  console.log('————————————————————————————————————————————————————————————————');
}

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
  /** TV: shell `discoverTvContentWrap` supplies horizontal padding — results FlatList omits extra horizontal inset. */
  const contentPadX = isTV ? 0 : HORIZONTAL_PADDING;
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
  const providerIdsRef = useRef(providerIds);
  providerIdsRef.current = providerIds;

  /** Bumps Discover Stream Finder hydrate after Profile saves prefs (Discover tab stays mounted). */
  const [discoverStreamFinderHydrationGeneration, setDiscoverStreamFinderHydrationGeneration] =
    useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [streamFinderListHydrating, setStreamFinderListHydrating] = useState(false);
  const loadingMoreRef = useRef(false);
  const fetchingRef = useRef(false);
  /** Default landing: **`stream-finder`** paginates via Supabase; filters switch to **`tmdb`** (TMDB **`/discover`**). */
  const discoverFeedSourceRef = useRef<'stream-finder' | 'tmdb'>('stream-finder');
  /** When **`true`**, in-flight Stream Finder hydration must **not** call **`setPhase1Movies`** (user applied filters first). */
  const streamFinderHydrationDismissedRef = useRef(false);
  /** Next Supabase **`range`** offset for Stream Finder (**`STREAM_FINDER_DISCOVER_PAGE_SIZE`** stride). */
  const streamFinderPageOffsetRef = useRef(0);
  /** Stream Finder **`stream_finder_movies`** row count (exact count query). */
  const streamFinderTotalRef = useRef(0);
  const streamFinderProvidersRef = useRef<Map<number, StreamFinderProviderRow> | null>(
    null
  );
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
    const titleAndMeta = DISCOVER_POSTER_META_FOOTER_TOTAL_PX + 12;
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

  /** Hard reset Stream Finder + TMDB feed state when Profile **Save Preferences** succeeds (Discover may stay mounted behind Profile). */
  const flushDiscoverCachesAfterProfilePreferenceSave = useCallback(() => {
    fetchingRef.current = false;
    loadingMoreRef.current = false;

    setSelectedYear(null);
    setSelectedGenres([]);
    setMonetization('both');

    setPhase1Movies([]);
    setPhase2Movies([]);
    setPage(1);
    setTotalPages(1);
    setFetchPhase(1);
    setError(null);
    setLoadingMore(false);
    setLoading(false);
    phase1IdsRef.current = new Set();

    streamFinderHydrationDismissedRef.current = false;
    discoverFeedSourceRef.current = 'stream-finder';
    streamFinderPageOffsetRef.current = 0;
    streamFinderTotalRef.current = 0;
    streamFinderProvidersRef.current = null;

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user?.id ?? null;
        const ids = await resolvePrunedProviderSelections(supabase, { userId: uid });
        setProviderIds(ids);
        setDiscoverStreamFinderHydrationGeneration((n) => n + 1);
        if (__DEV__) {
          console.log(
            '[ReelDive Debug] Discover cache flushed from Profile Save Preferences; re-hydrating Stream Finder from Supabase.'
          );
        }
      } catch (err) {
        console.warn('[Discover] Profile-save cache flush follow-up failed:', err);
      }
    })();
  }, []);

  useEffect(() => {
    return subscribeDiscoverFeedFlushAfterProfileSave(flushDiscoverCachesAfterProfilePreferenceSave);
  }, [flushDiscoverCachesAfterProfilePreferenceSave]);

  /**
   * Curated default Discover — paginated Stream Finder cache (**`STREAM_FINDER_DISCOVER_PAGE_SIZE`**) +
   * TMDB poster / release-year enrichment. Re-runs when **`discoverStreamFinderHydrationGeneration`** bumps (Profile **Save Preferences** → **`flushDiscoverFeedCachesAfterProfileSave`**).
   */
  useEffect(() => {
    let cancelled = false;
    setStreamFinderListHydrating(true);

    (async () => {
      try {
        streamFinderHydrationDismissedRef.current = false;
        discoverFeedSourceRef.current = 'stream-finder';

        const providerById = await fetchStreamFinderProviderCatalog(supabase);
        if (cancelled || streamFinderHydrationDismissedRef.current) return;
        streamFinderProvidersRef.current = providerById;

        const { data: hydrateAuth } = await supabase.auth.getSession();
        const hydrateUid = hydrateAuth.session?.user?.id ?? null;
        const freshWatchProviderIds = await resolvePrunedProviderSelections(supabase, {
          userId: hydrateUid,
        });
        setProviderIds(freshWatchProviderIds);

        logDiscoverDatabaseNetworkPayloadAudit(
          'STREAM_FINDER: fetchStreamFinderProviderCatalog (post-fetch, pre-movies)',
          {
            activeProviderIdsSavedProfile: freshWatchProviderIds,
            providerIdsStringAtRequest:
              freshWatchProviderIds.join('|') ||
              '(empty — full stream_finder mirror; TMDB Discover path still applies own provider filter)',
            currentFeedSource: discoverFeedSourceRef.current,
            streamFinderHydrationGeneration: discoverStreamFinderHydrationGeneration,
            supabaseOperation: {
              table: 'stream_finder_providers',
              columns: 'provider_id, name, logo_path',
              filter: '(none — full catalog)',
            },
            curatedFeedNote:
              freshWatchProviderIds.length > 0
                ? `Stream Finder Hydrate applies RPC stream_finder_discover_page_filtered ∩ movie_availability for [${freshWatchProviderIds.join(', ')}].`
                : 'Stream Finder Hydrate: empty selection uses full popularity-sorted stream_finder_movies mirror (RPC filter omitted).',
          }
        );

        const streamFinderRange = {
          offset: 0,
          limit: STREAM_FINDER_DISCOVER_PAGE_SIZE,
        };

        const streamFinderMoviesHydrateAuditOps =
          freshWatchProviderIds.length > 0
            ? [
                {
                  kind: 'rpc' as const,
                  name: 'stream_finder_discover_page_filtered',
                  params: {
                    p_provider_ids: freshWatchProviderIds,
                    p_offset: streamFinderRange.offset,
                    p_limit: streamFinderRange.limit,
                  },
                  filterSemantics:
                    'Eligible rows = stream_finder_movies m WHERE EXISTS (SELECT 1 FROM movie_availability a WHERE a.movie_id = m.tmdb_id AND a.provider_id = ANY (p_provider_ids)); pruned IDs ⊆ stream_finder_providers inside fetchDiscoverMoviesPageFromStreamFinder.',
                  order: 'popularity DESC NULLS LAST',
                },
                {
                  table: 'movie_availability' as const,
                  select: 'movie_id, provider_id',
                  filter: 'movie_id IN (page tmdb_ids) — hydrate platform logos',
                },
              ]
            : [
                {
                  table: 'stream_finder_movies' as const,
                  select: 'tmdb_id, title, popularity, overview, poster_path',
                  order: 'popularity desc',
                  range: `range(${streamFinderRange.offset}, ${streamFinderRange.offset + streamFinderRange.limit - 1})`,
                },
                {
                  table: 'movie_availability' as const,
                  select: 'movie_id, provider_id',
                  filter: 'movie_id in (page tmdb_ids)',
                },
              ];

        logDiscoverDatabaseNetworkPayloadAudit(
          'STREAM_FINDER: fetchDiscoverMoviesPageFromStreamFinder (hydrate, pre-request)',
          {
            activeProviderIdsSavedProfile: freshWatchProviderIds,
            currentFeedSource: discoverFeedSourceRef.current,
            currentPageRequested: 1,
            streamFinderPagination: streamFinderRange,
            supabaseOperations: streamFinderMoviesHydrateAuditOps,
          }
        );

        const { movies: mapped, totalAvailable } =
          await fetchDiscoverMoviesPageFromStreamFinder(
            supabase,
            {
              offset: streamFinderRange.offset,
              limit: streamFinderRange.limit,
              watchProviderIds: freshWatchProviderIds,
            },
            providerById
          );
        if (cancelled || streamFinderHydrationDismissedRef.current) return;

        if (__DEV__) {
          console.log(
            `[Discover] Stream Finder hydrate: page1=${mapped.length} titles, catalogTotal=${totalAvailable} (cache read OK)`
          );
        }

        streamFinderPageOffsetRef.current = mapped.length;
        streamFinderTotalRef.current = totalAvailable;

        const enriched = await enrichWithTmdbImages(mapped);
        if (cancelled || streamFinderHydrationDismissedRef.current) return;
        const withYears = await enrichTmdbReleaseYearsForDiscover(enriched);
        if (cancelled || streamFinderHydrationDismissedRef.current) return;
        setPhase1Movies(withYears as DiscoverResult[]);
      } catch (e) {
        console.warn('[Discover] Stream Finder cache load failed:', e);
      } finally {
        if (!cancelled) setStreamFinderListHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [discoverStreamFinderHydrationGeneration]);

  const providerIdsString = useMemo(
    () => providerIds.join('|'),
    [providerIds]
  );

  const fetchMovies = useCallback(
    async (
      year: number | null,
      monet: MonetizationType,
      genres: number[],
      opts?: { providerIdsOverride?: number[] | null }
    ) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      streamFinderHydrationDismissedRef.current = true;
      discoverFeedSourceRef.current = 'tmdb';
      setLoading(true);
      setPhase1Movies([]);
      setPhase2Movies([]);
      setFetchPhase(1);
      setError(null);
      setPage(1);
      setTotalPages(1);

      try {
        const providers =
          opts?.providerIdsOverride != null
            ? [
                ...new Set(
                  opts.providerIdsOverride
                    .map((id) => Math.trunc(Number(id)))
                    .filter((n) => Number.isFinite(n) && n > 0)
                ),
              ]
            : providerIdsString
              ? providerIdsString.split('|').map(Number).filter(Boolean)
              : [];
        logDiscoverDatabaseNetworkPayloadAudit('TMDB: fetchDiscoverFromTMDB phase 1 (pre-request)', {
          activeProviderIdsUsedInQuery: providers,
          currentFeedSource: discoverFeedSourceRef.current,
          currentPageRequested: 1,
          tmdbDiscoverParams: {
            year,
            monetization: monet,
            tmdbPage: 1,
            watchProvidersForUrl: providers,
            genreIds: genres,
            discoverPhase: 1,
            watchRegion: selectedCountry,
          },
        });

        const data = await fetchDiscoverFromTMDB(year, monet, 1, providers, genres, 1, selectedCountry);
        const phase1Results = data.movies;
        setPhase1Movies(phase1Results);

        if (phase1Results.length === 0) {
          setFetchPhase(2);
          logDiscoverDatabaseNetworkPayloadAudit('TMDB: fetchDiscoverFromTMDB phase 2 fallback (pre-request)', {
            activeProviderIdsUsedInQuery: providers,
            currentFeedSource: discoverFeedSourceRef.current,
            currentPageRequested: 1,
            tmdbDiscoverParams: {
              year,
              monetization: monet,
              tmdbPage: 1,
              watchProvidersForUrl: providers,
              genreIds: genres,
              discoverPhase: 2,
              watchRegion: selectedCountry,
            },
          });
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

  useFocusEffect(
    useCallback(() => {
      watchlistRefetchRef.current?.();
      let cancelled = false;

      supabase.auth.getSession().then(async ({ data: { session: incoming } }) => {
        if (cancelled) return;
        setSession((prev) =>
          mergeDiscoverAuth(prev, incoming as DiscoverLocalSession)
        );
        const uid = incoming?.user?.id ?? null;

        try {
          const ids = await resolvePrunedProviderSelections(supabase, {
            userId: uid,
          });
          if (cancelled) return;
          setProviderIds(ids);
        } catch (err) {
          console.warn('[Discover] focus session / provider resolve failed:', err);
        }
      });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || loading) return;

    if (discoverFeedSourceRef.current === 'stream-finder') {
      const nextOffset = streamFinderPageOffsetRef.current;
      const total = streamFinderTotalRef.current;
      const pmap = streamFinderProvidersRef.current;
      if (pmap == null || total === 0 || nextOffset >= total) return;

      loadingMoreRef.current = true;
      setLoadingMore(true);

      try {
        const wmIds = [...providerIdsRef.current];
        const sfPag = { offset: nextOffset, limit: STREAM_FINDER_DISCOVER_PAGE_SIZE };
        const streamFinderMoviesLoadMoreAuditOps =
          wmIds.length > 0
            ? [
                {
                  kind: 'rpc' as const,
                  name: 'stream_finder_discover_page_filtered',
                  params: {
                    p_provider_ids: wmIds,
                    p_offset: sfPag.offset,
                    p_limit: sfPag.limit,
                  },
                  filterSemantics:
                    'stream_finder_movies ∩ movie_availability via EXISTS(provider_id = ANY(p_provider_ids))',
                },
                {
                  table: 'movie_availability' as const,
                  select: 'movie_id, provider_id',
                  filter: 'movie_id IN (page tmdb_ids)',
                },
              ]
            : [
                {
                  table: 'stream_finder_movies' as const,
                  select: 'tmdb_id, title, popularity, overview, poster_path',
                  order: 'popularity desc',
                  range: `range(${sfPag.offset}, ${sfPag.offset + sfPag.limit - 1})`,
                },
                {
                  table: 'movie_availability' as const,
                  select: 'movie_id, provider_id',
                  filter: 'movie_id in (page tmdb_ids)',
                },
              ];

        logDiscoverDatabaseNetworkPayloadAudit(
          'STREAM_FINDER: fetchDiscoverMoviesPageFromStreamFinder (loadMore, pre-request)',
          {
            activeProviderIdsSavedProfile: wmIds,
            currentFeedSource: discoverFeedSourceRef.current,
            currentPageRequested: typeof page !== 'undefined' ? page : 1,
            streamFinderPagination: sfPag,
            streamFinderTotalKnown: total,
            supabaseOperations: streamFinderMoviesLoadMoreAuditOps,
          }
        );

        const { movies: pageMovies, totalAvailable } =
          await fetchDiscoverMoviesPageFromStreamFinder(
            supabase,
            {
              offset: nextOffset,
              limit: STREAM_FINDER_DISCOVER_PAGE_SIZE,
              watchProviderIds: wmIds,
            },
            pmap
          );
        if (discoverFeedSourceRef.current !== 'stream-finder') return;

        streamFinderTotalRef.current = totalAvailable;

        const enriched = await enrichWithTmdbImages(pageMovies);
        if (discoverFeedSourceRef.current !== 'stream-finder') return;
        const withYears = await enrichTmdbReleaseYearsForDiscover(enriched);
        if (discoverFeedSourceRef.current !== 'stream-finder') return;

        setPhase1Movies((prev) => [...prev, ...(withYears as DiscoverResult[])]);
        streamFinderPageOffsetRef.current = nextOffset + pageMovies.length;
      } catch (err) {
        console.error('[Discover] Stream Finder loadMore:', err);
      } finally {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
      return;
    }

    if (page >= totalPages) {
      if (fetchPhase === 1) {
        loadingMoreRef.current = true;
        setLoadingMore(true);
        setFetchPhase(2);

        try {
          logDiscoverDatabaseNetworkPayloadAudit('TMDB: fetchDiscoverFromTMDB phase 2 (loadMore bridge, pre-request)', {
            activeProviderIdsUsedInQuery: providerIds,
            currentFeedSource: discoverFeedSourceRef.current,
            currentPageRequested: 1,
            tmdbDiscoverParams: {
              year: selectedYear,
              monetization,
              tmdbPage: 1,
              watchProvidersForUrl: providerIds,
              genreIds: selectedGenres,
              discoverPhase: 2,
              watchRegion: selectedCountry,
            },
          });
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
      logDiscoverDatabaseNetworkPayloadAudit('TMDB: fetchDiscoverFromTMDB pagination (loadMore, pre-request)', {
        activeProviderIdsUsedInQuery: providerIds,
        currentFeedSource: discoverFeedSourceRef.current,
        currentPageRequested: nextPage,
        tmdbDiscoverParams: {
          year: selectedYear,
          monetization,
          tmdbPage: nextPage,
          watchProvidersForUrl: providerIds,
          genreIds: selectedGenres,
          discoverPhase: fetchPhase,
          watchRegion: selectedCountry,
        },
      });
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
    const perRow = isTV ? TV_MOVIE_GRID_COLUMNS : numColumns;
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
  }, [phase1Movies, phase2Movies, fetchPhase, dividerTitle, isTV, numColumns]);

  const tvDiscoverListLayoutMetrics = useMemo(() => {
    if (!isTV) return null;
    const rowH = DISCOVER_TV_LIST_MOVIE_ROW_LAYOUT_HEIGHT_PX;
    const divH = DISCOVER_TV_LIST_PHASE_DIVIDER_HEIGHT_PX;
    const lengths = listData.map((it) => (it.type === 'divider' ? divH : rowH));
    const offsets: number[] = [];
    let acc = 0;
    for (let i = 0; i < lengths.length; i++) {
      offsets.push(acc);
      acc += lengths[i]!;
    }
    return { lengths, offsets };
  }, [isTV, listData]);

  const discoverTvRowSnapUniform =
    isTV && !listData.some((x) => x.type === 'divider');

  const discoverTvGetItemLayout = useCallback(
    (_data: ArrayLike<ListItem> | null | undefined, index: number) => {
      if (discoverTvRowSnapUniform) {
        return {
          length: DISCOVER_TV_VERTICAL_ROW_SCROLL_UNIT_PX,
          offset: DISCOVER_TV_VERTICAL_ROW_SCROLL_UNIT_PX * index,
          index,
        };
      }
      const m = tvDiscoverListLayoutMetrics;
      if (!m) {
        return { length: 0, offset: 0, index };
      }
      return {
        length: m.lengths[index] ?? 0,
        offset: m.offsets[index] ?? 0,
        index,
      };
    },
    [discoverTvRowSnapUniform, tvDiscoverListLayoutMetrics]
  );

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
          nativeID="discoverAllFilterButton"
          collapsable={false}
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
        /* Non-TV row spread via MoviePosterRow + distributePosterRow (vertical list cannot use columnWrapperStyle / numColumns with divider rows).
         * TV: no `viewabilityConfig` / `itemVisiblePercentThreshold` here — vertical stride relies on `getItemLayout` + native focus bounds inside `TvMovieGridRow` Pressable.
         */
        <FlatList
          key={
            isTV
              ? `discover-tv-list-stride-${DISCOVER_TV_VERTICAL_ROW_SCROLL_UNIT_PX}`
              : `discover-poster-grid-${numColumns}`
          }
          data={listData}
          extraData={isTV ? wrapNavVersion : undefined}
          keyExtractor={(item) => item.key}
          getItemLayout={isTV ? discoverTvGetItemLayout : undefined}
          snapToInterval={
            discoverTvRowSnapUniform ? DISCOVER_TV_VERTICAL_ROW_SCROLL_UNIT_PX : undefined
          }
          snapToAlignment="start"
          disableIntervalMomentum={discoverTvRowSnapUniform}
          decelerationRate={isTV ? 'fast' : 'normal'}
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
          onEndReachedThreshold={0.5}
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

            const renderDiscoverFooter = (movie: DiscoverResult) => (
              <View style={styles.discoverPosterMetaFooter} pointerEvents="none">
                <Text
                  style={[
                    styles.discoverPosterMetaCombined,
                    {
                      fontSize: DISCOVER_POSTER_META_TITLE_PX,
                      lineHeight: Math.round(DISCOVER_POSTER_META_TITLE_PX * 1.45),
                    },
                    isTV && {
                      fontSize: tvBodyFontSize(DISCOVER_POSTER_META_TITLE_PX),
                      lineHeight: Math.round(
                        tvBodyFontSize(DISCOVER_POSTER_META_TITLE_PX) * 1.45
                      ),
                    },
                  ]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {formatDiscoverPosterMetaLine(movie)}
                </Text>
              </View>
            );

            if (isTV) {
              const movieRowIndex = item.movieRowIndex;
              const isLastMovieRow = movieRowIndex === totalMovieRows - 1;
              const nextRowEntryTag =
                rowEntryTags.current[movieRowIndex + 1] ?? null;
              const lastRowLastCellWallTag = isLastMovieRow
                ? (rowExitTags.current[movieRowIndex] ?? null)
                : null;
              return (
                <TvMovieGridRow
                  movies={item.movies}
                  onPress={(movie) => router.push(`/movie/${movie.id}`)}
                  listVerticalPad={DISCOVER_TV_MOVIE_GRID_LIST_VERTICAL_PAD_PX}
                  renderMovieFooter={(movie) =>
                    renderDiscoverFooter(movie as DiscoverResult)
                  }
                  tvFocus={
                    Platform.OS === 'android'
                      ? {
                          movieRowIndex,
                          nextRowEntryTag,
                          lastRowLastCellWallTag,
                          setRowEntryRef,
                          setRowExitRef,
                          isLastMovieRow,
                          wrapNavVersion,
                          sidebarLeftNavTag: discoverSidebarLeftTag,
                          mainContentEntryNavTag:
                            mainContentEntryNativeTag ?? null,
                        }
                      : undefined
                  }
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
        <View style={styles.discoverTvContentWrap}>
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
    paddingTop: DISCOVER_YEAR_CHIP_ROW_HEIGHT_PX,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  /**
   * TV: fills space beside sidebar (`flex:1`); static poster sizing — left pad clears focus ring vs rail.
   */
  discoverTvContentWrap: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingLeft: DISCOVER_TV_CONTENT_PAD_LEFT,
    paddingRight: DISCOVER_TV_RIGHT_MARGIN,
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
    marginBottom: DISCOVER_HEADER_TO_RAIL_GAP_PX,
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
    marginBottom: DISCOVER_HEADER_TO_RAIL_GAP_PX,
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
  discoverPosterMetaFooter: {
    marginTop: DISCOVER_POSTER_META_FOOTER_MARGIN_TOP_PX,
    maxWidth: 140,
    width: '100%',
    height: DISCOVER_POSTER_META_FOOTER_CONTENT_HEIGHT_PX,
    justifyContent: 'flex-start',
  },
  discoverPosterMetaCombined: {
    fontWeight: '400',
    color: '#e5e7eb',
    width: '100%',
  },
  endOfListText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
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
  nativeID?: string;
  collapsable?: boolean;
};

function MonetizationFilterChip({
  label,
  isSelected,
  onPress,
  nativeID,
  collapsable,
}: MonetizationFilterChipProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      {...(nativeID != null ? { nativeID } : {})}
      {...(collapsable === false ? { collapsable: false } : {})}
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