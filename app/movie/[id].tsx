import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
  Linking,
  Alert,
  Keyboard,
  Modal,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import {
  getDirectStreamingLinks,
  type StreamingOption,
} from '../../lib/streaming';
import { useSearch } from '../../lib/search-context';
import { useMovie } from '../../lib/movie-context';
import { TrailerPlayer } from '../../components/TrailerPlayer';
import { SearchResultsOverlay } from '../../components/SearchResultsOverlay';
import { MovieDetailsHeader } from '../../components/MovieDetailsHeader';
import { useBreakpoint } from '../../hooks/useBreakpoint';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

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

async function fetchMovieFromTMDB(tmdbId: number): Promise<{
  movie: MovieDetails;
  trailerKey: string | null;
}> {
  const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
  if (!apiKey) throw new Error('TMDB API key not configured');

  const url = `${TMDB_BASE}/movie/${tmdbId}?append_to_response=credits,videos,keywords,release_dates&language=en-US`;
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

  const availability: PlatformAvailability[] = [];

  const trailer = (data.videos?.results ?? []).find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer'
  );

  const usCertification = extractUsCertification(data.release_dates);

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
      watch_link: null,
      production_countries: data.production_countries ?? undefined,
      filming_locations: parseFilmingLocations(
        data.keywords?.keywords,
        data.production_countries
      ),
    },
    trailerKey: trailer?.key ?? null,
  };
}

