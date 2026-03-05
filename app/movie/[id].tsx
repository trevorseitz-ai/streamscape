import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

interface Person {
  id: string;
  name: string;
  headshot_url: string | null;
  role_type: string;
  character: string | null;
}

interface PlatformAvailability {
  id: string;
  platform_name: string;
  access_type: string;
  price: number | null;
  direct_url: string | null;
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
}

const BACKDROP_HEIGHT = 220;
const POSTER_WIDTH = 100;
const POSTER_OVERLAP = 24;

function formatAccessType(access: PlatformAvailability): string {
  const type = access.access_type.charAt(0).toUpperCase() + access.access_type.slice(1);
  if (access.access_type === 'subscription') {
    return `${type} on ${access.platform_name}`;
  }
  if (access.price != null) {
    return `${type} on ${access.platform_name} for $${access.price}`;
  }
  return `${type} on ${access.platform_name}`;
}

export default function MovieDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && id) checkWatchlist(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session && id) checkWatchlist(session.user.id);
      }
    );
    return () => subscription.unsubscribe();
  }, [id]);

  async function checkWatchlist(userId: string) {
    const { data } = await supabase
      .from('watchlist')
      .select('id')
      .eq('user_id', userId)
      .eq('media_id', id)
      .maybeSingle();
    setInWatchlist(!!data);
  }

  async function toggleWatchlist() {
    if (!session) {
      router.push('/login');
      return;
    }
    setWatchlistLoading(true);
    try {
      if (inWatchlist) {
        await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', session.user.id)
          .eq('media_id', id);
        setInWatchlist(false);
      } else {
        await supabase.from('watchlist').insert({
          user_id: session.user.id,
          media_id: id,
          watched: false,
        });
        setInWatchlist(true);
      }
    } catch (err) {
      console.error('Watchlist error:', err);
    } finally {
      setWatchlistLoading(false);
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
        const { data: mediaData, error: mediaError } = await supabase
          .from('media')
          .select('id, title, synopsis, release_year, poster_url, backdrop_url, type')
          .eq('id', id)
          .single();

        if (mediaError || !mediaData) {
          setError(mediaError?.message ?? 'Movie not found');
          return;
        }

        const { data: castData, error: castError } = await supabase
          .from('media_cast_crew')
          .select(`
            role_type,
            character,
            people (id, name, headshot_url)
          `)
          .eq('media_id', id);

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
            platforms (id, name)
          `)
          .eq('media_id', id);

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
              platform_name: platformName,
              access_type: (a.access_type as string) ?? 'subscription',
              price: (a.price as number | null) ?? null,
              direct_url: (a.direct_url as string | null) ?? null,
            };
          }
        );

        setMovie({
          ...mediaData,
          cast,
          availability,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }

    fetchMovie();
  }, [id]);

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Back button */}
      <Pressable
        style={styles.backButtonFloating}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>

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
        <Text style={styles.title}>{movie.title}</Text>
        {movie.release_year && (
          <Text style={styles.year}>{movie.release_year}</Text>
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
          {watchlistLoading ? (
            <ActivityIndicator
              size="small"
              color={inWatchlist ? '#ef4444' : '#ffffff'}
            />
          ) : (
            <Text
              style={[
                styles.watchlistButtonText,
                inWatchlist && styles.watchlistButtonTextRemove,
              ]}
            >
              {session
                ? inWatchlist
                  ? 'Remove from Watchlist'
                  : 'Add to Watchlist'
                : 'Sign in to Add to Watchlist'}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Synopsis */}
      {movie.synopsis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Synopsis</Text>
          <Text style={styles.synopsis}>{movie.synopsis}</Text>
        </View>
      )}

      {/* Cast */}
      {movie.cast.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cast</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.castScroll}
          >
            {movie.cast.map((person) => (
              <View key={person.id} style={styles.castCard}>
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
                {person.character && (
                  <Text style={styles.castCharacter} numberOfLines={1}>
                    {person.character}
                  </Text>
                )}
                <Text style={styles.castRole}>{person.role_type}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Where to Stream */}
      <View style={styles.streamSection}>
        <Text style={styles.streamSectionTitle}>Where to Stream</Text>
        <View style={styles.streamList}>
          {movie.availability.length === 0 ? (
            <Text style={styles.noStreaming}>No streaming options found</Text>
          ) : (
            movie.availability.map((avail) => (
              <View key={avail.id} style={styles.streamItem}>
                <View
                  style={[
                    styles.streamBadge,
                    avail.access_type === 'subscription' && styles.badgeSubscription,
                    avail.access_type === 'rent' && styles.badgeRent,
                    avail.access_type === 'buy' && styles.badgeBuy,
                  ]}
                >
                  <Text style={styles.streamBadgeText}>
                    {avail.access_type.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.streamText}>
                  {formatAccessType(avail)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
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
  backButtonFloating: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
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
    borderRadius: 12,
    alignItems: 'center',
  },
  watchlistButtonRemove: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  watchlistButtonDisabled: {
    opacity: 0.7,
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
  castRole: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
    textTransform: 'capitalize',
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
  streamList: {
  },
  streamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  streamBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 90,
    alignItems: 'center',
  },
  badgeSubscription: {
    backgroundColor: '#10b981',
  },
  badgeRent: {
    backgroundColor: '#f59e0b',
  },
  badgeBuy: {
    backgroundColor: '#6366f1',
  },
  streamBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  streamText: {
    fontSize: 15,
    color: '#e5e7eb',
    flex: 1,
    marginLeft: 12,
  },
  noStreaming: {
    fontSize: 15,
    color: '#9ca3af',
  },
  bottomSpacer: {
    height: 40,
  },
});
