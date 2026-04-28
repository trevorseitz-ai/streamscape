import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Keyboard,
  Platform,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MovieCard, type Movie } from '../../components/MovieCard';
import { useWatchlistStatus } from '../../lib/watchlist-status-context';
import { useCountry } from '../../lib/country-context';
import { useSearch } from '../../lib/search-context';
import { HomeHeader } from '../../components/HomeHeader';
import { fetchTmdb } from '../../lib/tmdbFetch';
import { isTvTarget } from '../../lib/isTv';
import { tvBodyFontSize, tvFontSize, tvTitleFontSize } from '../../lib/tvTypography';
import { tvFocusable } from '../../lib/tvFocus';
import { tvAndroidNavProps } from '../../lib/tvAndroidNavProps';
import { useTvSearchFocusBridge } from '../../lib/tv-search-focus-context';
import { useTvNativeTag } from '../../hooks/useTvNativeTag';
import { supabase } from '../../lib/supabase';
import { TvFocusGuideView } from '../../components/TvFocusGuideView';
import { TV_SIDEBAR_WIDTH } from '../../components/TvSidebarTabBar';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

/** TV focus ring (art.md) */
const ELECTRIC_CYAN = '#00F5FF';

/** Locked TV Home layout — see `docs/depts/tv.md` / `tv.md`. */
const TV_HERO_HEIGHT_PX = 220;
/** Fixed hero backdrop column — design width **391** at height **220** (~16:9). */
const TV_HERO_IMAGE_WIDTH_PX = 391;
/** Hero banner copy + image fit — see `docs/depts/tv.md`. */
const TV_HERO_TITLE_FONT = 18;
const TV_HERO_META_FONT = 12;
const TV_FIXED_POSTER_WIDTH = 140;
const TV_FIXED_POSTER_HEIGHT = 210;
const TV_GRID_COLUMNS = 5;
const TV_GAP = 12;
const TV_SECTION_HEADER_FONT = 22;

interface TrendingMovie extends Movie {
  backdrop_url: string | null;
}

const MAIN_HORIZONTAL_PADDING = 20;
/** TV Home: inset inside green `ScrollView` — 10px from sidebar-adjacent edge and from right screen edge (via content column). */
const TV_HOME_CONTENT_PAD_X = 10;
const TRENDING_GAP_PHONE = 10;
const TRENDING_GAP_TV = TV_GAP;

