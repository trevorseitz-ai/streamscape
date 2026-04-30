import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
  Alert,
  Keyboard,
  Modal,
  Dimensions,
  FlatList,
  findNodeHandle,
} from 'react-native';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { resolvePrunedProviderSelections } from '../../lib/stream-finder-supabase';
import {
  getDirectStreamingLinks,
  normalizeTmdbIdForStreaming,
  type StreamingOption,
} from '../../lib/streaming';
import {
  type WatchProviderCountry,
  type WatchProviderEntry,
  normalizeWatchProvidersCountries,
} from '../../lib/tmdb-watch-providers';
import { useCountry } from '../../lib/country-context';
import { useSearch } from '../../lib/search-context';
import { isTvTarget, shouldUseTvDpadFocus } from '../../lib/isTv';
import { tvFocusable, tvPreferredFocusProps } from '../../lib/tvFocus';
import { useMovie } from '../../lib/movie-context';
import { tvAndroidNavProps } from '../../lib/tvAndroidNavProps';
import { TrailerPlayer } from '../../components/TrailerPlayer';
import { SearchResultsOverlay } from '../../components/SearchResultsOverlay';
import { MovieDetailsHeader } from '../../components/MovieDetailsHeader';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useTvNativeTag } from '../../hooks/useTvNativeTag';
import { useTvSearchFocusBridge } from '../../lib/tv-search-focus-context';
import getOmdbScores, { normalizeImdbId } from '../../lib/ratings';
import { getMetroDevServerOrigin } from '../../lib/metroOrigin';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const RATINGS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';
/** TV focus ring (matches `app/(tabs)/index.tsx` art). */
const ELECTRIC_CYAN = '#00F5FF';

type TvRowEntryRefSetter = ReturnType<typeof useTvNativeTag>['setRef'];

interface Person {
  id: string;
  name: string;
  headshot_url: string | null;
  role_type: string;
  character: string | null;
  job: string | null;
}

interface PlatformAvailability {
  id: string;
  provider_id: number;
  platform_name: string;
  access_type: string;
  price: number | null;
  direct_url: string | null;
  logo_url: string | null;
}

interface MovieDetails {
  id: string;
  title: string;
  synopsis: string | null;
  release_year: number | null;
  runtime: number | null;
  /** US MPAA-style certification from TMDB (e.g. PG-13), when available. */
  us_certification?: string | null;
  vote_average: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  type: string;
  cast: Person[];
  availability: PlatformAvailability[];
  watch_link: string | null;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  filming_locations?: string[];
  /** TMDB external id (e.g. tt0111161); drives OMDb lookups. */
  imdb_id?: string | null;
}

interface TMDBRecommendation {
  id: number;
  title: string;
  poster_path: string | null;
}

interface TMDBMovieResponse {
  id: number;
  title: string;
  overview: string | null;
  vote_average?: number;
  runtime?: number;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  credits?: {
    cast?: Array<{
      id: number;
      name: string;
      character: string | null;
      profile_path: string | null;
    }>;
    crew?: Array<{
      id: number;
      name: string;
      job: string;
      profile_path: string | null;
    }>;
  };
  'watch/providers'?: {
    results?: Record<string, {
      link?: string;
      flatrate?: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>;
      free?: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>;
      ads?: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>;
      rent?: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>;
      buy?: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>;
    }>;
  };
  videos?: {
    results?: Array<{ key: string; site: string; type: string }>;
  };
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  keywords?: {
    keywords?: Array<{ id: number; name: string }>;
  };
  release_dates?: {
    results?: Array<{
      iso_3166_1: string;
      release_dates: Array<{ certification?: string; type?: number }>;
    }>;
  };
  /** Present on movie details response when available. */
  imdb_id?: string | null;
}

const CREW_JOBS = new Set([
  'Director', 'Writer', 'Screenplay',
  'Director of Photography', 'First Assistant Director',
]);

const CREW_ROLE_MAP: Record<string, string> = {
  Director: 'director',
  Writer: 'writer',
  Screenplay: 'writer',
  'Director of Photography': 'cinematographer',
  'First Assistant Director': 'assistant_director',
};

function toFullImageUrl(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/')) return null;
  return `${TMDB_IMAGE_BASE}${path}`;
}

function buildAvailabilityFromProviders(
  countryData: WatchProviderCountry | undefined
): PlatformAvailability[] {
  const watchLink = countryData?.link ?? null;
  const availability: PlatformAvailability[] = [];
  const addProviders = (
    list: WatchProviderEntry[] | undefined,
    accessType: string
  ) => {
    for (const p of list ?? []) {
      availability.push({
        id: `${accessType}-${p.provider_name}`,
        provider_id: p.provider_id,
        platform_name: p.provider_name,
        access_type: accessType,
        price: null,
        direct_url: watchLink,
        logo_url: toFullImageUrl(p.logo_path),
      });
    }
  };
  addProviders(countryData?.flatrate, 'subscription');
  return availability;
}

const FORBIDDEN_WORDS = new Set([
  'faith', 'chaos', 'post-apocalyptic', 'bible', 'survival', 'gunfight',
  'blind', 'brutality', 'cannibal', 'combat', 'carnage', 'allegory',
  'dreams', 'heist', 'memory', 'subconscious', 'complex', 'dramatic', 'complicated',
]);

const KNOWN_LOCATIONS = new Set([
  'london', 'paris', 'new york', 'new york city', 'los angeles', 'tokyo',
  'berlin', 'rome', 'moscow', 'sydney', 'toronto', 'vancouver', 'montreal',
  'chicago', 'boston', 'san francisco', 'las vegas', 'miami', 'new orleans',
  'atlanta', 'seattle', 'denver', 'philadelphia', 'washington d.c.', 'houston',
  'dallas', 'austin', 'portland', 'detroit', 'minneapolis', 'nashville',
  'california', 'texas', 'new york', 'florida', 'nevada', 'georgia',
  'arizona', 'new mexico', 'utah', 'colorado', 'oregon', 'washington',
  'united kingdom', 'united states', 'france', 'germany', 'italy', 'spain',
  'japan', 'australia', 'canada', 'mexico', 'brazil', 'india', 'china',
  'russia', 'ireland', 'scotland', 'wales', 'netherlands', 'belgium',
  'switzerland', 'austria', 'greece', 'portugal', 'sweden', 'norway',
  'denmark', 'poland', 'czech republic', 'hungary', 'argentina', 'chile',
  'desert', 'forest', 'jungle', 'mountains', 'beach', 'island', 'ocean',
  'manhattan', 'brooklyn', 'hollywood', 'beverly hills', 'malibu',
  'venice', 'amsterdam', 'barcelona', 'madrid', 'prague', 'budapest',
  'vienna', 'munich', 'cologne', 'hamburg', 'edinburgh', 'dublin',
  'hong kong', 'singapore', 'seoul', 'bangkok', 'istanbul', 'cairo',
  'morocco', 'south africa', 'egypt', 'india',
]);