export default function MovieDetailsScreen() {
  const { id, fromWatched } = useLocalSearchParams<{
    id: string;
    fromWatched?: string | string[];
  }>();
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    const state = navigation.getState();
    console.log('[MovieDetails] navigation.getState() on mount:', JSON.stringify(state, null, 2));
  }, [navigation]);
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [supabaseMediaId, setSupabaseMediaId] = useState<string | null>(null);
  const [streamingLinks, setStreamingLinks] = useState<StreamingOption[]>([]);
  const [trailerModalVisible, setTrailerModalVisible] = useState(false);
  const [tmdbMovieId, setTmdbMovieId] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<TMDBRecommendation[]>(
    []
  );
  const scrollViewRef = useRef<ScrollView>(null);

  const scrollToRecommendations = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, []);

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
  const { isLandscape, height: viewportHeight } = useBreakpoint();

  const isTmdbId = /^\d+$/.test(id ?? '');

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
    if (!session) return;

    async function checkIfInWatchlist() {
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
        return;
      }

      const { data } = await supabase
        .from('watchlist')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('media_id', mediaId)
        .maybeSingle();
      setInWatchlist(!!data);
    }

    checkIfInWatchlist();
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

  async function toggleWatchlist() {
    if (!session) {
      router.push('/login');
      return;
    }

    const nextInWatchlist = !inWatchlist;
    setInWatchlist(nextInWatchlist);
    setWatchlistLoading(true);

    const tmdbId = isTmdbId ? Number(id) : null;

    const resolveMediaId = async (): Promise<string | null> => {
      if (supabaseMediaId) return supabaseMediaId;
      if (tmdbId != null) {
        const { data } = await supabase
          .from('media')
          .select('id')
          .eq('tmdb_id', tmdbId)
          .maybeSingle();
        return data?.id ?? null;
      }
      return null;
    };

    const syncCheck = async (mediaId: string) => {
      const { data } = await supabase
        .from('watchlist')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('media_id', mediaId)
        .maybeSingle();
      setInWatchlist(!!data);
    };

    try {
      const mediaId = await resolveMediaId();

      if (nextInWatchlist) {
        if (!mediaId && movie && tmdbId != null) {
          const numericTmdbId = Number(id);
          const mediaPayload = {
            tmdb_id: numericTmdbId,
            type: 'movie' as const,
            title: movie.title,
            poster_url: movie.poster_url ?? null,
            backdrop_url: movie.backdrop_url ?? null,
            release_year: movie.release_year ?? null,
          };

          const { data: inserted, error } = await supabase
            .from('media')
            .insert(mediaPayload)
            .select('id')
            .single();

          if (error) {
            if (error.code === '23505') {
              const { data: existing } = await supabase
                .from('media')
                .select('id')
                .eq('tmdb_id', numericTmdbId)
                .maybeSingle();
              const resolvedId = existing?.id ?? null;
              if (resolvedId) {
                setSupabaseMediaId(resolvedId);
                const { count } = await supabase
                  .from('watchlist')
                  .select('*', { count: 'exact', head: true })
                  .eq('user_id', session.user.id);
                const { error: insertErr } = await supabase
                  .from('watchlist')
                  .insert({
                    user_id: session.user.id,
                    media_id: resolvedId,
                    watched: false,
                    sort_order: count ?? 0,
                    order_index: count ?? 0,
                  });
                if (insertErr) throw insertErr;
                await syncCheck(resolvedId);
              } else {
                throw error;
              }
            } else {
              throw error;
            }
          } else {
            const newMediaId = inserted?.id ?? null;
            if (newMediaId) {
              setSupabaseMediaId(newMediaId);
              const { count } = await supabase
                .from('watchlist')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', session.user.id);
              const { error: insertErr } = await supabase
                .from('watchlist')
                .insert({
                  user_id: session.user.id,
                  media_id: newMediaId,
                  watched: false,
                  sort_order: count ?? 0,
                  order_index: count ?? 0,
                });
              if (insertErr) throw insertErr;
              await syncCheck(newMediaId);
            } else {
              setInWatchlist(false);
            }
          }
        } else if (mediaId) {
          const { count } = await supabase
            .from('watchlist')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id);
          const { error } = await supabase
            .from('watchlist')
            .insert({
              user_id: session.user.id,
              media_id: mediaId,
              watched: false,
              sort_order: count ?? 0,
              order_index: count ?? 0,
            });
          if (error) throw error;
          await syncCheck(mediaId);
        } else {
          setInWatchlist(false);
        }
      } else {
        if (!mediaId) {
          setInWatchlist(false);
          return;
        }
        const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', session.user.id)
          .eq('media_id', mediaId);
        if (error) throw error;
        await syncCheck(mediaId);
      }
    } catch (err) {
      console.error('Watchlist error:', err);
      setInWatchlist(!nextInWatchlist);
      Alert.alert(
        nextInWatchlist ? 'Could not save' : 'Could not remove',
        nextInWatchlist
          ? 'Failed to add to watchlist. Please try again.'
          : 'Failed to remove from watchlist. Please try again.'
      );
    } finally {
      setWatchlistLoading(false);
    }
  }

  async function fetchFromSupabase(mediaId: string) {
    const { data: mediaData, error: mediaError } = await supabase
      .from('media')
      .select('id, title, synopsis, release_year, poster_url, backdrop_url, type, tmdb_id')
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
        : process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8081';

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
      setStreamingLinks([]);
      try {
        if (isTmdbId) {
          const tmdbId = Number(id);
          const { movie: tmdbMovie, trailerKey: key } =
            await fetchMovieFromTMDB(tmdbId);
          setMovie(tmdbMovie);
          setTitle(tmdbMovie.title);
          setTmdbMovieId(tmdbId);
          if (key) setTrailerKey(key);
          await findSupabaseMediaId(
            tmdbMovie.title,
            tmdbMovie.release_year,
            tmdbId
          );
          console.log(
            'Component is attempting to fetch streaming links for ID:',
            tmdbId
          );
          const links = await getDirectStreamingLinks(tmdbId, 'movie', 'us');
          setStreamingLinks(links);
        } else {
          setSupabaseMediaId(id);
          const initial = await fetchFromSupabase(id);
          setMovie(initial);
          setTitle(initial.title);
          if (initial.tmdb_id != null) {
            setTmdbMovieId(initial.tmdb_id);
            console.log(
              'Component is attempting to fetch streaming links for ID:',
              initial.tmdb_id
            );
            const links = await getDirectStreamingLinks(
              initial.tmdb_id,
              'movie',
              'us'
            );
            setStreamingLinks(links);
          } else {
            setStreamingLinks([]);
          }

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
        setStreamingLinks([]);
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (error || !movie) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Movie not found'}</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const fromWatchedParam = Array.isArray(fromWatched)
    ? fromWatched[0]
    : fromWatched;
  const streamingOrLegacyCount =
    streamingLinks.length + (movie?.availability?.length ?? 0);
  const shouldShowRecommendations =
    fromWatchedParam === 'true' || streamingOrLegacyCount === 0;

  const showSearchOverlay =
    isSearching && (searchResult || searchError || searchLoading);

  const handleSearchResultPress = () => {
    setIsSearching(false);
    setSearchResult(null);
    setSearchError(null);
  };

  const handleOpenLink = async (url: string, serviceName: string) => {
    if (!url) {
      Alert.alert(
        'Link Unavailable',
        `Sorry, we don't have a direct link for ${serviceName} right now.`
      );
      return;
    }

    try {
      // Directly attempt to open the URL, bypassing canOpenURL whitelist requirements
      await Linking.openURL(url);
    } catch (error) {
      console.error(`Failed to open link for ${serviceName}:`, error);
      // If it fails, it usually means the native app isn't installed and there is no web fallback
      Alert.alert(
        'App Not Found',
        `We couldn't open ${serviceName}. You may need to install the app or log in.`
      );
    }
  };

  function renderDetailsContent() {
    return (
      <>
        <View>
          <Text style={[styles.title, isLandscape && styles.titleDesktop]}>{movie.title}</Text>
          {(movie.release_year != null ||
            movie.us_certification ||
            (movie.runtime != null && movie.runtime > 0)) ? (
            <View style={[styles.metaRow, isLandscape && styles.metaRowDesktop]}>
              {movie.release_year != null ? (
                <Text style={[styles.year, isLandscape && styles.yearDesktop]}>
                  {movie.release_year}
                </Text>
              ) : null}
              {movie.us_certification ? (
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingBadgeText}>{movie.us_certification}</Text>
                </View>
              ) : null}
              {movie.runtime != null && movie.runtime > 0 ? (
                <Text style={[styles.runtimeMeta, isLandscape && styles.runtimeMetaDesktop]}>
                  {formatRuntimeMinutes(movie.runtime)}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {movie.synopsis ? (
          <View style={[styles.overviewCompact, isLandscape && styles.overviewCompactDesktop]}>
            <Text style={[styles.overviewText, isLandscape && styles.overviewTextDesktop]}>{movie.synopsis}</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          {shouldShowRecommendations && recommendations.length > 0 ? (
            <Pressable
              style={({ pressed }) => [
                styles.viewSimilarButton,
                isLandscape && styles.viewSimilarButtonDesktop,
                pressed && styles.viewSimilarButtonPressed,
              ]}
              onPress={scrollToRecommendations}
            >
              <Text style={styles.viewSimilarButtonText} numberOfLines={1}>
                Discover More Like This
              </Text>
              <Ionicons name="chevron-down" size={20} color="#ffffff" />
            </Pressable>
          ) : fromWatchedParam === 'true' ? (
            <View style={styles.watchedBadgeStatic}>
              <Text style={styles.watchedBadgeStaticText}>✓ Watched</Text>
            </View>
          ) : shouldShowRecommendations &&
            recommendations.length === 0 &&
            fromWatchedParam !== 'true' ? (
            <View style={styles.watchedBadgeStatic}>
              <Text style={styles.watchedBadgeStaticText}>✓ Movie Info</Text>
            </View>
          ) : (
            <>
              <Pressable
                style={[
                  styles.actionButton,
                  isLandscape && styles.actionButtonDesktop,
                  inWatchlist && styles.actionButtonRemove,
                  watchlistLoading && styles.actionButtonDisabled,
                ]}
                onPress={toggleWatchlist}
                disabled={watchlistLoading}
              >
                {watchlistLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={inWatchlist ? '#22c55e' : '#ffffff'}
                    style={styles.watchlistSpinner}
                  />
                ) : (
                  <Ionicons
                    name={inWatchlist ? 'checkmark-circle' : 'add-circle-outline'}
                    size={18}
                    color={
                      inWatchlist ? '#22c55e' : session ? '#ffffff' : '#a5b4fc'
                    }
                  />
                )}
                <Text
                  style={[
                    styles.actionButtonText,
                    inWatchlist && styles.actionButtonTextRemove,
                  ]}
                  numberOfLines={1}
                >
                  {session ? (inWatchlist ? 'On Watchlist' : 'Add to Watchlist') : 'Sign in to Add'}
                </Text>
              </Pressable>

              {trailerKey ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    isLandscape && styles.actionButtonDesktop,
                    pressed && styles.actionButtonPressed,
                  ]}
                  onPress={() => setTrailerModalVisible(true)}
                >
                  <Ionicons name="play-circle" size={18} color="#ffffff" />
                  <Text style={styles.actionButtonText} numberOfLines={1}>Watch Trailer</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>

        {tmdbMovieId != null ? (
          <Pressable
            style={({ pressed }) => [
              styles.watchNowButton,
              isLandscape && styles.watchNowButtonDesktop,
              pressed && styles.watchNowButtonPressed,
            ]}
            onPress={() => Linking.openURL(`https://www.themoviedb.org/movie/${tmdbMovieId}/watch`)}
          >
            <Text style={[styles.watchNowButtonText, isLandscape && styles.watchNowButtonTextDesktop]}>
              Watch Now
            </Text>
            <Ionicons name="open-outline" size={18} color="#ffffff" />
          </Pressable>
        ) : null}

        {streamingLinks.length > 0 ? (
          <View style={[styles.watchProvidersSection, isLandscape && styles.watchProvidersSectionDesktop]}>
            <Text style={[styles.whereToWatchHeader, isLandscape && styles.whereToWatchHeaderDesktop]}>
              Where to Watch
            </Text>
            <View style={styles.watchProviderCategory}>
              <Text style={[styles.watchProviderLabel, isLandscape && styles.watchProviderLabelDesktop]}>
                Stream, rent & buy
              </Text>
              <View style={styles.streamingPillsRow}>
                {streamingLinks.map((provider, idx) => (
                  <Pressable
                    key={`stream-opt-${idx}-${provider.serviceId}`}
                    style={({ pressed }) => [
                      styles.streamingPill,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => {
                      void handleOpenLink(provider.link, provider.serviceName);
                    }}
                  >
                    <Text style={styles.streamingPillText} numberOfLines={1}>
                      {provider.serviceName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {movie.cast.filter((p) => p.role_type === 'actor').length > 0 ? (
          <View style={[styles.section, isLandscape && styles.sectionDesktop]}>
            <Text style={[styles.sectionTitle, isLandscape && styles.sectionTitleDesktop]}>Cast</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.castScroll}
            >
              {movie.cast
                .filter((p) => p.role_type === 'actor')
                .map((person, idx) => (
                  <Pressable
                    key={`${person.id}-${idx}`}
                    onPress={() =>
                      router.push({
                        pathname: '/person/[id]',
                        params: { id: person.id },
                      })
                    }
                    style={({ pressed }) => [
                      styles.castCard,
                      isLandscape && styles.castCardDesktop,
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
                      <View style={[styles.castPhotoPlaceholder, isLandscape && styles.castPhotoPlaceholderDesktop]}>
                        <Text style={styles.castInitial}>{person.name.charAt(0)}</Text>
                      </View>
                    )}
                    <Text style={[styles.castName, isLandscape && styles.castNameDesktop]} numberOfLines={1}>
                      {person.name}
                    </Text>
                    {person.character ? (
                      <Text style={[styles.castCharacter, isLandscape && styles.castCharacterDesktop]} numberOfLines={1}>
                        {person.character}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
            </ScrollView>
          </View>
        ) : null}

        {movie.filming_locations && movie.filming_locations.length > 0 ? (
          <View style={[styles.section, isLandscape && styles.sectionDesktop]}>
            <Text style={[styles.sectionTitle, isLandscape && styles.sectionTitleDesktop]}>Filming Locations</Text>
            <Text style={styles.filmingLocationsText}>
              {movie.filming_locations.join(', ')}
            </Text>
          </View>
        ) : null}

        {movie.cast.filter((p) => p.role_type !== 'actor').length > 0 ? (
          <View style={[styles.section, isLandscape && styles.sectionDesktop]}>
            <Text style={[styles.sectionTitle, isLandscape && styles.sectionTitleDesktop]}>Crew</Text>
            <View style={styles.crewGrid}>
              {movie.cast
                .filter((p) => p.role_type !== 'actor')
                .map((person, idx) => (
                  <Pressable
                    key={`${person.id}-crew-${idx}`}
                    onPress={() =>
                      router.push({
                        pathname: '/person/[id]',
                        params: { id: person.id },
                      })
                    }
                    style={({ pressed }) => [
                      styles.crewItem,
                      isLandscape && styles.crewItemDesktop,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={[styles.crewRole, isLandscape && styles.crewRoleDesktop]}>
                      {person.job ?? person.role_type}
                    </Text>
                    <Text style={[styles.crewName, isLandscape && styles.crewNameDesktop]}>{person.name}</Text>
                  </Pressable>
                ))}
            </View>
          </View>
        ) : null}

        {shouldShowRecommendations && recommendations.length > 0 ? (
          <View
            style={[
              styles.section,
              isLandscape && styles.sectionDesktop,
              streamingOrLegacyCount === 0 && styles.recommendationsSectionTightTop,
              streamingOrLegacyCount === 0 &&
                isLandscape &&
                styles.recommendationsSectionTightTopDesktop,
            ]}
          >
            <Text style={[styles.sectionTitle, isLandscape && styles.sectionTitleDesktop]}>
              You May Also Like
            </Text>
            <FlatList
              horizontal
              data={recommendations}
              keyExtractor={(rec) => String(rec.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recommendationsScrollContent}
              renderItem={({ item: rec }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.recommendationCard,
                    pressed && styles.recommendationCardPressed,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/movie/[id]',
                      params: { id: String(rec.id) },
                    })
                  }
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
                      <Text style={styles.recommendationPosterInitial}>
                        {rec.title.charAt(0)}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.recommendationTitle} numberOfLines={2}>
                    {rec.title}
                  </Text>
                </Pressable>
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
          headerShown: true,
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
      >
        <Pressable
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
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color="white"
            style={{ marginLeft: -2 }}
          />
        </Pressable>
        <View style={styles.wrapper}>
          <SafeAreaView style={styles.safeHeader}>
            <MovieDetailsHeader hideBackButton />
          </SafeAreaView>

          {isLandscape ? (
          /* Landscape: Poster fixed left, only details scroll */
          <View style={[styles.mainContainer, styles.mainContainerLandscape]}>
            <View style={styles.posterSection}>
              {movie.poster_url ? (
                <Image
                  source={{ uri: movie.poster_url }}
                  style={styles.posterImageLandscape}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.posterHeroPlaceholder}>
                  <Text style={styles.posterPlaceholderText}>?</Text>
                </View>
              )}
            </View>
            <View style={styles.detailsSection}>
              <ScrollView
                ref={scrollViewRef}
                style={styles.detailsScroll}
                contentContainerStyle={styles.detailsScrollContent}
                showsVerticalScrollIndicator={false}
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
          >
            <View style={styles.posterColumn}>
              {movie.poster_url ? (
                <Image
                  source={{ uri: movie.poster_url }}
                  style={styles.posterImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.posterHeroPlaceholder}>
                  <Text style={styles.posterPlaceholderText}>?</Text>
                </View>
              )}
            </View>
            <View style={styles.infoColumn}>
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
        <View style={styles.trailerModalContainer}>
          <Pressable
            style={styles.trailerModalClose}
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
  watchProvidersSection: {
    width: '100%',
  },
  watchProvidersSectionDesktop: {},
  streamingEmptyMessage: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    paddingVertical: 12,
    marginTop: 4,
  },
  watchProviderCategory: {
    marginBottom: 14,
  },
  watchProviderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  watchProviderLabelDesktop: {
    fontSize: 14,
  },
  streamingPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  streamingPill: {
    backgroundColor: '#2d2d2d',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamingPillText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  watchNowButton: {
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignSelf: 'stretch',
    marginTop: 0,
    marginBottom: 20,
  },
  watchNowLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
  },
  watchNowLinkDesktop: {
    marginTop: 20,
    paddingVertical: 14,
  },
  watchNowLinkPressed: {
    opacity: 0.8,
  },
  watchNowLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#22c55e',
  },
  watchNowLinkTextDesktop: {
    fontSize: 16,
  },
  watchNowButtonDesktop: {
    paddingVertical: 16,
    borderRadius: 14,
  },
  watchNowButtonPressed: {
    opacity: 0.8,
  },
  watchNowButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  watchNowButtonTextDesktop: {
    fontSize: 18,
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
});
