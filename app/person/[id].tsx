import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  profile_path: string | null;
}

interface MovieCredit {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  popularity: number;
}

function sortAndDedupeCredits(cast: MovieCredit[]): MovieCredit[] {
  const sorted = [...cast].sort((a, b) => {
    const popDiff = (b.popularity ?? 0) - (a.popularity ?? 0);
    if (Math.abs(popDiff) > 1e-6) return popDiff;
    const da = a.release_date ?? '';
    const db = b.release_date ?? '';
    return db.localeCompare(da);
  });

  const seen = new Set<number>();
  const unique: MovieCredit[] = [];
  for (const m of sorted) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    unique.push(m);
  }
  return unique;
}

const POSTER_WIDTH = (Dimensions.get('window').width - 48) / 3;

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [movies, setMovies] = useState<MovieCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    if (!id || !/^\d+$/.test(id)) {
      setError('Invalid person ID');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
      if (!apiKey) {
        setError('TMDB API key not configured');
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${apiKey}` };

      try {
        const [personRes, creditsRes] = await Promise.all([
          fetch(`${TMDB_BASE}/person/${id}`, { headers }),
          fetch(`${TMDB_BASE}/person/${id}/movie_credits`, { headers }),
        ]);

        if (!personRes.ok) {
          throw new Error(`Person not found (${personRes.status})`);
        }
        if (!creditsRes.ok) {
          throw new Error(`Credits failed (${creditsRes.status})`);
        }

        const personData = (await personRes.json()) as PersonDetails;
        const creditsData = (await creditsRes.json()) as {
          cast?: Record<string, unknown>[];
        };

        const rawCast: MovieCredit[] = (creditsData.cast ?? []).map((c) => {
          const title =
            (typeof c.title === 'string' && c.title) ||
            (typeof c.original_title === 'string' && c.original_title) ||
            'Untitled';
          return {
            id: c.id as number,
            title,
            poster_path: (c.poster_path as string | null) ?? null,
            release_date: (c.release_date as string | null) ?? null,
            popularity:
              typeof c.popularity === 'number' ? c.popularity : 0,
          };
        });

        const sorted = sortAndDedupeCredits(rawCast);

        if (!cancelled) {
          setPerson(personData);
          setMovies(sorted);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const profileUri = useMemo(() => {
    if (!person?.profile_path) return null;
    return `${TMDB_IMAGE_BASE}/h632${person.profile_path}`;
  }, [person?.profile_path]);

  const renderMovie = useCallback(
    ({ item }: { item: MovieCredit }) => (
      <Pressable
        style={({ pressed }) => [styles.movieCard, pressed && styles.movieCardPressed]}
        onPress={() =>
          router.push({
            pathname: '/movie/[id]',
            params: { id: String(item.id) },
          })
        }
      >
        {item.poster_path ? (
          <Image
            source={{ uri: `${TMDB_IMAGE_BASE}/w342${item.poster_path}` }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Text style={styles.posterPlaceholderText}>?</Text>
          </View>
        )}
        <Text style={styles.movieTitle} numberOfLines={2}>
          {item.title}
        </Text>
      </Pressable>
    ),
    [router]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !person) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#ffffff" />
          </Pressable>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Person not found'}</Text>
          <Pressable style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const bio = person.biography?.trim() ?? '';
  const bioLong = bio.length > 280;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#ffffff" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.hero}>
          {profileUri ? (
            <Image source={{ uri: profileUri }} style={styles.profileImage} resizeMode="cover" />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profileInitial}>{person.name.charAt(0)}</Text>
            </View>
          )}
          <Text style={styles.name}>{person.name}</Text>
        </View>

        {bio ? (
          <View style={styles.bioSection}>
            <Text style={styles.bioLabel}>Biography</Text>
            <Text
              style={styles.bioText}
              numberOfLines={bioExpanded ? undefined : 4}
            >
              {bio}
            </Text>
            {bioLong ? (
              <Pressable onPress={() => setBioExpanded((e) => !e)} style={styles.readMore}>
                <Text style={styles.readMoreText}>
                  {bioExpanded ? 'Show less' : 'Read more'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Text style={styles.noBio}>No biography available.</Text>
        )}

        {movies.length > 0 ? (
          <View style={styles.knownSection}>
            <Text style={styles.sectionTitle}>Known For</Text>
            <FlatList
              data={movies}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.knownList}
              renderItem={renderMovie}
              nestedScrollEnabled
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backBtn: {
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  profileImage: {
    width: 160,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  profilePlaceholder: {
    width: 160,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontSize: 64,
    fontWeight: '700',
    color: '#6b7280',
  },
  name: {
    marginTop: 16,
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  bioSection: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  bioLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 10,
  },
  bioText: {
    fontSize: 15,
    color: '#d1d5db',
    lineHeight: 24,
  },
  readMore: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  readMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366f1',
  },
  noBio: {
    paddingHorizontal: 20,
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: 24,
  },
  knownSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  knownList: {
    paddingHorizontal: 16,
    paddingRight: 20,
  },
  movieCard: {
    width: POSTER_WIDTH,
    marginRight: 12,
  },
  movieCardPressed: {
    opacity: 0.85,
  },
  poster: {
    width: POSTER_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
  },
  posterPlaceholder: {
    width: POSTER_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: 10,
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterPlaceholderText: {
    fontSize: 28,
    color: '#6b7280',
  },
  movieTitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#e5e7eb',
  },
});