function parseFilmingLocations(
  keywords: Array<{ id: number; name: string }> | undefined,
  productionCountries: Array<{ iso_3166_1: string; name: string }> | undefined
): string[] {
  const normalize = (s: string) => s.trim().toLowerCase();
  const seen = new Set<string>();
  const cityLocations: string[] = [];

  for (const kw of keywords ?? []) {
    const name = kw.name?.trim();
    if (!name || name.length < 2) continue;
    const key = normalize(name);
    if (FORBIDDEN_WORDS.has(key)) continue;
    if (!KNOWN_LOCATIONS.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    cityLocations.push(name);
  }

  if (cityLocations.length === 0) return [];

  const result = [...cityLocations];

  for (const c of productionCountries ?? []) {
    const name = c.name?.trim();
    if (!name) continue;
    const key = normalize(name);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }

  return result;
}

/** US theatrical/home certification from TMDB release_dates (e.g. PG-13, R). */
function extractUsCertification(
  releaseDates: TMDBMovieResponse['release_dates']
): string | null {
  if (!releaseDates?.results?.length) return null;
  const us = releaseDates.results.find((r) => r.iso_3166_1 === 'US');
  if (!us?.release_dates?.length) return null;
  const withCert = us.release_dates.find(
    (d) => typeof d.certification === 'string' && d.certification.trim() !== ''
  );
  return withCert?.certification?.trim() ?? null;
}

function formatRuntimeMinutes(minutes: number): string {
  if (minutes < 1) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function parseMetascoreNumber(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === '' || raw === 'N/A') return null;
  const n = parseInt(raw.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/** Metacritic-style tier colors: green 61+, yellow 40–60, red under 40 */
function metascoreSquareColor(score: number): string {
  if (score >= 61) return '#66cc33';
  if (score >= 40) return '#ffcc33';
  return '#cc0000';
}

async function fetchMovieFromTMDB(tmdbId: number): Promise<{
  movie: MovieDetails;
  trailerKey: string | null;
  watchProvidersResults: Record<string, WatchProviderCountry> | null;
}> {
  const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
  if (!apiKey) throw new Error('TMDB API key not configured');

  const url = `${TMDB_BASE}/movie/${tmdbId}?append_to_response=credits,watch/providers,videos,keywords,release_dates&language=en-US`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) throw new Error(`Movie not found (TMDB error ${res.status})`);

  const data: TMDBMovieResponse = await res.json();

  const releaseYear = data.release_date
    ? parseInt(data.release_date.slice(0, 4), 10)
    : null;

  const actors: Person[] = (data.credits?.cast ?? []).slice(0, 10).map((c) => ({
    id: String(c.id),
    name: c.name,
    headshot_url: toFullImageUrl(c.profile_path),
    role_type: 'actor',
    character: c.character ?? null,
    job: null,
  }));

  const addedCrew = new Set<string>();
  const crew: Person[] = [];
  for (const c of data.credits?.crew ?? []) {
    if (!CREW_JOBS.has(c.job)) continue;
    const key = `${c.name}::${c.job}`;
    if (addedCrew.has(key)) continue;
    addedCrew.add(key);
    crew.push({
      id: String(c.id),
      name: c.name,
      headshot_url: toFullImageUrl(c.profile_path),
      role_type: CREW_ROLE_MAP[c.job] ?? c.job,
      character: null,
      job: c.job,
    });
  }

  const rawWatchProviders = data['watch/providers']?.results ?? null;
  const watchProvidersResults = normalizeWatchProvidersCountries(rawWatchProviders);
  const us = watchProvidersResults?.US;
  const availability = buildAvailabilityFromProviders(us);

  const trailer = (data.videos?.results ?? []).find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer'
  );

  const usCertification = extractUsCertification(data.release_dates);

  const imdbFromTmdb =
    typeof data.imdb_id === 'string' && data.imdb_id.trim() !== ''
      ? data.imdb_id.trim()
      : null;

  return {
    movie: {
      id: String(data.id),
      title: data.title,
      synopsis: data.overview ?? null,
      release_year: releaseYear,
      runtime: data.runtime ?? null,
      us_certification: usCertification,
      vote_average: data.vote_average ?? null,
      poster_url: toFullImageUrl(data.poster_path),
      backdrop_url: toFullImageUrl(data.backdrop_path),
      type: 'movie',
      cast: [...actors, ...crew],
      availability,
      watch_link: us?.link ?? null,
      production_countries: data.production_countries ?? undefined,
      filming_locations: parseFilmingLocations(
        data.keywords?.keywords,
        data.production_countries
      ),
      imdb_id: imdbFromTmdb,
    },
    trailerKey: trailer?.key ?? null,
    watchProvidersResults,
  };
}

export default function MovieDetailsScreen() {
  const routeParams = useLocalSearchParams<{
    id: string | string[];
    fromWatched?: string | string[];
  }>();
  const id =
    routeParams.id == null
      ? undefined
      : Array.isArray(routeParams.id)
        ? routeParams.id[0]
        : routeParams.id;
  const fromWatched = routeParams.fromWatched;
  const router = useRouter();
  const { selectedCountry } = useCountry();
  const [isUpdatingProviders, setIsUpdatingProviders] = useState(false);
  const prevCountryRef = useRef(selectedCountry);
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [supabaseMediaId, setSupabaseMediaId] = useState<string | null>(null);
  const [enabledServiceIds, setEnabledServiceIds] = useState<Set<number>>(new Set());
  const [watchProvidersResults, setWatchProvidersResults] = useState<Record<string, WatchProviderCountry> | null>(null);
  const [trailerModalVisible, setTrailerModalVisible] = useState(false);
  const [errorBackFocused, setErrorBackFocused] = useState(false);
  const [floatingBackFocused, setFloatingBackFocused] = useState(false);
  const [watchlistBtnFocused, setWatchlistBtnFocused] = useState(false);
  const [similarBtnFocused, setSimilarBtnFocused] = useState(false);
  const [trailerActionBtnFocused, setTrailerActionBtnFocused] = useState(false);
  /** “Owned” / library; toggled in UI, persisted in DB when storage exists. */
  const [isInLibrary, setIsInLibrary] = useState(false);
  const [libraryBtnFocused, setLibraryBtnFocused] = useState(false);
  /** Instant `findNodeHandle` for trailer row self-trap before `useTvNativeTag` commits. */
  const [trailerPressableLocalTag, setTrailerPressableLocalTag] = useState<number | null>(null);
  const [trailerCloseFocused, setTrailerCloseFocused] = useState(false);
  const [tmdbMovieId, setTmdbMovieId] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<TMDBRecommendation[]>(
    []
  );
  /** RapidAPI Streaming Availability deep links (not TMDB watch providers). */
  const [streamingProviders, setStreamingProviders] = useState<
    StreamingOption[]
  >([]);
  /** OMDb / DB cached scores for title row (RT %, Metascore string). */
  const [omdbRatingsDisplay, setOmdbRatingsDisplay] = useState<{
    rt_score: string | null;
    metascore: string | null;
    imdb_rating: string | null;
  } | null>(null);
  const [omdbRatingsLoading, setOmdbRatingsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  /** Stable numeric TMDB id for streaming when it does not change across re-renders (avoids duplicate RapidAPI calls). */
  const resolvedStreamingTmdbId = useMemo((): number | null => {
    if (!id || id === 'undefined' || String(id).trim() === '') return null;
    const normalized = normalizeTmdbIdForStreaming(id);
    if (normalized != null) return normalized;
    if (tmdbMovieId != null && Number.isFinite(tmdbMovieId)) return tmdbMovieId;
    return null;
  }, [id, tmdbMovieId]);

  const loadDirectStreamingLinks = useCallback(
    async (signal?: AbortSignal): Promise<StreamingOption[]> => {
      const currentMovieId = resolvedStreamingTmdbId;

      if (currentMovieId == null) {
        setStreamingProviders([]);
        return [];
      }

      try {
        const result = await getDirectStreamingLinks(
          currentMovieId,
          'movie',
          'us'
        );
        if (signal?.aborted) return [];
        const list = Array.isArray(result) ? result : [];
        setStreamingProviders(list);
        return list;
      } catch {
        if (signal?.aborted) return [];
        setStreamingProviders([]);
        return [];
      }
    },
    [resolvedStreamingTmdbId, id]
  );

  const scrollToRecommendations = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, []);

  async function handleStreamingPress(url: string) {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const w = window.open(url, '_blank');
        if (w) w.opener = null;
        else if (__DEV__) {
          console.warn('[MovieDetails] New window blocked for streaming URL:', url);
        }
        return;
      }
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        if (__DEV__) {
          console.warn('[MovieDetails] Cannot open streaming URL:', url);
        }
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      if (__DEV__) {
        console.warn('[MovieDetails] Failed to open streaming link:', e);
      }
    }
  }

  const {
    isSearching,
    searchResult,
    searchError,
    searchLoading,
    setIsSearching,
    setSearchResult,
    setSearchError,
  } = useSearch();
  const { setTitle } = useMovie();
  const { isLandscape: breakpointLandscape, height: viewportHeight } = useBreakpoint();
  const { sidebarSlotNativeTags } = useTvSearchFocusBridge();
  const isTV = isTvTarget();
  const tvNf =
    isTV && Platform.OS === 'android'
      ? ({ focusable: false, collapsable: false } as const)
      : {};
  const tvDpadFocus = shouldUseTvDpadFocus();
  /** Android D-pad: streams → trailer (if any) → secondary row → cast / crew; explicit tags in `buildLadder`. */
  const { setRef: setStreamRowEntryRef, nativeTag: streamRowEntryTag } = useTvNativeTag();
  const { setRef: setSecondaryActionRowEntryRef, nativeTag: secondaryActionRowEntryTag } =
    useTvNativeTag();
  /** Rightmost secondary action: `nextFocusRightSelf` for D-pad wall (same row, last button). */
  const { setRef: setSecondaryRowLastWallRef, nativeTag: secondaryRowLastWallTag } =
    useTvNativeTag();
  const { setRef: setCastRowEntryRef, nativeTag: castRowEntryTag } = useTvNativeTag();
  const { setRef: setCrewRowEntryRef, nativeTag: crewRowEntryTag } = useTvNativeTag();
  const { setRef: setSimilarRowEntryRef, nativeTag: similarRowEntryTag } = useTvNativeTag();
  /** Trailer row (single “Watch trailer” under streaming) — first/only focus in that row. */
  const { setRef: setTrailerRowEntryRef, nativeTag: trailerRowEntryTag } = useTvNativeTag();
  /** Left self-trap on the first control in the secondary action row. */
  const { setRef: setFirstSecondaryLocalRef, nativeTag: firstSecondaryLocalTag } = useTvNativeTag();
  /** Right self-trap on the last control in the secondary action row. */
  const { setRef: setLastSecondaryLocalRef, nativeTag: lastSecondaryLocalTag } = useTvNativeTag();
  const tvLadderAndroid = tvDpadFocus && Platform.OS === 'android';
  /** TV: always use landscape / wide layout even if the window reports portrait. */
  const isLandscape = breakpointLandscape || isTV;
  const mediaDetailsSidebarLeftTag =
    isTV && Platform.OS === 'android'
      ? (sidebarSlotNativeTags['index'] ??
        sidebarSlotNativeTags['discover'] ??
        sidebarSlotNativeTags['watchlist'] ??
        sidebarSlotNativeTags['library'] ??
        null)
      : null;

  const isTmdbId = /^\d+$/.test(id ?? '');

  useEffect(() => {
    if (!trailerKey) setTrailerPressableLocalTag(null);
  }, [trailerKey]);

  useEffect(() => {
    return () => {
      setIsSearching(false);
    };
  }, [setIsSearching]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

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
    if (!session) return;

    async function checkWatchlistAndLibrary() {
      let mediaId: string | null = supabaseMediaId;

      if (!mediaId && isTmdbId && id) {
        const { data } = await supabase
          .from('media')
          .select('id')
          .eq('tmdb_id', Number(id))
          .maybeSingle();
        mediaId = data?.id ?? null;
      }

      if (!mediaId) {
        setInWatchlist(false);
        setIsInLibrary(false);
        return;
      }

      const userId = session.user.id;
      const [watchlistResult, libraryResult] = await Promise.all([
        supabase
          .from('watchlist')
          .select('id')
          .eq('user_id', userId)
          .eq('media_id', mediaId)
          .maybeSingle(),
        supabase
          .from('user_library')
          .select('id')
          .eq('user_id', userId)
          .eq('media_id', mediaId)
          .maybeSingle(),
      ]);

      setInWatchlist(!!watchlistResult.data);
      setIsInLibrary(!!libraryResult.data);
    }

    void checkWatchlistAndLibrary();
  }, [session, supabaseMediaId, isTmdbId, id]);

  async function findSupabaseMediaId(
    title: string,
    releaseYear: number | null,
    tmdbId?: number
  ) {
    if (tmdbId != null) {
      const { data } = await supabase
        .from('media')
        .select('id')
        .eq('tmdb_id', tmdbId)
        .maybeSingle();
      if (data) {
        setSupabaseMediaId(data.id);
        return;
      }
    }
    let query = supabase
      .from('media')
      .select('id')
      .ilike('title', title);

    if (releaseYear != null) {
      query = query.eq('release_year', releaseYear);
    }

    const { data } = await query.limit(1).maybeSingle();
    if (data) {
      setSupabaseMediaId(data.id);
    }
  }

  /**
   * Resolves `media.id` for watchlist operations. When `allowCreate` is true and the route
   * is TMDB-based with no row yet, silently upserts `media` (onConflict `tmdb_id`) first.
   */
  async function resolveMediaRowId(allowCreate: boolean): Promise<string | null> {
    if (supabaseMediaId) return supabaseMediaId;

    if (!isTmdbId && id && id !== 'undefined') {
      return String(id);
    }

    const tmdbNum = isTmdbId && id ? Number(id) : NaN;
    if (!Number.isFinite(tmdbNum)) return null;

    const { data: existing } = await supabase
      .from('media')
      .select('id')
      .eq('tmdb_id', tmdbNum)
      .maybeSingle();
    if (existing?.id) {
      setSupabaseMediaId(existing.id);
      return existing.id;
    }

    if (!allowCreate || !movie) return null;

    const { data: upserted, error } = await supabase
      .from('media')
      .upsert(
        {
          tmdb_id: tmdbNum,
          type: 'movie' as const,
          title: movie.title,
          poster_url: movie.poster_url ?? null,
          backdrop_url: movie.backdrop_url ?? null,
          release_year: movie.release_year ?? null,
        },
        { onConflict: 'tmdb_id' }
      )
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: row } = await supabase
          .from('media')
          .select('id')
          .eq('tmdb_id', tmdbNum)
          .maybeSingle();
        if (row?.id) {
          setSupabaseMediaId(row.id);
          return row.id;
        }
      }
      throw error;
    }
    const mid = upserted?.id ?? null;
    if (mid) setSupabaseMediaId(mid);
    return mid;
  }

  async function toggleWatchlist() {
    if (!session || watchlistLoading) return;

    const userId = session.user.id;
    const adding = !inWatchlist;
    setWatchlistLoading(true);

    const syncMembership = async (mediaRowId: string) => {
      const { data } = await supabase
        .from('watchlist')
        .select('id')
        .eq('user_id', userId)
        .eq('media_id', mediaRowId)
        .maybeSingle();
      setInWatchlist(!!data);
    };

    try {
      if (adding) {
        const mediaRowId = await resolveMediaRowId(true);
        if (!mediaRowId) {
          Alert.alert('Could not save', 'Missing movie data. Please try again.');
          return;
        }

        const { count } = await supabase
          .from('watchlist')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        const { error } = await supabase.from('watchlist').insert({
          user_id: userId,
          media_id: mediaRowId,
          watched: false,
          sort_order: count ?? 0,
          order_index: count ?? 0,
        });

        if (error?.code === '23505') {
          await syncMembership(mediaRowId);
          return;
        }
        if (error) throw error;
        await syncMembership(mediaRowId);
        return;
      }

      const mediaRowId = await resolveMediaRowId(false);
      if (!mediaRowId) {
        setInWatchlist(false);
        return;
      }

      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', userId)
        .eq('media_id', mediaRowId);
      if (error) throw error;
      await syncMembership(mediaRowId);
    } catch (err) {
      console.error('Watchlist error:', err);
      try {
        const mid = await resolveMediaRowId(false);
        if (mid) {
          const { data } = await supabase
            .from('watchlist')
            .select('id')
            .eq('user_id', userId)
            .eq('media_id', mid)
            .maybeSingle();
          setInWatchlist(!!data);
        }
      } catch {
        setInWatchlist(false);
      }
      Alert.alert(
        adding ? 'Could not save' : 'Could not remove',
        adding
          ? 'Failed to add to watchlist. Please try again.'
          : 'Failed to remove from watchlist. Please try again.'
      );
    } finally {
      setWatchlistLoading(false);
    }
  }

  const handleLibraryPress = useCallback(() => {
    if (!session) return;
    const wasInLibrary = isInLibrary;
    setIsInLibrary((v) => !v);

    const syncLibrary = async () => {
      const userId = session.user.id;
      try {
        const mediaRowId = await resolveMediaRowId(true);
        if (!mediaRowId) {
          setIsInLibrary(wasInLibrary);
          Alert.alert('Could not save', 'Missing movie data. Please try again.');
          return;
        }

        if (!wasInLibrary) {
          const { error } = await supabase.from('user_library').insert({
            user_id: userId,
            media_id: mediaRowId,
          });
          if (error) {
            if (error.code === '23505') {
              return;
            }
            throw error;
          }
        } else {
          const { error } = await supabase
            .from('user_library')
            .delete()
            .eq('user_id', userId)
            .eq('media_id', mediaRowId);
          if (error) throw error;
        }
      } catch (e) {
        if (__DEV__) {
          console.error('[MovieDetails] Library sync error:', e);
        }
        setIsInLibrary(wasInLibrary);
        Alert.alert('Could not update', 'Your library could not be updated. Please try again.');
      }
    };

    void syncLibrary();
  }, [session, isInLibrary]);

  async function fetchFromSupabase(mediaId: string) {
    const { data: mediaData, error: mediaError } = await supabase
      .from('media')
      .select(
        'id, title, synopsis, release_year, poster_url, backdrop_url, type, tmdb_id, imdb_id, rt_score, metascore, imdb_rating, ratings_fetched_at'
      )
      .eq('id', mediaId)
      .single();

    if (mediaError || !mediaData) {
      throw new Error(mediaError?.message ?? 'Movie not found');
    }

    const { data: castData, error: castError } = await supabase
      .from('media_cast_crew')
      .select(`
        role_type,
        character,
        job,
        people (id, name, headshot_url)
      `)
      .eq('media_id', mediaId);

    if (castError) {
      console.warn('[MovieDetails] Cast fetch error:', castError);
    }

    const { data: availData, error: availError } = await supabase
      .from('media_availability')
      .select(`
        id,
        access_type,
        price,
        direct_url,
        platforms (id, name, logo_url)
      `)
      .eq('media_id', mediaId);

    if (availError) {
      console.warn('[MovieDetails] Availability fetch error:', availError);
    }

    const cast: Person[] = (castData ?? []).map((c: Record<string, unknown>) => {
      const p = (c.people ?? c.person) as Record<string, unknown> | null;
      return {
        id: (p?.id as string) ?? '',
        name: (p?.name as string) ?? 'Unknown',
        headshot_url: (p?.headshot_url as string | null) ?? null,
        role_type: (c.role_type as string) ?? 'actor',
        character: (c.character as string | null) ?? null,
        job: (c.job as string | null) ?? null,
      };
    });

    const availability: PlatformAvailability[] = (availData ?? []).map(
      (a: Record<string, unknown>) => {
        const plat = (a.platforms ?? a.platform) as Record<string, unknown> | null;
        const platformName = plat && typeof plat.name === 'string'
          ? plat.name
          : 'Unknown';
        return {
          id: (a.id as string) ?? '',
          provider_id: 0,
          platform_name: platformName,
          access_type: (a.access_type as string) ?? 'subscription',
          price: (a.price as number | null) ?? null,
          direct_url: (a.direct_url as string | null) ?? null,
          logo_url: (plat?.logo_url as string | null) ?? null,
        };
      }
    );

    return {
      ...mediaData,
      vote_average: null,
      runtime: null,
      us_certification: null,
      cast,
      availability,
      watch_link: null,
    };
  }

  async function enrichFromTMDB(mediaId: string): Promise<string | null> {
    const baseUrl =
      Platform.OS === 'web'
        ? typeof window !== 'undefined'
          ? window.location.origin
          : ''
        : getMetroDevServerOrigin();

    try {
      const res = await fetch(`${baseUrl}/api/movie?id=${mediaId}`);
      if (!res.ok) {
        console.warn('[MovieDetails] Enrich API failed:', res.status);
        return null;
      }
      const data = await res.json();
      return data.trailerKey ?? null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!id) {
      setError('No movie ID');
      setLoading(false);
      setTitle(null);
      return;
    }

    setTitle(null);

    async function fetchMovie() {
      setTmdbMovieId(null);
      try {
        if (isTmdbId) {
          const tmdbId = Number(id);
          const { movie: tmdbMovie, trailerKey: key, watchProvidersResults: providers } =
            await fetchMovieFromTMDB(tmdbId);
          setMovie(tmdbMovie);
          setTitle(tmdbMovie.title);
          setWatchProvidersResults(providers);
          setTmdbMovieId(tmdbId);
          if (key) setTrailerKey(key);
          await findSupabaseMediaId(
            tmdbMovie.title,
            tmdbMovie.release_year,
            tmdbId
          );
        } else {
          setWatchProvidersResults(null);
          setSupabaseMediaId(id);
          const initial = await fetchFromSupabase(id);
          setMovie(initial);
          setTitle(initial.title);
          if (initial.tmdb_id != null) setTmdbMovieId(initial.tmdb_id);

          const key = await enrichFromTMDB(id);
          if (key) setTrailerKey(key);

          if (initial.cast.length === 0) {
            const enriched = await fetchFromSupabase(id);
            setMovie(enriched);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
        setTitle(null);
      } finally {
        setLoading(false);
      }
    }

    fetchMovie();
  }, [id, setTitle]);

  useEffect(() => {
    if (tmdbMovieId == null) {
      setRecommendations([]);
      return;
    }

    const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
    if (!apiKey) {
      setRecommendations([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `${TMDB_BASE}/movie/${tmdbMovieId}/recommendations?language=en-US&page=1`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        if (!res.ok) {
          if (!cancelled) setRecommendations([]);
          return;
        }
        const data = (await res.json()) as { results?: TMDBRecommendation[] };
        const list = (data.results ?? []).slice(0, 12);
        if (!cancelled) setRecommendations(list);
      } catch {
        if (!cancelled) setRecommendations([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tmdbMovieId]);

  useEffect(() => {
    if (!id || id === 'undefined' || String(id).trim() === '') {
      setStreamingProviders([]);
      return;
    }

    const ac = new AbortController();
    void loadDirectStreamingLinks(ac.signal);
    return () => ac.abort();
  }, [id, loadDirectStreamingLinks]);

  useEffect(() => {
    if (!watchProvidersResults) return;
    if (prevCountryRef.current === selectedCountry) return;
    prevCountryRef.current = selectedCountry;
    setIsUpdatingProviders(true);
    const t = setTimeout(() => setIsUpdatingProviders(false), 400);
    return () => clearTimeout(t);
  }, [selectedCountry, watchProvidersResults]);

  useEffect(() => {
    if (!movie) return;
    let cancelled = false;

    const imdb = normalizeImdbId(movie.imdb_id);
    if (!imdb) {
      setOmdbRatingsDisplay(null);
      setOmdbRatingsLoading(false);
      return;
    }

    async function run() {
      setOmdbRatingsLoading(true);
      try {
        if (supabaseMediaId) {
          const { data: row } = await supabase
            .from('media')
            .select('rt_score, metascore, imdb_rating, ratings_fetched_at')
            .eq('id', supabaseMediaId)
            .maybeSingle();

          if (cancelled) return;

          if (
            row?.rt_score != null &&
            String(row.rt_score).trim() !== '' &&
            typeof row.ratings_fetched_at === 'string' &&
            row.ratings_fetched_at !== ''
          ) {
            const fetchedAt = new Date(row.ratings_fetched_at).getTime();
            if (
              !Number.isNaN(fetchedAt) &&
              Date.now() - fetchedAt < RATINGS_TTL_MS
            ) {
              setOmdbRatingsDisplay({
                rt_score: row.rt_score ?? null,
                metascore: row.metascore ?? null,
                imdb_rating: row.imdb_rating ?? null,
              });
              setOmdbRatingsLoading(false);
              return;
            }
          }
        }

        const scores = await getOmdbScores(imdb);
        if (cancelled) return;

        setOmdbRatingsDisplay({
          rt_score: scores.rottenTomatoes,
          metascore: scores.metascore,
          imdb_rating: scores.imdbRating,
        });

        const now = new Date().toISOString();
        const patch = {
          imdb_id: imdb,
          rt_score: scores.rottenTomatoes,
          metascore: scores.metascore,
          imdb_rating: scores.imdbRating,
          ratings_fetched_at: now,
        };

        if (supabaseMediaId) {
          const { error } = await supabase
            .from('media')
            .update(patch)
            .eq('id', supabaseMediaId);
          if (error && __DEV__) {
            console.warn('[MovieDetails] ratings media update:', error.message);
          }
        } else if (isTmdbId && id) {
          const tmdbNum = Number(id);
          if (Number.isFinite(tmdbNum)) {
            const { error } = await supabase.from('media').upsert(
              {
                tmdb_id: tmdbNum,
                type: 'movie' as const,
                title: movie.title,
                poster_url: movie.poster_url ?? null,
                backdrop_url: movie.backdrop_url ?? null,
                release_year: movie.release_year ?? null,
                ...patch,
              },
              { onConflict: 'tmdb_id' }
            );
            if (error && __DEV__) {
              console.warn('[MovieDetails] ratings media upsert:', error.message);
            } else if (!error) {
              const { data: inserted } = await supabase
                .from('media')
                .select('id')
                .eq('tmdb_id', tmdbNum)
                .maybeSingle();
              if (inserted?.id) setSupabaseMediaId(inserted.id);
            }
          }
        }
      } catch {
        if (!cancelled) setOmdbRatingsDisplay(null);
      } finally {
        if (!cancelled) setOmdbRatingsLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    movie?.imdb_id,
    movie?.title,
    movie?.poster_url,
    movie?.backdrop_url,
    movie?.release_year,
    supabaseMediaId,
    isTmdbId,
    id,
  ]);

  if (loading) {
    return (
      <View style={styles.center} {...tvNf}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (error || !movie) {
    return (
      <View style={styles.center} {...tvNf}>
        <Text style={styles.errorText} {...tvNf}>
          {error ?? 'Movie not found'}
        </Text>
        <Pressable
          {...(isTV && Platform.OS === 'android' ? tvPreferredFocusProps() : tvFocusable())}
          focusable={tvDpadFocus ? true : undefined}
          onFocus={() => setErrorBackFocused(true)}
          onBlur={() => setErrorBackFocused(false)}
          style={[
            styles.backButton,
            errorBackFocused && styles.backButtonGoTvFocused,
          ]}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText} {...tvNf}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  const displayAvailability = watchProvidersResults
    ? buildAvailabilityFromProviders(watchProvidersResults[selectedCountry])
    : (movie?.availability ?? []);

  const displayWatchLink = watchProvidersResults
    ? watchProvidersResults[selectedCountry]?.link ?? null
    : movie?.watch_link ?? null;

  const fromWatchedParam = Array.isArray(fromWatched)
    ? fromWatched[0]
    : fromWatched;
  const shouldShowRecommendations =
    fromWatchedParam === 'true' || displayAvailability.length === 0;

  const validStreamOptionsForTv = (streamingProviders ?? []).filter(
    (opt) => typeof opt.link === 'string' && opt.link.trim() !== '',
  );
  type DetailsTvPrimary =
    | 'stream0'
    | 'watchlist'
    | 'similar'
    | 'trailer'
    | 'cast0'
    | 'crew0'
    | 'back'
    | 'none';

  const detailsTvPrimary: DetailsTvPrimary = (() => {
    if (!isTV) {
      if (validStreamOptionsForTv.length > 0) return 'stream0';
      if (trailerKey) return 'trailer';
      if (session) return 'watchlist';
      if (shouldShowRecommendations && recommendations.length > 0) return 'similar';
      if (fromWatchedParam === 'true') return 'back';
      if (
        shouldShowRecommendations &&
        recommendations.length === 0 &&
        fromWatchedParam !== 'true'
      ) {
        return 'back';
      }
      return 'back';
    }
    if (validStreamOptionsForTv.length > 0) return 'stream0';
    if (trailerKey) return 'trailer';
    if (session) return 'watchlist';
    if (shouldShowRecommendations && recommendations.length > 0) return 'similar';
    const actorCount = movie.cast.filter((p) => p.role_type === 'actor').length;
    if (actorCount > 0) return 'cast0';
    if (movie.cast.filter((p) => p.role_type !== 'actor').length > 0) return 'crew0';
    return 'none';
  })();

  function sortByEnabled(providers: PlatformAvailability[]): PlatformAvailability[] {
    return [...providers].sort((a, b) => {
      const scoreA = enabledServiceIds.has(a.provider_id) ? 0 : 1;
      const scoreB = enabledServiceIds.has(b.provider_id) ? 0 : 1;
      return scoreA - scoreB;
    });
  }

  function renderProviderGroup(providers: PlatformAvailability[], label: string) {
    if (providers.length === 0) return null;
    const sorted = sortByEnabled(providers);
    return (
      <View style={styles.providerGroup}>
        <Text style={styles.providerGroupLabel}>{label}</Text>
        <View style={styles.providerIconRow}>
          {sorted.map((avail) => {
            const isMember = enabledServiceIds.has(avail.provider_id);
            return (
              <Pressable
                key={avail.id}
                style={({ pressed }) => [
                  styles.providerIcon,
                  pressed && styles.providerIconPressed,
                ]}
                onPress={() => {
                  if (avail.direct_url) void handleStreamingPress(avail.direct_url);
                }}
              >
                <View style={isMember ? styles.providerLogoMember : undefined}>
                  {avail.logo_url ? (
                    <Image
                      source={{ uri: avail.logo_url }}
                      style={styles.providerLogo}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.providerLogoPlaceholder}>
                      <Text style={styles.providerLogoInitial}>
                        {avail.platform_name.charAt(0)}
                      </Text>
                    </View>
                  )}
                </View>
                {isMember ? (
                  <View style={styles.memberBadge}>
                    <Text style={styles.memberBadgeText}>Member</Text>
                  </View>
                ) : null}
                <Text style={styles.providerName} numberOfLines={1}>
                  {avail.platform_name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  const showSearchOverlay =
    isSearching && (searchResult || searchError || searchLoading);

  const handleSearchResultPress = () => {
    setIsSearching(false);
    setSearchResult(null);
    setSearchError(null);
  };

  function renderDetailsContent() {
    if (movie == null) {
      return (
        <View style={styles.center} {...tvNf}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      );
    }

    const validStreamOptionsNav = (streamingProviders ?? []).filter(
      (opt) => typeof opt.link === 'string' && opt.link.trim() !== '',
    );
    const hasSimilarActionBtn = shouldShowRecommendations && recommendations.length > 0;
    const hasStreams = validStreamOptionsNav.length > 0;
    const hasTrailer = !!trailerKey;
    const hasSecondaryActions = !!session || hasSimilarActionBtn;
    const downFromStreamLadder = tvLadderAndroid
      ? (hasTrailer
          ? trailerRowEntryTag
          : hasSecondaryActions
            ? secondaryActionRowEntryTag
            : castRowEntryTag)
      : null;
    const downFromTrailerRow = tvLadderAndroid
      ? (hasSecondaryActions
          ? secondaryActionRowEntryTag
          : castRowEntryTag)
      : null;
    const downFromSecondaryLadder = tvLadderAndroid
      ? (castRowEntryTag ?? crewRowEntryTag)
      : null;
    const upAboveSecondary = tvLadderAndroid
      ? (hasTrailer ? trailerRowEntryTag : streamRowEntryTag)
      : null;
    const upOnCastLadder = tvLadderAndroid
      ? (secondaryActionRowEntryTag ?? trailerRowEntryTag ?? streamRowEntryTag)
      : null;
    const downOnCastLadder = tvLadderAndroid
      ? (crewRowEntryTag ?? similarRowEntryTag)
      : null;
    const upOnCrewLadder = tvLadderAndroid
      ? (castRowEntryTag ??
        secondaryActionRowEntryTag ??
        trailerRowEntryTag ??
        streamRowEntryTag)
      : null;
    const downOnCrewLadder = tvLadderAndroid ? similarRowEntryTag : null;
    const upOnSimilarLadder = tvLadderAndroid
      ? (crewRowEntryTag ??
        castRowEntryTag ??
        secondaryActionRowEntryTag ??
        trailerRowEntryTag ??
        streamRowEntryTag)
      : null;
    const buildLadder = (
      up: number | null,
      down: number | null,
    ): Record<string, unknown> | undefined => {
      if (!tvLadderAndroid) return undefined;
      const o = tvAndroidNavProps({
        ...(up != null ? { nextFocusUp: up } : {}),
        ...(down != null ? { nextFocusDown: down } : {}),
      });
      return Object.keys(o).length > 0 ? o : undefined;
    };
    const castLadderNav = buildLadder(upOnCastLadder, downOnCastLadder);
    const crewLadderNav = buildLadder(upOnCrewLadder, downOnCrewLadder);
    const similarLadderNav = buildLadder(upOnSimilarLadder, null);
    const secondaryActionRowNav = buildLadder(
      upAboveSecondary,
      downFromSecondaryLadder,
    );
    const trailerRowNav = buildLadder(
      hasStreams ? streamRowEntryTag : null,
      downFromTrailerRow,
    );
    const lastWallIsSimilar = hasSimilarActionBtn;
    const lastWallIsLibrary = !!session && !hasSimilarActionBtn;

    return (
      <>
        <View {...tvNf}>
          <Text
            style={[styles.title, isLandscape && styles.titleDesktop]}
            {...tvNf}
          >
            {movie.title}
          </Text>
          {(omdbRatingsLoading ||
            (omdbRatingsDisplay &&
              (omdbRatingsDisplay.rt_score || omdbRatingsDisplay.metascore))) ? (
            <View
              style={[
                styles.titleRatingsRow,
                isLandscape && styles.titleRatingsRowDesktop,
              ]}
            >
              {omdbRatingsLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#9ca3af"
                  style={styles.omdbRatingsSpinner}
                />
              ) : null}
              {omdbRatingsDisplay?.rt_score &&
              omdbRatingsDisplay.rt_score.trim() !== '' ? (
                <View
                  style={styles.titleRatingChip}
                  accessibilityLabel={`Rotten Tomatoes ${omdbRatingsDisplay.rt_score}`}
                >
                  <Text style={styles.rtTomatoEmoji} {...tvNf}>
                    🍅
                  </Text>
                  <Text style={styles.titleRatingText} {...tvNf}>
                    {omdbRatingsDisplay.rt_score}
                  </Text>
                </View>
              ) : null}
              {omdbRatingsDisplay?.metascore &&
              parseMetascoreNumber(omdbRatingsDisplay.metascore) != null ? (
                <View
                  style={styles.titleRatingChip}
                  accessibilityLabel={`Metacritic ${omdbRatingsDisplay.metascore}`}
                >
                  <View
                    style={[
                      styles.metascoreSquare,
                      {
                        backgroundColor: metascoreSquareColor(
                          parseMetascoreNumber(omdbRatingsDisplay.metascore)!
                        ),
                      },
                    ]}
                  />
                  <Text style={styles.titleRatingText} {...tvNf}>
                    {omdbRatingsDisplay.metascore}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {(movie.release_year != null ||
            movie.us_certification ||
            (movie.runtime != null && movie.runtime > 0)) ? (
            <View style={[styles.metaRow, isLandscape && styles.metaRowDesktop]}>
              {movie.release_year != null ? (
                <Text
                  style={[styles.year, isLandscape && styles.yearDesktop]}
                  {...tvNf}
                >
                  {movie.release_year}
                </Text>
              ) : null}
              {movie.us_certification ? (
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingBadgeText} {...tvNf}>
                    {movie.us_certification}
                  </Text>
                </View>
              ) : null}
              {movie.runtime != null && movie.runtime > 0 ? (
                <Text
                  style={[styles.runtimeMeta, isLandscape && styles.runtimeMetaDesktop]}
                  {...tvNf}
                >
                  {formatRuntimeMinutes(movie.runtime)}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {movie.synopsis ? (
          <View
            style={[styles.overviewCompact, isLandscape && styles.overviewCompactDesktop]}
            {...tvNf}
          >
            <Text
              style={[styles.overviewText, isLandscape && styles.overviewTextDesktop]}
              {...tvNf}
            >
              {movie.synopsis}
            </Text>
          </View>
        ) : null}

        <View
          {...tvNf}
          style={[
            styles.whereToWatchStreamSection,
            isLandscape && styles.whereToWatchStreamSectionDesktop,
          ]}
        >
          <Text
            style={[
              styles.whereToWatchHeader,
              isLandscape && styles.whereToWatchHeaderDesktop,
            ]}
            {...tvNf}
          >
            Where to Watch
          </Text>
          {validStreamOptionsNav.length === 0 ? (
            <Text style={styles.streamingTvEmptyNote} {...tvNf}>
              No streaming options found in your region.
            </Text>
          ) : (
            validStreamOptionsNav.map((opt, idx) => (
              <StreamingButton
                key={`${opt.serviceId}-${idx}`}
                provider={opt}
                onStreamPress={handleStreamingPress}
                isLandscape={isLandscape}
                isPreferredEntry={detailsTvPrimary === 'stream0' && idx === 0}
                tvTextNf={tvNf}
                focusableExplicit={tvDpadFocus}
                setEntryRef={idx === 0 ? setStreamRowEntryRef : undefined}
                tvNextFocusDown={downFromStreamLadder}
                tvLadderNav={tvLadderAndroid}
                tvClampRightEdge={idx === validStreamOptionsNav.length - 1}
              />
            ))
          )}
        </View>

        {trailerKey ? (
          <View
            style={styles.trailerButtonRow}
            {...tvNf}
          >
            <Pressable
              ref={
                ((node) => {
                  setTrailerRowEntryRef(node);
                  if (Platform.OS === 'android') {
                    setTrailerPressableLocalTag(node ? findNodeHandle(node) : null);
                  } else {
                    setTrailerPressableLocalTag(null);
                  }
                }) as never
              }
              {...(tvLadderAndroid ? (trailerRowNav as object) : {})}
              {...(tvLadderAndroid
                ? (tvAndroidNavProps({
                    nextFocusLeft: mediaDetailsSidebarLeftTag ?? trailerRowEntryTag ?? trailerPressableLocalTag,
                    nextFocusRightSelf: trailerRowEntryTag ?? trailerPressableLocalTag,
                  }) as object)
                : {})}
              {...(detailsTvPrimary === 'trailer' ? tvPreferredFocusProps() : tvFocusable())}
              focusable={tvDpadFocus ? true : undefined}
              onFocus={() => setTrailerActionBtnFocused(true)}
              onBlur={() => setTrailerActionBtnFocused(false)}
              onPress={() => setTrailerModalVisible(true)}
              android_ripple={null}
              style={({ pressed }) => [
                styles.actionButton,
                isLandscape && styles.actionButtonDesktop,
                styles.trailerButtonRowInner,
                trailerActionBtnFocused && styles.actionButtonTvFocused,
                pressed && styles.actionButtonPressed,
              ]}
            >
              <Ionicons name="play-circle" size={18} color="#ffffff" />
              <Text style={styles.actionButtonText} numberOfLines={1} {...tvNf}>
                Watch Trailer
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.actionRow} {...tvNf}>
          {session ? (
            <Pressable
              ref={
                ((node) => {
                  setFirstSecondaryLocalRef(node);
                  if (session) setSecondaryActionRowEntryRef(node);
                }) as never
              }
              {...(secondaryActionRowNav as object)}
              {...(tvLadderAndroid
                ? (tvAndroidNavProps({
                    nextFocusLeft: mediaDetailsSidebarLeftTag ?? firstSecondaryLocalTag,
                  }) as object)
                : {})}
              {...(detailsTvPrimary === 'watchlist' ? tvPreferredFocusProps() : tvFocusable())}
              focusable={tvDpadFocus ? true : undefined}
              onFocus={() => setWatchlistBtnFocused(true)}
              onBlur={() => setWatchlistBtnFocused(false)}
              style={({ pressed }) => [
                styles.actionButton,
                isLandscape && styles.actionButtonDesktop,
                inWatchlist && styles.actionButtonRemove,
                watchlistLoading && styles.actionButtonDisabled,
                watchlistBtnFocused && styles.actionButtonTvFocused,
                pressed && styles.actionButtonPressed,
              ]}
              onPress={toggleWatchlist}
              disabled={watchlistLoading}
              accessibilityRole="button"
              accessibilityLabel={
                inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'
              }
              accessibilityState={{ selected: inWatchlist, busy: watchlistLoading }}
            >
              {watchlistLoading ? (
                <ActivityIndicator
                  size="small"
                  color={inWatchlist ? '#22c55e' : '#ffffff'}
                  style={styles.watchlistSpinner}
                />
              ) : (
                <Ionicons
                  name={inWatchlist ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={inWatchlist ? '#22c55e' : '#ffffff'}
                />
              )}
              <Text
                style={[
                  styles.actionButtonText,
                  inWatchlist && styles.actionButtonTextRemove,
                ]}
                numberOfLines={1}
                {...tvNf}
              >
                Watchlist
              </Text>
            </Pressable>
          ) : null}
          {session ? (
            <Pressable
              ref={
                (lastWallIsLibrary
                  ? (node) => {
                      setLastSecondaryLocalRef(node);
                      setSecondaryRowLastWallRef(node);
                    }
                  : undefined) as never
              }
              {...(secondaryActionRowNav as object)}
              {...(tvLadderAndroid && lastWallIsLibrary
                ? (tvAndroidNavProps({
                    nextFocusRightSelf: secondaryRowLastWallTag ?? lastSecondaryLocalTag,
                  }) as object)
                : {})}
              {...(tvFocusable())}
              focusable={tvDpadFocus ? true : undefined}
              onFocus={() => setLibraryBtnFocused(true)}
              onBlur={() => setLibraryBtnFocused(false)}
              style={({ pressed }) => [
                styles.actionButton,
                isLandscape && styles.actionButtonDesktop,
                isInLibrary && {
                  backgroundColor: 'transparent',
                  borderWidth: 2,
                  borderColor: ELECTRIC_CYAN,
                },
                libraryBtnFocused && styles.actionButtonTvFocused,
                pressed && styles.actionButtonPressed,
              ]}
              onPress={handleLibraryPress}
              accessibilityRole="button"
              accessibilityLabel={isInLibrary ? 'In your library' : 'Add to Library'}
            >
              <Ionicons
                name={isInLibrary ? 'checkmark-circle' : 'add-circle-outline'}
                size={20}
                color={isInLibrary ? ELECTRIC_CYAN : '#ffffff'}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  isInLibrary && { color: ELECTRIC_CYAN },
                ]}
                numberOfLines={1}
                {...tvNf}
              >
                {isInLibrary ? 'In Library' : 'Add to Library'}
              </Text>
            </Pressable>
          ) : null}
          {shouldShowRecommendations && recommendations.length > 0 ? (
            <Pressable
              ref={
                ((node) => {
                  if (!session && hasSimilarActionBtn) {
                    setFirstSecondaryLocalRef(node);
                    setSecondaryActionRowEntryRef(node);
                  }
                  if (lastWallIsSimilar) {
                    setLastSecondaryLocalRef(node);
                    setSecondaryRowLastWallRef(node);
                  }
                }) as never
              }
              {...(secondaryActionRowNav as object)}
              {...(tvLadderAndroid
                ? (tvAndroidNavProps({
                    ...(!session && hasSimilarActionBtn
                      ? { nextFocusLeft: mediaDetailsSidebarLeftTag ?? firstSecondaryLocalTag }
                      : {}),
                    ...(lastWallIsSimilar
                      ? { nextFocusRightSelf: secondaryRowLastWallTag ?? lastSecondaryLocalTag }
                      : {}),
                  }) as object)
                : {})}
              {...(detailsTvPrimary === 'similar' ? tvPreferredFocusProps() : tvFocusable())}
              focusable={tvDpadFocus ? true : undefined}
              onFocus={() => setSimilarBtnFocused(true)}
              onBlur={() => setSimilarBtnFocused(false)}
              style={({ pressed }) => [
                styles.viewSimilarButton,
                isLandscape && styles.viewSimilarButtonDesktop,
                similarBtnFocused && styles.viewSimilarButtonTvFocused,
                pressed && styles.viewSimilarButtonPressed,
              ]}
              onPress={scrollToRecommendations}
            >
              <Text style={styles.viewSimilarButtonText} numberOfLines={1} {...tvNf}>
                Discover More Like This
              </Text>
              <Ionicons name="chevron-down" size={20} color="#ffffff" />
            </Pressable>
          ) : fromWatchedParam === 'true' ? (
            <View style={styles.watchedBadgeStatic} {...tvNf}>
              <Text style={styles.watchedBadgeStaticText} {...tvNf}>
                ✓ Watched
              </Text>
            </View>
          ) : shouldShowRecommendations &&
            recommendations.length === 0 &&
            fromWatchedParam !== 'true' ? (
            <View style={styles.watchedBadgeStatic} {...tvNf}>
              <Text style={styles.watchedBadgeStaticText} {...tvNf}>
                ✓ Movie Info
              </Text>
            </View>
          ) : null}
        </View>

        {movie.cast.filter((p) => p.role_type === 'actor').length > 0 ? (
          <View
            style={[styles.section, isLandscape && styles.sectionDesktop]}
            {...tvNf}
          >
            <Text
              style={[styles.sectionTitle, isLandscape && styles.sectionTitleDesktop]}
              {...tvNf}
            >
              Cast
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.castScroll}
              {...tvNf}
            >
              {(() => {
                const castActors = movie.cast.filter((p) => p.role_type === 'actor');
                return castActors.map((person, idx) => (
                  <DetailsCastCard
                    key={`${person.id}-${idx}`}
                    person={person}
                    isLandscape={isLandscape}
                    tvNf={tvNf}
                    dpad={tvDpadFocus}
                    isPreferredEntry={detailsTvPrimary === 'cast0' && idx === 0}
                    setEntryRef={idx === 0 ? setCastRowEntryRef : undefined}
                    ladderNav={castLadderNav}
                    tvClampRightEdge={idx === castActors.length - 1}
                    tvLadder={tvLadderAndroid}
                    onPress={() =>
                      router.push({
                        pathname: '/person/[id]',
                        params: { id: person.id },
                      })
                    }
                  />
                ));
              })()}
            </ScrollView>
          </View>
        ) : null}

        {movie.filming_locations && movie.filming_locations.length > 0 ? (
          <View
            style={[styles.section, isLandscape && styles.sectionDesktop]}
            {...tvNf}
          >
            <Text
              style={[styles.sectionTitle, isLandscape && styles.sectionTitleDesktop]}
              {...tvNf}
            >
              Filming Locations
            </Text>
            <Text style={styles.filmingLocationsText} {...tvNf}>
              {movie.filming_locations.join(', ')}
            </Text>
          </View>
        ) : null}

        {movie.cast.filter((p) => p.role_type !== 'actor').length > 0 ? (
          <View
            style={[styles.section, isLandscape && styles.sectionDesktop]}
            {...tvNf}
          >
            <Text
              style={[styles.sectionTitle, isLandscape && styles.sectionTitleDesktop]}
              {...tvNf}
            >
              Crew
            </Text>
            <View style={styles.crewGrid} {...tvNf}>
              {(() => {
                const crewPeople = movie.cast.filter((p) => p.role_type !== 'actor');
                return crewPeople.map((person, idx) => (
                  <DetailsCrewItem
                    key={`${person.id}-crew-${idx}`}
                    person={person}
                    isLandscape={isLandscape}
                    tvNf={tvNf}
                    dpad={tvDpadFocus}
                    isPreferredEntry={detailsTvPrimary === 'crew0' && idx === 0}
                    setEntryRef={idx === 0 ? setCrewRowEntryRef : undefined}
                    ladderNav={crewLadderNav}
                    tvClampRightEdge={idx === crewPeople.length - 1}
                    tvLadder={tvLadderAndroid}
                    onPress={() =>
                      router.push({
                        pathname: '/person/[id]',
                        params: { id: person.id },
                      })
                    }
                  />
                ));
              })()}
            </View>
          </View>
        ) : null}

        {shouldShowRecommendations && recommendations.length > 0 ? (
          <View
            style={[
              styles.section,
              isLandscape && styles.sectionDesktop,
              displayAvailability.length === 0 && styles.recommendationsSectionTightTop,
              displayAvailability.length === 0 &&
                isLandscape &&
                styles.recommendationsSectionTightTopDesktop,
            ]}
            {...tvNf}
          >
            <Text
              style={[styles.sectionTitle, isLandscape && styles.sectionTitleDesktop]}
              {...tvNf}
            >
              You May Also Like
            </Text>
            <FlatList
              horizontal
              data={recommendations}
              keyExtractor={(rec) => String(rec.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recommendationsScrollContent}
              {...tvNf}
              renderItem={({ item: rec, index }) => (
                <DetailsRecommendationCard
                  rec={rec}
                  tvNf={tvNf}
                  dpad={tvDpadFocus}
                  setEntryRef={index === 0 ? setSimilarRowEntryRef : undefined}
                  ladderNav={similarLadderNav}
                  tvClampRightEdge={index === recommendations.length - 1}
                  tvLadder={tvLadderAndroid}
                  onPress={() =>
                    router.push({
                      pathname: '/movie/[id]',
                      params: { id: String(rec.id) },
                    })
                  }
                />
              )}
            />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: !isTV,
          headerLeft: undefined,
          headerBackVisible: true,
          title: movie?.title ?? '',
          headerStyle: { backgroundColor: '#000000' },
          headerTintColor: '#ffffff',
          headerTransparent: isLandscape,
        }}
      />
      <SafeAreaView
        style={styles.safeAreaWrapper}
        edges={isLandscape ? ['top', 'bottom', 'left', 'right'] : ['bottom', 'left', 'right']}
        {...tvNf}
      >
        {!isTV ? (
          <Pressable
            {...(detailsTvPrimary === 'back' ? tvPreferredFocusProps() : tvFocusable())}
            focusable={tvDpadFocus ? true : undefined}
            onFocus={() => setFloatingBackFocused(true)}
            onBlur={() => setFloatingBackFocused(false)}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.push('/');
              }
            }}
            style={({ pressed }) => [
              {
                position: 'absolute',
                top: 50,
                left: 20,
                zIndex: 999,
                elevation: 10,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              },
              floatingBackFocused && styles.backButtonFloatingTvFocused,
            ]}
            accessibilityLabel="Back"
            accessibilityRole="button"
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color="white"
              style={{ marginLeft: -2 }}
            />
          </Pressable>
        ) : null}
        <View style={styles.wrapper} {...tvNf}>
          <SafeAreaView style={styles.safeHeader} {...tvNf}>
            <MovieDetailsHeader hideBackButton />
          </SafeAreaView>

          {isLandscape ? (
          /* Landscape: Poster fixed left, only details scroll */
          <View style={[styles.mainContainer, styles.mainContainerLandscape]} {...tvNf}>
            <View style={styles.posterSection} {...tvNf}>
              {movie.poster_url ? (
                <Image
                  source={{ uri: movie.poster_url }}
                  style={styles.posterImageLandscape}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.posterHeroPlaceholder} {...tvNf}>
                  <Text style={styles.posterPlaceholderText} {...tvNf}>
                    ?
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.detailsSection} {...tvNf}>
              <ScrollView
                ref={scrollViewRef}
                style={styles.detailsScroll}
                contentContainerStyle={styles.detailsScrollContent}
                showsVerticalScrollIndicator={false}
                {...tvNf}
              >
                {renderDetailsContent()}
              </ScrollView>
            </View>
          </View>
        ) : (
          /* Portrait: ScrollView wraps poster + details */
          <ScrollView
            ref={scrollViewRef}
            style={styles.mainScroll}
            contentContainerStyle={styles.mainScrollContent}
            showsVerticalScrollIndicator={false}
            {...tvNf}
          >
            <View style={styles.posterColumn} {...tvNf}>
              {movie.poster_url ? (
                <Image
                  source={{ uri: movie.poster_url }}
                  style={styles.posterImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.posterHeroPlaceholder} {...tvNf}>
                  <Text style={styles.posterPlaceholderText} {...tvNf}>
                    ?
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.infoColumn} {...tvNf}>
              {renderDetailsContent()}
            </View>
          </ScrollView>
        )}
        </View>
      </SafeAreaView>

      {/* Trailer Modal */}
      <Modal
        visible={trailerModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setTrailerModalVisible(false)}
      >
        <View style={styles.trailerModalContainer} {...tvNf}>
          <Pressable
            {...(isTV && Platform.OS === 'android' ? tvPreferredFocusProps() : tvFocusable())}
            focusable={tvDpadFocus ? true : undefined}
            onFocus={() => setTrailerCloseFocused(true)}
            onBlur={() => setTrailerCloseFocused(false)}
            style={[
              styles.trailerModalClose,
              trailerCloseFocused && styles.trailerModalCloseTvFocused,
            ]}
            onPress={() => setTrailerModalVisible(false)}
          >
            <Ionicons name="close" size={32} color="#ffffff" />
          </Pressable>
          {trailerKey ? (
            <View style={styles.trailerModalPlayer}>
              <TrailerPlayer
                videoId={trailerKey}
                height={Math.floor(Dimensions.get('window').height * 0.6)}
              />
            </View>
          ) : null}
        </View>
      </Modal>

      {showSearchOverlay && (
        <SearchResultsOverlay
          searchLoading={searchLoading}
          searchError={searchError}
          searchResult={searchResult}
          onResultPress={handleSearchResultPress}
          onDismiss={() => {
            Keyboard.dismiss();
            setIsSearching(false);
            setSearchResult(null);
            setSearchError(null);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  mainScroll: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  mainScrollContent: {
    paddingBottom: 40,
  },
  mainContainer: {
    flex: 1,
    height: '100%',
  },
  mainContainerLandscape: {
    flexDirection: 'row',
  },
  posterSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    overflow: 'hidden',
  },
  posterImageLandscape: {
    width: '100%',
    height: '100%',
  },
  detailsSection: {
    flex: 1,
  },
  detailsScroll: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  detailsScrollContent: {
    padding: 28,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonGoTvFocused: {
    borderWidth: 3,
    borderColor: ELECTRIC_CYAN,
  },
  backButtonFloatingTvFocused: {
    borderWidth: 3,
    borderColor: ELECTRIC_CYAN,
    overflow: 'visible',
  },
  safeAreaWrapper: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  wrapper: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safeHeader: {
    backgroundColor: '#0f0f0f',
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  posterColumn: {
    width: '100%',
    height: 450,
    padding: 10,
    overflow: 'hidden',
  },
  posterImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  posterHeroPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoColumn: {
    padding: 20,
  },
  watchTrailerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
    width: '100%',
    alignSelf: 'stretch',
  },
  watchTrailerButtonDesktop: {
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 16,
  },
  watchTrailerButtonPressed: {
    opacity: 0.8,
  },
  watchTrailerText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  watchTrailerTextDesktop: {
    fontSize: 18,
  },
  whereToWatchHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 20,
    marginBottom: 10,
  },
  whereToWatchHeaderDesktop: {
    fontSize: 22,
  },
  whereToWatchStreamSection: {
    width: '100%',
    marginTop: 8,
    marginBottom: 4,
  },
  whereToWatchStreamSectionDesktop: {
    marginTop: 12,
    marginBottom: 8,
  },
  /** Single “Watch trailer” control below streaming, above secondary actions. */
  trailerButtonRow: {
    width: '100%',
    marginTop: 4,
    marginBottom: 4,
  },
  trailerButtonRowInner: {
    minWidth: 200,
  },
  streamingTvButton: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#333333',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamingTvButtonDesktop: {
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  streamingTvButtonFocused: {
    borderColor: ELECTRIC_CYAN,
    borderWidth: 3,
    transform: [{ scale: 1.05 }],
    overflow: 'visible',
    zIndex: 2,
    elevation: 6,
  },
  streamingTvButtonPressing: {
    opacity: 0.88,
  },
  streamingTvButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  streamingTvButtonTextDesktop: {
    fontSize: 17,
  },
  streamingTvEmptyNote: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  streamingSection: {
    marginTop: 24,
  },
  streamingSectionDesktop: {
    marginTop: 28,
  },
  noStreamingText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  streamingIconsRowCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  streamingIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1f1f1f',
  },
  streamingIconImage: {
    width: '100%',
    height: '100%',
  },
  streamingIconPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamingIconInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  streamingIconsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  streamingIconCompact: {
    width: 40,
    height: 40,
    borderRadius: 10,
    overflow: 'hidden',
  },
  streamingIconCompactPressed: {
    opacity: 0.8,
  },
  streamingLogoCompact: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1f1f1f',
  },
  streamingLogoPlaceholderCompact: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamingLogoInitialCompact: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 20,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    height: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    borderRadius: 10,
  },
  actionButtonDesktop: {
    height: 48,
    borderRadius: 12,
  },
  actionButtonPressed: {
    opacity: 0.8,
  },
  actionButtonRemove: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  actionButtonTvFocused: {
    borderWidth: 3,
    borderColor: ELECTRIC_CYAN,
    transform: [{ scale: 1.02 }],
    zIndex: 2,
    overflow: 'visible',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextRemove: {
    color: '#ef4444',
  },
  viewSimilarButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  viewSimilarButtonDesktop: {
    minHeight: 52,
  },
  viewSimilarButtonPressed: {
    opacity: 0.9,
  },
  viewSimilarButtonTvFocused: {
    borderWidth: 3,
    borderColor: ELECTRIC_CYAN,
    transform: [{ scale: 1.02 }],
    zIndex: 2,
    overflow: 'visible',
  },
  viewSimilarButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  watchedBadgeStatic: {
    flex: 1,
    minHeight: 45,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
  },
  watchedBadgeStaticText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonGroup: {
    marginTop: 20,
    marginBottom: 20,
    width: '100%',
  },
  watchlistButtonCompact: {
    width: '100%',
  },
  overviewCompact: {
    marginTop: 12,
  },
  overviewCompactDesktop: {
    marginTop: 16,
  },
  overviewText: {
    fontSize: 13,
    color: '#d1d5db',
    lineHeight: 20,
  },
  overviewTextDesktop: {
    fontSize: 15,
    lineHeight: 24,
  },
  trailerModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  trailerModalClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  trailerModalCloseTvFocused: {
    borderRadius: 8,
    borderWidth: 3,
    borderColor: ELECTRIC_CYAN,
  },
  trailerModalPlayer: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 100 : 80,
  },
  posterPlaceholderText: {
    fontSize: 24,
    color: '#6b7280',
  },
  watchlistSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  watchlistButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    width: '100%',
    alignSelf: 'stretch',
  },
  watchlistButtonDesktop: {
    paddingVertical: 16,
    borderRadius: 14,
  },
  watchlistButtonRemove: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  watchlistButtonDisabled: {
    opacity: 0.7,
  },
  watchlistButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  watchlistSpinner: {
    marginRight: 0,
  },
  watchlistButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  watchlistButtonTextRemove: {
    color: '#ef4444',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  titleDesktop: {
    fontSize: 34,
  },
  titleRatingsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 2,
  },
  titleRatingsRowDesktop: {
    marginTop: 10,
    gap: 12,
  },
  omdbRatingsSpinner: {
    marginRight: 4,
  },
  titleRatingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rtTomatoEmoji: {
    fontSize: 13,
    lineHeight: 16,
  },
  titleRatingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d1d5db',
  },
  metascoreSquare: {
    width: 14,
    height: 14,
    borderRadius: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  metaRowDesktop: {
    marginTop: 6,
    gap: 10,
  },
  year: {
    fontSize: 16,
    color: '#9ca3af',
  },
  yearDesktop: {
    fontSize: 18,
  },
  ratingBadge: {
    borderWidth: 1,
    borderColor: '#6b7280',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ratingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d1d5db',
    letterSpacing: 0.3,
  },
  runtimeMeta: {
    fontSize: 16,
    color: '#9ca3af',
  },
  runtimeMetaDesktop: {
    fontSize: 18,
  },
  section: {
    marginTop: 16,
    marginBottom: 24,
  },
  sectionDesktop: {
    marginTop: 20,
    marginBottom: 28,
  },
  recommendationsSectionTightTop: {
    marginTop: 4,
  },
  recommendationsSectionTightTopDesktop: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  sectionTitleDesktop: {
    fontSize: 20,
    marginBottom: 14,
  },
  synopsis: {
    fontSize: 15,
    color: '#d1d5db',
    lineHeight: 22,
  },
  castScroll: {
    paddingRight: 20,
  },
  recommendationsScrollContent: {
    paddingRight: 20,
  },
  recommendationCard: {
    width: 120,
    marginRight: 12,
  },
  recommendationCardPressed: {
    opacity: 0.85,
  },
  recommendationCardTvFocused: {
    borderWidth: 3,
    borderColor: ELECTRIC_CYAN,
    borderRadius: 10,
    padding: 2,
  },
  recommendationPoster: {
    width: 120,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  recommendationPosterPlaceholder: {
    width: 120,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationPosterInitial: {
    fontSize: 32,
    color: '#6b7280',
    fontWeight: '600',
  },
  recommendationTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e5e7eb',
    marginTop: 8,
  },
  castCard: {
    width: 90,
    alignItems: 'center',
    marginRight: 16,
  },
  castCardTvFocused: {
    borderWidth: 3,
    borderColor: ELECTRIC_CYAN,
    borderRadius: 12,
    padding: 3,
  },
  castCardDesktop: {
    width: 100,
    marginRight: 20,
  },
  castPhoto: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  castPhotoDesktop: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  castPhotoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  castPhotoPlaceholderDesktop: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  castInitial: {
    fontSize: 24,
    color: '#9ca3af',
    fontWeight: '600',
  },
  castName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 6,
  },
  castNameDesktop: {
    fontSize: 14,
    marginTop: 8,
  },
  castCharacter: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  castCharacterDesktop: {
    fontSize: 12,
    marginTop: 4,
  },
  crewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  crewItem: {
    width: '47%',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  crewItemTvFocused: {
    borderWidth: 3,
    borderColor: ELECTRIC_CYAN,
  },
  crewItemDesktop: {
    padding: 14,
    borderRadius: 12,
  },
  crewRole: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  crewRoleDesktop: {
    fontSize: 12,
    marginBottom: 6,
  },
  crewName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  crewNameDesktop: {
    fontSize: 15,
  },
  filmingLocationsText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 22,
  },
  streamSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  streamSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  updatingProviders: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  updatingProvidersText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  providerGroup: {
    marginBottom: 20,
  },
  providerGroupLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  providerIconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    overflow: 'visible',
  },
  providerIcon: {
    alignItems: 'center',
    width: 68,
  },
  providerIconPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.8,
  },
  providerLogo: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#1f1f1f',
  },
  providerLogoMember: {
    borderWidth: 2,
    borderColor: '#6366f1',
    borderRadius: 14,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  memberBadge: {
    backgroundColor: '#6366f1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  memberBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  providerLogoPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerLogoInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6b7280',
  },
  providerName: {
    fontSize: 11,
    color: '#d1d5db',
    marginTop: 6,
    textAlign: 'center',
  },
  moreInfoButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    marginBottom: 4,
  },
  moreInfoButtonPressed: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  moreInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  noStreaming: {
    fontSize: 15,
    color: '#9ca3af',
    marginBottom: 8,
  },
  justWatchAttribution: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d2d2d',
    alignItems: 'center',
  },
  justWatchText: {
    fontSize: 11,
    color: '#6b7280',
  },
});

/** Android TV: spread on static `Text` so copy is not in the focus graph. */
type AndroidTvNf = { focusable?: boolean; collapsable?: boolean };

function DetailsCastCard({
  person,
  isLandscape,
  tvNf,
  dpad,
  isPreferredEntry = false,
  setEntryRef,
  ladderNav,
  tvClampRightEdge = false,
  tvLadder = false,
  onPress,
}: {
  person: Person;
  isLandscape: boolean;
  tvNf: AndroidTvNf;
  dpad: boolean;
  isPreferredEntry?: boolean;
  setEntryRef?: TvRowEntryRefSetter;
  ladderNav?: Record<string, unknown>;
  tvClampRightEdge?: boolean;
  tvLadder?: boolean;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const { setRef: setLocalRef, nativeTag: localTag } = useTvNativeTag();
  const setMerged: TvRowEntryRefSetter = (node) => {
    setLocalRef(node);
    setEntryRef?.(node);
  };
  const rightWall =
    tvLadder && tvClampRightEdge && localTag != null
      ? tvAndroidNavProps({ nextFocusRightSelf: localTag })
      : undefined;
  return (
    <Pressable
      ref={setMerged as never}
      {...(isPreferredEntry ? tvPreferredFocusProps() : tvFocusable())}
      focusable={dpad ? true : undefined}
      {...(ladderNav ?? {})}
      {...(rightWall ?? {})}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.castCard,
        isLandscape && styles.castCardDesktop,
        isFocused && styles.castCardTvFocused,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {person.headshot_url ? (
        <Image
          source={{ uri: person.headshot_url }}
          style={[styles.castPhoto, isLandscape && styles.castPhotoDesktop]}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.castPhotoPlaceholder,
            isLandscape && styles.castPhotoPlaceholderDesktop,
          ]}
        >
          <Text style={styles.castInitial} {...tvNf}>
            {person.name.charAt(0)}
          </Text>
        </View>
      )}
      <Text
        style={[styles.castName, isLandscape && styles.castNameDesktop]}
        numberOfLines={1}
        {...tvNf}
      >
        {person.name}
      </Text>
      {person.character ? (
        <Text
          style={[styles.castCharacter, isLandscape && styles.castCharacterDesktop]}
          numberOfLines={1}
          {...tvNf}
        >
          {person.character}
        </Text>
      ) : null}
    </Pressable>
  );
}

function DetailsCrewItem({
  person,
  isLandscape,
  tvNf,
  dpad,
  isPreferredEntry = false,
  setEntryRef,
  ladderNav,
  tvClampRightEdge = false,
  tvLadder = false,
  onPress,
}: {
  person: Person;
  isLandscape: boolean;
  tvNf: AndroidTvNf;
  dpad: boolean;
  isPreferredEntry?: boolean;
  setEntryRef?: TvRowEntryRefSetter;
  ladderNav?: Record<string, unknown>;
  tvClampRightEdge?: boolean;
  tvLadder?: boolean;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const { setRef: setLocalRef, nativeTag: localTag } = useTvNativeTag();
  const setMerged: TvRowEntryRefSetter = (node) => {
    setLocalRef(node);
    setEntryRef?.(node);
  };
  const rightWall =
    tvLadder && tvClampRightEdge && localTag != null
      ? tvAndroidNavProps({ nextFocusRightSelf: localTag })
      : undefined;
  return (
    <Pressable
      ref={setMerged as never}
      {...(isPreferredEntry ? tvPreferredFocusProps() : tvFocusable())}
      focusable={dpad ? true : undefined}
      {...(ladderNav ?? {})}
      {...(rightWall ?? {})}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.crewItem,
        isLandscape && styles.crewItemDesktop,
        isFocused && styles.crewItemTvFocused,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.crewRole, isLandscape && styles.crewRoleDesktop]} {...tvNf}>
        {person.job ?? person.role_type}
      </Text>
      <Text style={[styles.crewName, isLandscape && styles.crewNameDesktop]} {...tvNf}>
        {person.name}
      </Text>
    </Pressable>
  );
}

function DetailsRecommendationCard({
  rec,
  tvNf,
  dpad,
  setEntryRef,
  ladderNav,
  tvClampRightEdge = false,
  tvLadder = false,
  onPress,
}: {
  rec: TMDBRecommendation;
  tvNf: AndroidTvNf;
  dpad: boolean;
  setEntryRef?: TvRowEntryRefSetter;
  ladderNav?: Record<string, unknown>;
  tvClampRightEdge?: boolean;
  tvLadder?: boolean;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const { setRef: setLocalRef, nativeTag: localTag } = useTvNativeTag();
  const setMerged: TvRowEntryRefSetter = (node) => {
    setLocalRef(node);
    setEntryRef?.(node);
  };
  const rightWall =
    tvLadder && tvClampRightEdge && localTag != null
      ? tvAndroidNavProps({ nextFocusRightSelf: localTag })
      : undefined;
  return (
    <Pressable
      ref={setMerged as never}
      {...tvFocusable()}
      focusable={dpad ? true : undefined}
      {...(ladderNav ?? {})}
      {...(rightWall ?? {})}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.recommendationCard,
        isFocused && styles.recommendationCardTvFocused,
        pressed && styles.recommendationCardPressed,
      ]}
    >
      {rec.poster_path ? (
        <Image
          source={{
            uri: `https://image.tmdb.org/t/p/w342${rec.poster_path}`,
          }}
          style={styles.recommendationPoster}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.recommendationPosterPlaceholder}>
          <Text style={styles.recommendationPosterInitial} {...tvNf}>
            {rec.title.charAt(0)}
          </Text>
        </View>
      )}
      <Text style={styles.recommendationTitle} numberOfLines={2} {...tvNf}>
        {rec.title}
      </Text>
    </Pressable>
  );
}

type StreamingButtonProps = {
  provider: StreamingOption;
  onStreamPress: (url: string) => void | Promise<void>;
  isLandscape: boolean;
  isPreferredEntry?: boolean;
  /** Pass parent `tvNf` so the label is not a focus target on TV. */
  tvTextNf?: AndroidTvNf;
  /** `shouldUseTvDpadFocus()` from parent; sets `focusable` explicitly. */
  focusableExplicit?: boolean;
  setEntryRef?: TvRowEntryRefSetter;
  /** First column of a lower row, for `nextFocusDown` from the whole actions strip. */
  tvNextFocusDown?: number | null;
  /** When true, apply `tvNextFocusDown` on Android. */
  tvLadderNav?: boolean;
  /** When true, trap D-pad Right on the last stream button. */
  tvClampRightEdge?: boolean;
};

function StreamingButton({
  provider,
  onStreamPress,
  isLandscape,
  isPreferredEntry = false,
  tvTextNf = {},
  focusableExplicit = false,
  setEntryRef,
  tvNextFocusDown = null,
  tvLadderNav = false,
  tvClampRightEdge = false,
}: StreamingButtonProps) {
  const [isFocused, setIsFocused] = useState(false);
  const { setRef: setLocalRef, nativeTag: localTag } = useTvNativeTag();
  const mergedRef: TvRowEntryRefSetter = (node) => {
    setLocalRef(node);
    setEntryRef?.(node);
  };
  const platformName =
    provider.serviceName.trim() !== '' ? provider.serviceName.trim() : 'service';
  const label = `Watch on ${platformName}`;
  const downNav =
    tvLadderNav && tvNextFocusDown != null
      ? tvAndroidNavProps({ nextFocusDown: tvNextFocusDown })
      : undefined;
  const rightWall =
    tvLadderNav && tvClampRightEdge && localTag != null
      ? tvAndroidNavProps({ nextFocusRightSelf: localTag })
      : undefined;

  return (
    <Pressable
      ref={mergedRef as never}
      {...(isPreferredEntry ? tvPreferredFocusProps() : tvFocusable())}
      focusable={focusableExplicit ? true : undefined}
      {...(downNav ?? {})}
      {...(rightWall ?? {})}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={() => void onStreamPress(provider.link)}
      style={({ pressed }) => [
        styles.streamingTvButton,
        isLandscape && styles.streamingTvButtonDesktop,
        isFocused && styles.streamingTvButtonFocused,
        pressed && styles.streamingTvButtonPressing,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.streamingTvButtonText,
          isLandscape && styles.streamingTvButtonTextDesktop,
        ]}
        numberOfLines={1}
        {...tvTextNf}
      >
        {label}
      </Text>
    </Pressable>
  );
}
