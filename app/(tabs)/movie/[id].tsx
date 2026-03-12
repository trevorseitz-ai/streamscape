import { useEffect, useState, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { getSavedProviderIds } from '../../../lib/provider-preferences';
import { useCountry } from '../../../lib/country-context';
import { useSearch } from '../../../lib/search-context';
import { CountrySelector } from '../../../components/CountrySelector';
import { TrailerPlayer } from '../../../components/TrailerPlayer';
import { MovieSearchInput } from '../../../components/MovieSearchInput';
import { SearchResultsOverlay } from '../../../components/SearchResultsOverlay';

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
  poster_url: string | null;
  backdrop_url: string | null;
  type: string;
  cast: Person[];
  availability: PlatformAvailability[];
  watch_link: string | null;
}

interface TMDBMovieResponse {
  id: number;
  title: string;
  overview: string | null;
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
      rent?: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>;
      buy?: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>;
    }>;
  };
  videos?: {
    results?: Array<{ key: string; site: string; type: string }>;
  };
}

const BACKDROP_HEIGHT = 220;
const POSTER_WIDTH = 100;
const POSTER_OVERLAP = 24;

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

type WatchProviderCountry = {
  link?: string;
  flatrate?: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>;
  rent?: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>;
  buy?: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>;
};

function buildAvailabilityFromProviders(
  countryData: WatchProviderCountry | undefined
): PlatformAvailability[] {
  const watchLink = countryData?.link ?? null;
  const availability: PlatformAvailability[] = [];
  const addProviders = (
    list: Array<{ provider_id: number; provider_name: string; logo_path: string | null }> | undefined,
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
  addProviders(countryData?.rent, 'rent');
  addProviders(countryData?.buy, 'buy');
  return availability;
}

async function fetchMovieFromTMDB(tmdbId: number): Promise<{
  movie: MovieDetails;
  trailerKey: string | null;
  watchProvidersResults: Record<string, WatchProviderCountry> | null;
}> {
  const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
  if (!apiKey) throw new Error('TMDB API key not configured');

  const url = `${TMDB_BASE}/movie/${tmdbId}?append_to_response=credits,watch/providers,videos&language=en-US`;
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

  const watchProvidersResults = data['watch/providers']?.results ?? null;
  const us = watchProvidersResults?.US;
  const availability = buildAvailabilityFromProviders(us);

  const trailer = (data.videos?.results ?? []).find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer'
  );

  return {
    movie: {
      id: String(data.id),
      title: data.title,
      synopsis: data.overview ?? null,
      release_year: releaseYear,
      poster_url: toFullImageUrl(data.poster_path),
      backdrop_url: toFullImageUrl(data.backdrop_path),
      type: 'movie',
      cast: [...actors, ...crew],
      availability,
      watch_link: us?.link ?? null,
    },
    trailerKey: trailer?.key ?? null,
    watchProvidersResults,
  };
}