export default function HomeScreen() {
  const router = useRouter();
  const status = useWatchlistStatus();
  const { width, height } = useWindowDimensions();
  /** TV detection: `Platform.isTV`, or `expoConfig.extra.isTV` — see `lib/isTv.ts`. Web is never TV. */
  const isTV = isTvTarget();
  const windowWidth = Dimensions.get('window').width;
  const screenBg = isTV ? '#121212' : '#0f0f0f';
  const horizontalPad = isTV ? TV_HOME_CONTENT_PAD_X : MAIN_HORIZONTAL_PADDING;
  const heroHeight = isTV ? TV_HERO_HEIGHT_PX : height * 0.4;

  /** Android TV: non-Pressable surfaces must not participate in the focus graph. */
  const tvNf = isTV && Platform.OS === 'android' ? ({ focusable: false, collapsable: false } as const) : {};
  const [session, setSession] = useState<{ user: { id: string; email?: string } } | null>(null);

  const handleLogout = useCallback(() => {
    supabase.auth.signOut();
  }, []);

  /** Use stable `refetch` — entire `status` identity updates whenever watchlists change (would churn `useFocusEffect`). */
  const refetchWatchlistStatus = status?.refetch;
  useFocusEffect(
    useCallback(() => {
      refetchWatchlistStatus?.();
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s);
      });
    }, [refetchWatchlistStatus])
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => setSession(s)
    );
    return () => subscription.unsubscribe();
  }, []);
  const { selectedCountry } = useCountry();
  const { setSearchResult, setSearchError } = useSearch();
  const { setMainContentEntryNativeTag, setTvContentHasFocus, sidebarSlotNativeTags } =
    useTvSearchFocusBridge();
  const { setRef: setHeroMainEntryRef, nativeTag: heroMainEntryTag } = useTvNativeTag();
  /** Android TV: first “Trending Now” poster — hero `nextFocusDown` must not skip row 1. */
  const [firstTrendingPosterTag, setFirstTrendingPosterTag] = useState<number | null>(null);
  const [heroViewDetailsFocused, setHeroViewDetailsFocused] = useState(false);
  const [trending, setTrending] = useState<TrendingMovie[]>([]);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  const [trendingLoading, setTrendingLoading] = useState(true);

  useEffect(() => {
    async function loadTrending() {
      setTrendingLoading(true);
      setTrendingError(null);
      const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
      if (!apiKey) {
        setTrendingError(
          'TMDB trending: API key missing. Set EXPO_PUBLIC_TMDB_API_KEY and restart Metro.'
        );
        setTrendingLoading(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      try {
        const res = await fetchTmdb(
          '/trending/movie/day',
          { language: 'en-US', region: selectedCountry },
          apiKey,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        if (!res.ok) {
          const text = await res.text();
          let msg = `TMDB error ${res.status}`;
          try {
            const j = JSON.parse(text) as { status_message?: string };
            if (j.status_message) msg = j.status_message;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }
        const data = await res.json();

        const movies: TrendingMovie[] = (data.results ?? [])
          .slice(0, 10)
          .map((m: { id: number; title: string; poster_path: string | null; backdrop_path: string | null; release_date?: string; vote_average?: number }) => ({
            id: String(m.id),
            title: m.title,
            poster_url: m.poster_path ? `${TMDB_IMAGE_BASE}${m.poster_path}` : null,
            backdrop_url: m.backdrop_path ? `${TMDB_IMAGE_BASE}${m.backdrop_path}` : null,
            release_year: m.release_date
              ? parseInt(m.release_date.slice(0, 4), 10)
              : null,
            vote_average: m.vote_average ?? null,
          }));

        setTrending(movies);
      } catch (err) {
        console.error('Trending fetch error:', err);
        if (err instanceof Error) {
          const base =
            err.name === 'AbortError'
              ? 'Request timed out. Check network and try again.'
              : err.message === 'Network request failed' || err.message === 'Failed to fetch'
                ? 'Network request failed (HTTPS to api.themoviedb.org). TV/emulator must allow internet; not the same as Metro on your Mac.'
                : err.message;
          setTrendingError(`TMDB trending: ${base}`);
        } else {
          setTrendingError('TMDB trending: Could not load trending movies');
        }
      } finally {
        clearTimeout(timeoutId);
        setTrendingLoading(false);
      }
    }

    loadTrending();
  }, [selectedCountry]);

  const heroMovie = trending.length > 0 ? trending[0] : null;
  const restTrending = trending.slice(1);

  const trendingGap = isTV ? TRENDING_GAP_TV : TRENDING_GAP_PHONE;

  /** TV: fixed 5 columns to match real layout & focus [R,C] math. Phone: 3 or 2. */
  const gridColumnCount = (() => {
    if (isTV) {
      return TV_GRID_COLUMNS;
    }
    return width >= 430 ? 3 : 2;
  })();
  /** TV: two grid rows of posters to match hard-bounded “floor” focus & right-edge clamp. */
  const maxTrendingGridCells = isTV
    ? 2 * gridColumnCount
    : restTrending.length;
  const trendingGridMovies = isTV
    ? restTrending.slice(0, maxTrendingGridCells)
    : restTrending;
  const homeSidebarLeftTag =
    isTV && Platform.OS === 'android' ? (sidebarSlotNativeTags['index'] ?? null) : null;
  const trendingGridCount = trendingGridMovies.length;
  const numTrendingGridRows =
    trendingGridCount > 0 ? Math.ceil(trendingGridCount / gridColumnCount) : 0;
  /**
   * TV: usable row width beside the left rail (`Discover` uses the same shell − sidebar math).
   * Phone: full window minus horizontal padding only.
   */
  const tvRowUsableWidth = useMemo(() => {
    const pad = horizontalPad * 2;
    if (!isTV) return Math.max(0, width - pad);
    return Math.max(0, width - TV_SIDEBAR_WIDTH - pad);
  }, [isTV, width, horizontalPad]);
  const trendingContentWidth = tvRowUsableWidth;
  const trendingCardWidth =
    (trendingContentWidth - trendingGap * (gridColumnCount - 1)) / gridColumnCount;

  const handleMoviePress = (movie: Movie) => {
    Keyboard.dismiss();
    setSearchResult(null);
    setSearchError(null);
  };

  const openHeroMovie = useCallback(() => {
    if (heroMovie == null) return;
    Keyboard.dismiss();
    setSearchResult(null);
    setSearchError(null);
    router.push(`/movie/${heroMovie.id}`);
  }, [heroMovie, router, setSearchResult, setSearchError]);

  /** Android TV: sidebar `nextFocusRight` targets this view tag (see TvSidebarTabBar). */
  useEffect(() => {
    if (!isTV || Platform.OS !== 'android') {
      return;
    }
    if (heroMovie == null || heroMainEntryTag == null) {
      setMainContentEntryNativeTag(null);
      return;
    }
    setMainContentEntryNativeTag(heroMainEntryTag);
    return () => setMainContentEntryNativeTag(null);
  }, [isTV, heroMovie, heroMainEntryTag, setMainContentEntryNativeTag]);

  useEffect(() => {
    if (restTrending.length === 0) {
      setFirstTrendingPosterTag(null);
    }
  }, [restTrending.length]);

  // Auth guard: blackout when not logged in (immediate effect on signOut)
  if (!session) {
    return (
      <View style={styles.blackout} {...tvNf}>
        <Text
          style={[styles.blackoutBrand, isTV && { fontSize: tvTitleFontSize(24) }]}
        >
          ReelDive
        </Text>
        <Pressable
          {...tvFocusable()}
          style={styles.blackoutButton}
          onPress={() => router.push('/login')}
        >
          <Text
            style={[
              styles.blackoutButtonText,
              isTV && { fontSize: tvBodyFontSize(16) },
            ]}
          >
            Log In
          </Text>
        </Pressable>
      </View>
    );
  }

  const HeaderWrapper =
    Platform.OS === 'web' || isTV ? View : SafeAreaView;

  const mainColumn = (
    <>
      {!isTV ? (
        <HeaderWrapper style={[styles.safeHeader, { backgroundColor: screenBg }]}>
          <HomeHeader
            session={session}
            onLogout={handleLogout}
            onLogin={() => router.push('/login')}
          />
        </HeaderWrapper>
      ) : null}
      <ScrollView
        {...(isTV && Platform.OS === 'android' ? { focusable: false } : {})}
        style={styles.mainScroll}
        contentContainerStyle={[
          styles.mainContentContainer,
          isTV
            ? {
                paddingLeft: TV_HOME_CONTENT_PAD_X,
                paddingRight: TV_HOME_CONTENT_PAD_X,
                paddingTop: 3,
                paddingBottom: 60,
              }
            : { paddingHorizontal: horizontalPad },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {trendingError && !trendingLoading ? (
          <View style={styles.trendingErrorBanner} {...tvNf}>
            <Text
              style={[
                styles.trendingErrorTitle,
                isTV && { fontSize: tvTitleFontSize(15) },
              ]}
            >
              Trending couldn’t load
            </Text>
            <Text
              style={[
                styles.trendingErrorBody,
                isTV && { fontSize: tvBodyFontSize(13) },
              ]}
            >
              {trendingError}
            </Text>
            <Text
              style={[
                styles.trendingErrorHint,
                isTV && { fontSize: tvBodyFontSize(11) },
              ]}
            >
              This request uses HTTPS to TMDB on the public internet. The shell and header loaded from
              Metro — if you only see this error, fix outbound internet / DNS on the device, not the
              Mac↔emulator link.
            </Text>
          </View>
        ) : null}
        {/* Hero #1 Trending */}
        {trendingLoading ? (
          <View
            style={[
              styles.heroSkeleton,
              { height: heroHeight },
              isTV && { marginBottom: 3, width: '100%', alignSelf: 'stretch' },
            ]}
            {...tvNf}
          >
            <ActivityIndicator size="large" color="#6366f1" />
            <Text
              style={[
                styles.heroSkeletonText,
                isTV && { fontSize: tvBodyFontSize(14) },
              ]}
            >
              Loading trending for your region...
            </Text>
          </View>
        ) : heroMovie ? (
          /* Branch order: heroMovie → `isTV ?` TV hero : phone hero — never reversed */
          isTV ? (
            <View
              style={styles.heroShellTv}
              {...tvNf}
              collapsable={false}
            >
              <View style={styles.heroContentTv} pointerEvents="box-none" {...tvNf}>
                <View style={styles.heroBadge} {...tvNf}>
                  <Text
                    style={[
                      styles.heroBadgeText,
                      isTV && { fontSize: tvFontSize(11) },
                    ]}
                  >
                    #1 Trending Now
                  </Text>
                </View>
                <Text
                  style={[
                    styles.heroTitle,
                    isTV && { fontSize: TV_HERO_TITLE_FONT },
                  ]}
                >
                  {heroMovie.title}
                </Text>
                <View style={styles.heroMeta} {...tvNf}>
                  {heroMovie.release_year != null ? (
                    <Text
                      style={[
                        styles.heroYear,
                        isTV && { fontSize: TV_HERO_META_FONT },
                      ]}
                    >
                      {heroMovie.release_year}
                    </Text>
                  ) : null}
                  {heroMovie.vote_average != null ? (
                    <View style={styles.heroRating} {...tvNf}>
                      <Text
                        style={[
                          styles.heroRatingStar,
                          isTV && { fontSize: TV_HERO_META_FONT },
                        ]}
                      >
                        ★
                      </Text>
                      <Text
                        style={[
                          styles.heroRatingText,
                          isTV && { fontSize: TV_HERO_META_FONT },
                        ]}
                      >
                        {(Math.round(heroMovie.vote_average * 10) / 10).toFixed(1)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Pressable
                  ref={setHeroMainEntryRef as never}
                  focusable
                  {...tvFocusable()}
                  {...(isTV &&
                  Platform.OS === 'android' &&
                  firstTrendingPosterTag != null
                    ? tvAndroidNavProps({
                        nextFocusDown: firstTrendingPosterTag,
                        nextFocusRight: firstTrendingPosterTag,
                      })
                    : {})}
                  onPress={openHeroMovie}
                  onFocus={() => {
                    setHeroViewDetailsFocused(true);
                    setTvContentHasFocus(true);
                    console.log('[D-PAD FOCUS] Landed on: Hero View Details');
                  }}
                  onBlur={() => {
                    setHeroViewDetailsFocused(false);
                    if (__DEV__) {
                      console.log('[D-PAD BLUR] Left: Hero View Details');
                    }
                  }}
                  style={[
                    styles.heroViewDetailsButton,
                    heroViewDetailsFocused && styles.heroViewDetailsButtonFocused,
                  ]}
                >
                  <Text
                    style={[
                      styles.heroButtonText,
                      isTV && { fontSize: tvBodyFontSize(14) },
                    ]}
                  >
                    View Details
                  </Text>
                </Pressable>
              </View>
              <View style={styles.heroTvImageColumn} {...tvNf}>
                <Pressable
                  focusable={false}
                  onPress={openHeroMovie}
                  style={StyleSheet.absoluteFill}
                >
                  {heroMovie.backdrop_url ? (
                    <Image
                      source={{ uri: heroMovie.backdrop_url }}
                      style={styles.heroBackdropTvInner}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.heroBackdropPlaceholderTv} {...tvNf} />
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              {...tvFocusable()}
              style={[styles.heroContainer, styles.heroTouchable, { height: heroHeight }]}
              onPress={() => {
                handleMoviePress(heroMovie);
                router.push(`/movie/${heroMovie.id}`);
              }}
            >
              {heroMovie.backdrop_url ? (
                <Image
                  source={{ uri: heroMovie.backdrop_url }}
                  style={styles.heroBackdrop}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.heroBackdropPlaceholder} />
              )}
              <View style={styles.heroOverlay} />
              <View style={styles.heroContent}>
                <View style={styles.heroBadge}>
                  <Text
                    style={[
                      styles.heroBadgeText,
                      isTV && { fontSize: tvFontSize(11) },
                    ]}
                  >
                    #1 Trending Today
                  </Text>
                </View>
                <Text
                  style={[
                    styles.heroTitle,
                    isTV && { fontSize: tvTitleFontSize(26) },
                  ]}
                >
                  {heroMovie.title}
                </Text>
                <View style={styles.heroMeta}>
                  {heroMovie.release_year != null ? (
                    <Text
                      style={[
                        styles.heroYear,
                        isTV && { fontSize: tvBodyFontSize(14) },
                      ]}
                    >
                      {heroMovie.release_year}
                    </Text>
                  ) : null}
                  {heroMovie.vote_average != null ? (
                    <View style={styles.heroRating}>
                      <Text
                        style={[
                          styles.heroRatingStar,
                          isTV && { fontSize: tvFontSize(13) },
                        ]}
                      >
                        ★
                      </Text>
                      <Text
                        style={[
                          styles.heroRatingText,
                          isTV && { fontSize: tvBodyFontSize(14) },
                        ]}
                      >
                        {(Math.round(heroMovie.vote_average * 10) / 10).toFixed(1)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.heroButton}>
                  <Text
                    style={[
                      styles.heroButtonText,
                      isTV && { fontSize: tvBodyFontSize(14) },
                    ]}
                  >
                    View Details
                  </Text>
                </View>
              </View>
            </Pressable>
          )
        ) : null}

        {/* Trending Now #2–#10 */}
        {trendingLoading ? (
          isTV ? (
            <View style={styles.trendingGridLoadingShim} {...tvNf} />
          ) : (
            <View style={styles.bottomHalf} />
          )
        ) : restTrending.length > 0 ? (
          <View
            style={[
              styles.bottomHalf,
              isTV && styles.bottomHalfTv,
            ]}
            {...tvNf}
          >
            {isTV ? (
              <View {...tvNf}>
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      fontSize: TV_SECTION_HEADER_FONT,
                      marginBottom: 8,
                    },
                  ]}
                >
                  Trending Now
                </Text>
              </View>
            ) : (
              <Text style={styles.sectionTitle}>Trending Now</Text>
            )}
            <View
              style={
                isTV
                  ? {
                      width: '100%',
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                    }
                  : [styles.trendingGrid, { gap: trendingGap }]
              }
              {...tvNf}
            >
              {trendingGridMovies.map((movie, idx) => {
                const rowIndex = Math.floor(idx / gridColumnCount);
                const colIndex = idx % gridColumnCount;
                const isTopRow = rowIndex === 0;
                const isRightEdge =
                  isTV &&
                  (colIndex === gridColumnCount - 1 || idx === trendingGridCount - 1);
                /** First cell only — native tag for Hero `nextFocusDown` / `nextFocusRight`. */
                const isFirstGridPoster = idx === 0;
                const isLeftCol = colIndex === 0;
                const isBottomRow =
                  trendingGridCount > 0 && rowIndex === numTrendingGridRows - 1;
                const isLastCol = colIndex === gridColumnCount - 1;
                return (
                  <View
                    key={movie.id}
                    style={
                      isTV
                        ? {
                            width: trendingCardWidth,
                            marginRight: isLastCol ? 0 : 12,
                            marginBottom: 20,
                          }
                        : { width: trendingCardWidth }
                    }
                    {...tvNf}
                  >
                    <MovieCard
                      movie={movie}
                      onPress={() => handleMoviePress(movie)}
                      posterWidth={isTV ? TV_FIXED_POSTER_WIDTH : undefined}
                      posterHeight={isTV ? TV_FIXED_POSTER_HEIGHT : undefined}
                      tvClampFocusRight={isRightEdge}
                      onTvPosterNavTag={
                        isFirstGridPoster && isTV && Platform.OS === 'android'
                          ? setFirstTrendingPosterTag
                          : undefined
                      }
                      tvNextFocusUp={
                        isTopRow && isTV && Platform.OS === 'android'
                          ? heroMainEntryTag
                          : null
                      }
                      tvNextFocusLeft={
                        isLeftCol && isTV && Platform.OS === 'android'
                          ? homeSidebarLeftTag
                          : null
                      }
                      tvNextFocusDown={
                        isBottomRow && isTV && Platform.OS === 'android'
                          ? heroMainEntryTag
                          : null
                      }
                    />
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.bottomHalf} {...tvNf}>
            <Text
              style={[
                styles.trendingEmpty,
                isTV && { fontSize: tvBodyFontSize(14) },
              ]}
            >
              {trendingError ??
                (trending.length === 0
                  ? 'TMDB trending: nothing to show'
                  : 'No more trending')}
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );

  return (
    <View
      {...(isTV && Platform.OS === 'android' ? tvNf : {})}
      style={[
        styles.wrapper,
        { backgroundColor: screenBg },
        isTV && { width: windowWidth, alignSelf: 'stretch' },
      ]}
    >
      {isTV ? (
        <TvFocusGuideView style={styles.tvMainGuide}>{mainColumn}</TvFocusGuideView>
      ) : (
        mainColumn
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  blackout: {
    flex: 1,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  blackoutBrand: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 32,
  },
  blackoutButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  blackoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  wrapper: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  tvMainGuide: {
    flex: 1,
    minWidth: 0,
  },
  mainScroll: {
    flex: 1,
  },
  mainContentContainer: {
    paddingTop: 12,
    paddingBottom: 40,
  },
  bottomHalf: {
    paddingTop: 12,
  },
  /** TV: do not use `flex:1` in ScrollView while loading — it creates a phantom flex gap above the grid. */
  trendingGridLoadingShim: {
    width: '100%',
    height: 0,
  },
  /**
   * No `flex: 1` here — in a `ScrollView` it can over-expand the section and confuses
   * Android’s default vertical focus search relative to the hero.
   * Top margin keeps the section title + first poster row in a clean band below the hero.
   */
  bottomHalfTv: {
    flex: 0,
    flexGrow: 0,
    /** Was 8 — reduce gap vs Hero by ~75% (≈2). */
    marginTop: 2,
    /** Overrides `bottomHalf.paddingTop` (12) → ~75% reduction for TV band. */
    paddingTop: 3,
  },
  safeHeader: {
    backgroundColor: '#0f0f0f',
    zIndex: 10,
    elevation: 10,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  heroSkeleton: {
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroSkeletonText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  /** Phone hero outer-only — do not compose with `heroShellTv`. */
  heroShell: {
    borderRadius: 16,
    marginBottom: 12,
    position: 'relative',
    overflow: 'visible',
  },
  /** TV hero shell only — flex row + pad + gap below trending grid. */
  heroShellTv: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 20,
    marginBottom: 7,
    position: 'relative',
  },
  /** Clips backdrop only; keeps rounded corners without clipping the focus ring. */
  heroMediaClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  /** TV: left stack — fills remaining row width with gap before image. */
  heroContentTv: {
    flex: 1,
    minWidth: 0,
    paddingRight: 40,
    justifyContent: 'flex-end',
  },
  /** Fixed-size backdrop slot (`391×220`). */
  heroTvImageColumn: {
    width: TV_HERO_IMAGE_WIDTH_PX,
    height: TV_HERO_HEIGHT_PX,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
  },
  heroBackdropTvInner: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  heroBackdropPlaceholderTv: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a',
  },
  heroContainer: {
    borderRadius: 16,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  heroTouchable: {
    zIndex: 10,
  },
  heroBackdrop: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroBackdropPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  heroContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 20,
    zIndex: 2,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#6366f1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  heroYear: {
    fontSize: 14,
    color: '#d1d5db',
    fontWeight: '500',
  },
  heroRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroRatingStar: {
    fontSize: 13,
    color: '#facc15',
  },
  heroRatingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  heroButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  /** TV: dedicated D-pad target — registered as `mainContentEntryNativeTag` (Android). */
  heroViewDetailsButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 3,
    borderColor: 'transparent',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  heroViewDetailsButtonFocused: {
    borderColor: ELECTRIC_CYAN,
  },
  heroButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  trendingGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  trendingEmpty: {
    fontSize: 14,
    color: '#6b7280',
  },
  trendingErrorBanner: {
    backgroundColor: '#1e1b4b',
    borderWidth: 1,
    borderColor: '#4338ca',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  trendingErrorTitle: {
    color: '#e0e7ff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  trendingErrorBody: {
    color: '#c7d2fe',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  trendingErrorHint: {
    color: '#818cf8',
    fontSize: 11,
    lineHeight: 16,
  },
});