export default function MovieDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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

  const {
    isSearching,
    searchResult,
    searchError,
    searchLoading,
    setIsSearching,
    setSearchResult,
    setSearchError,
  } = useSearch();

  const isTmdbId = /^\d+$/.test(id ?? '');

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
      .select('id, title, synopsis, release_year, poster_url, backdrop_url, type')
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

    return { ...mediaData, cast, availability, watch_link: null };
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
      return;
    }

    async function fetchMovie() {
      try {
        if (isTmdbId) {
          const tmdbId = Number(id);
          const { movie: tmdbMovie, trailerKey: key, watchProvidersResults: providers } =
            await fetchMovieFromTMDB(tmdbId);
          setMovie(tmdbMovie);
          setWatchProvidersResults(providers);
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

          const key = await enrichFromTMDB(id);
          if (key) setTrailerKey(key);

          if (initial.cast.length === 0) {
            const enriched = await fetchFromSupabase(id);
            setMovie(enriched);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }

    fetchMovie();
  }, [id]);

  useEffect(() => {
    if (!watchProvidersResults) return;
    if (prevCountryRef.current === selectedCountry) return;
    prevCountryRef.current = selectedCountry;
    setIsUpdatingProviders(true);
    const t = setTimeout(() => setIsUpdatingProviders(false), 400);
    return () => clearTimeout(t);
  }, [selectedCountry, watchProvidersResults]);

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

  const displayAvailability = watchProvidersResults
    ? buildAvailabilityFromProviders(watchProvidersResults[selectedCountry])
    : (movie?.availability ?? []);

  const displayWatchLink = watchProvidersResults
    ? watchProvidersResults[selectedCountry]?.link ?? null
    : movie?.watch_link ?? null;

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
                  if (avail.direct_url) Linking.openURL(avail.direct_url);
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

  const handleSearchResultPress = (m: { id: string }) => {
    setIsSearching(false);
    setSearchResult(null);
    setSearchError(null);
    router.push(`/movie/${m.id}`);
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      {/* Header: Back button + Search + Country selector */}
      <View style={styles.movieHeader}>
        <Pressable
          style={styles.backButtonFloating}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <View style={styles.movieHeaderRight}>
          {!isSearching && (
            <Pressable
              style={styles.movieSearchIcon}
              onPress={() => setIsSearching(true)}
              hitSlop={8}
            >
              <Ionicons name="search-outline" size={22} color="#ffffff" />
            </Pressable>
          )}
          <CountrySelector />
        </View>
      </View>

      {/* Trailer */}
      {trailerKey ? (
        <View style={styles.trailerSection}>
          <TrailerPlayer videoId={trailerKey} />
        </View>
      ) : null}

      {/* Backdrop */}
      <View style={styles.backdropContainer}>
        {movie.backdrop_url ? (
          <Image
            source={{ uri: movie.backdrop_url }}
            style={styles.backdrop}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.backdropPlaceholder} />
        )}
        <View style={styles.backdropOverlay} />
      </View>

      {/* Poster overlapping backdrop */}
      <View style={styles.posterRow}>
        <View style={styles.posterWrapper}>
          {movie.poster_url ? (
            <Image
              source={{ uri: movie.poster_url }}
              style={styles.poster}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Text style={styles.posterPlaceholderText}>?</Text>
            </View>
          )}
        </View>
      </View>

      {/* Title & Meta */}
      <View style={styles.metaSection}>
        {isSearching ? (
          <MovieSearchInput />
        ) : (
          <>
            <Text style={styles.title}>{movie.title}</Text>
            {movie.release_year != null ? (
              <Text style={styles.year}>{movie.release_year}</Text>
            ) : null}
          </>
        )}
      </View>

      {/* Watchlist Button */}
      <View style={styles.watchlistSection}>
        <Pressable
          style={[
            styles.watchlistButton,
            inWatchlist && styles.watchlistButtonRemove,
            watchlistLoading && styles.watchlistButtonDisabled,
          ]}
          onPress={toggleWatchlist}
          disabled={watchlistLoading}
        >
          <View style={styles.watchlistButtonContent}>
            {watchlistLoading ? (
              <ActivityIndicator
                size="small"
                color={inWatchlist ? '#22c55e' : '#ffffff'}
                style={styles.watchlistSpinner}
              />
            ) : (
              <Ionicons
                name={inWatchlist ? 'checkmark-circle' : 'add-circle-outline'}
                size={22}
                color={
                  inWatchlist
                    ? '#22c55e'
                    : session
                      ? '#ffffff'
                      : '#a5b4fc'
                }
              />
            )}
            <Text
              style={[
                styles.watchlistButtonText,
                inWatchlist && styles.watchlistButtonTextRemove,
              ]}
            >
              {session
                ? inWatchlist
                  ? 'On Watchlist'
                  : 'Add to Watchlist'
                : 'Sign in to Add to Watchlist'}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Synopsis */}
      {movie.synopsis ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Synopsis</Text>
          <Text style={styles.synopsis}>{movie.synopsis}</Text>
        </View>
      ) : null}

      {/* Cast (Actors) */}
      {movie.cast.filter((p) => p.role_type === 'actor').length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cast</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.castScroll}
          >
            {movie.cast
              .filter((p) => p.role_type === 'actor')
              .map((person, idx) => (
                <View key={`${person.id}-${idx}`} style={styles.castCard}>
                  {person.headshot_url ? (
                    <Image
                      source={{ uri: person.headshot_url }}
                      style={styles.castPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.castPhotoPlaceholder}>
                      <Text style={styles.castInitial}>
                        {person.name.charAt(0)}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.castName} numberOfLines={1}>
                    {person.name}
                  </Text>
                  {person.character ? (
                    <Text style={styles.castCharacter} numberOfLines={1}>
                      {person.character}
                    </Text>
                  ) : null}
                </View>
              ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Crew */}
      {movie.cast.filter((p) => p.role_type !== 'actor').length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Crew</Text>
          <View style={styles.crewGrid}>
            {movie.cast
              .filter((p) => p.role_type !== 'actor')
              .map((person, idx) => (
                <View key={`${person.id}-crew-${idx}`} style={styles.crewItem}>
                  <Text style={styles.crewRole}>
                    {person.job ?? person.role_type}
                  </Text>
                  <Text style={styles.crewName}>{person.name}</Text>
                </View>
              ))}
          </View>
        </View>
      ) : null}

      {/* Where to Watch */}
      <View style={styles.streamSection}>
        <Text style={styles.streamSectionTitle}>Where to Watch</Text>
        {isUpdatingProviders ? (
          <View style={styles.updatingProviders}>
            <ActivityIndicator size="small" color="#6366f1" />
            <Text style={styles.updatingProvidersText}>Updating providers...</Text>
          </View>
        ) : displayAvailability.length === 0 ? (
          <Text style={styles.noStreaming}>
            {watchProvidersResults
              ? 'No streaming data available for this region.'
              : 'No streaming options found'}
          </Text>
        ) : (
          <>
            {renderProviderGroup(
              displayAvailability.filter((a) => a.access_type === 'subscription'),
              'Stream'
            )}
            {renderProviderGroup(
              displayAvailability.filter((a) => a.access_type === 'rent'),
              'Rent'
            )}
            {renderProviderGroup(
              displayAvailability.filter((a) => a.access_type === 'buy'),
              'Buy'
            )}
          </>
        )}

        {displayWatchLink ? (
          <Pressable
            style={({ pressed }) => [
              styles.moreInfoButton,
              pressed && styles.moreInfoButtonPressed,
            ]}
            onPress={() => Linking.openURL(displayWatchLink!)}
          >
            <Text style={styles.moreInfoText}>More Info on TMDB →</Text>
          </Pressable>
        ) : null}

        <View style={styles.justWatchAttribution}>
          <Text style={styles.justWatchText}>
            Streaming data powered by JustWatch
          </Text>
        </View>
      </View>

      <View style={styles.bottomSpacer} />
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  content: {
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
  wrapper: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  movieHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  movieHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 4,
  },
  movieSearchIcon: {
    padding: 4,
  },
  backButtonFloating: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  trailerSection: {
    paddingTop: 90,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backdropContainer: {
    height: BACKDROP_HEIGHT,
    width: '100%',
    position: 'relative',
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  backdropPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  posterRow: {
    marginTop: -POSTER_WIDTH / 2 - POSTER_OVERLAP,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  posterWrapper: {
    width: POSTER_WIDTH,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1f1f1f',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  poster: {
    width: POSTER_WIDTH,
    aspectRatio: 2 / 3,
  },
  posterPlaceholder: {
    width: POSTER_WIDTH,
    aspectRatio: 2 / 3,
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterPlaceholderText: {
    fontSize: 24,
    color: '#6b7280',
  },
  metaSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
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
  year: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  synopsis: {
    fontSize: 15,
    color: '#d1d5db',
    lineHeight: 22,
  },
  castScroll: {
    paddingRight: 20,
  },
  castCard: {
    width: 90,
    alignItems: 'center',
    marginRight: 16,
  },
  castPhoto: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  castPhotoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
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
  castCharacter: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
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
  crewRole: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  crewName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  streamSection: {
    marginHorizontal: 20,
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
  bottomSpacer: {
    height: 40,
  },
});
