import { useEffect, useState, useCallback, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import {
  getSavedProviderIds,
  saveProviderIds,
} from '../../lib/provider-preferences';
import { useCountry } from '../../lib/country-context';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

interface ProviderEntry {
  id: number;
  name: string;
  logo_url: string | null;
  display_priority: number;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { selectedCountry } = useCountry();
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [watchedRows, setWatchedRows] = useState<
    {
      tmdb_id: number;
      title: string | null;
      personal_rating: number | null;
    }[]
  >([]);

  useEffect(() => {
    if (!session) {
      setWatchedRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('watched_history')
        .select('tmdb_id, title, personal_rating')
        .eq('user_id', session.user.id);
      if (cancelled) return;
      if (error) {
        console.warn('watched_history stats:', error.message);
        setWatchedRows([]);
        return;
      }
      setWatchedRows(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const {
    totalWatched,
    averageRating,
    ratingDistribution,
    favoriteMovie,
  } = useMemo(() => {
    const total = watchedRows.length;
    const nonNull = watchedRows
      .map((r) => r.personal_rating)
      .filter((r): r is number => r != null);
    const average =
      nonNull.length === 0
        ? null
        : Math.round(
            (nonNull.reduce((sum, n) => sum + n, 0) / nonNull.length) * 10
          ) / 10;
    const counts = Array.from({ length: 10 }, () => 0);
    for (const row of watchedRows) {
      const v = row.personal_rating;
      if (v != null && v >= 1 && v <= 10) counts[v - 1] += 1;
    }

    let favoriteMovie: (typeof watchedRows)[number] | null = null;
    const ratedMovies = watchedRows.filter((m) => m.personal_rating != null);
    if (ratedMovies.length > 0) {
      ratedMovies.sort(
        (a, b) => (b.personal_rating ?? 0) - (a.personal_rating ?? 0)
      );
      favoriteMovie = ratedMovies[0];
    }

    return {
      totalWatched: total,
      averageRating: average,
      ratingDistribution: counts,
      favoriteMovie,
    };
  }, [watchedRows]);

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s);
      });
    }, [])
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => setSession(s)
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function load() {
      try {
        let enabledIds: number[] = [];

        if (session) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('enabled_services')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile?.enabled_services) {
            enabledIds = profile.enabled_services as number[];
            setSelectedIds(new Set(enabledIds));
            saveProviderIds(enabledIds);
          } else {
            enabledIds = await getSavedProviderIds();
            setSelectedIds(new Set(enabledIds));
          }
        } else {
          enabledIds = await getSavedProviderIds();
          setSelectedIds(new Set(enabledIds));
        }

        const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
        if (!apiKey) {
          console.log('Fetching providers: API key is missing or empty');
          setFetchError('TMDB API key not configured');
          return;
        }

        const url = `${TMDB_BASE}/watch/providers/movie?watch_region=${selectedCountry}&language=en-US`;
        console.log('Fetching providers with URL:', url);

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!res.ok) {
          setFetchError(`Failed to load providers (${res.status})`);
          return;
        }

        const data = await res.json();
        const results: Array<{
          provider_id: number;
          provider_name: string;
          logo_path: string | null;
          display_priority: number;
        }> = data.results ?? [];

        const mapped = results
          .sort((a, b) => a.display_priority - b.display_priority)
          .map((p) => ({
            id: p.provider_id,
            name: p.provider_name,
            logo_url: p.logo_path ? `${TMDB_IMAGE_BASE}${p.logo_path}` : null,
            display_priority: p.display_priority,
          }));

        setProviders(mapped);
      } catch (err) {
        setFetchError(
          err instanceof Error ? err.message : 'Failed to load providers'
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [session, selectedCountry]);

  const handleToggle = useCallback(
    (providerId: number) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(providerId)) {
          next.delete(providerId);
        } else {
          next.add(providerId);
        }
        const idsArray = Array.from(next);
        saveProviderIds(idsArray);

        if (session) {
          supabase
            .from('user_profiles')
            .upsert(
              { id: session.user.id, enabled_services: idsArray },
              { onConflict: 'id' }
            )
            .then(({ error }) => {
              if (error) console.warn('Failed to save to Supabase:', error.message);
            });
        }

        return next;
      });
    },
    [session]
  );

  // Auth guard: blackout when not logged in (Log In button always accessible)
  if (!session) {
    return (
      <View style={styles.blackout}>
        <Text style={styles.blackoutBrand}>StreamScape</Text>
        <Text style={styles.blackoutHint}>Sign in to manage your settings</Text>
        <Pressable
          style={styles.blackoutButton}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.blackoutButtonText}>Log In</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const q = searchQuery.trim().toLowerCase();
  const filteredProviders = providers.filter((p) =>
    p.name.toLowerCase().includes(q)
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.cinematicSection}>
        <Text style={styles.cinematicSectionTitle}>Your Cinematic Profile</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>Movies Watched</Text>
            <Text style={styles.statCardValue}>{totalWatched}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>Average Rating</Text>
            <Text style={styles.statCardValue}>
              {averageRating != null ? averageRating : '—'}
            </Text>
          </View>
        </View>
        {favoriteMovie ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/movie/[id]',
                params: {
                  id: String(favoriteMovie.tmdb_id),
                  fromWatched: 'true',
                },
              })
            }
            style={({ pressed }) => [
              styles.favoriteMoviePressable,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.statCardLabel}>Favorite Movie</Text>
            <Text style={styles.favoriteMovieText} numberOfLines={2}>
              {favoriteMovie.title?.trim() || 'Untitled'} ⭐️{' '}
              {favoriteMovie.personal_rating}/10
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.chartBlock}>
          <Text style={styles.chartLabel}>Rating distribution</Text>
          <View style={styles.chartRow}>
            {ratingDistribution.map((count, index) => {
              const rating = index + 1;
              const maxCount = Math.max(...ratingDistribution, 0);
              const barHeight =
                maxCount === 0 ? 0 : (count / maxCount) * 60;
              return (
                <View key={rating} style={styles.chartColumn}>
                  <View style={styles.chartBarTrack}>
                    <View
                      style={[
                        styles.chartBarFill,
                        { height: barHeight },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartAxisLabel}>{rating}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage your streaming preferences</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Services</Text>
        <Text style={styles.sectionDescription}>
          Tap to select the services you subscribe to. Discover results will be
          filtered to show movies available on your services.
        </Text>

        {fetchError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{fetchError}</Text>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.servicesSearchInput}
              placeholder="Search services..."
              placeholderTextColor="#6b7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.providerGrid}>
            {[...filteredProviders]
              .sort(
                (a, b) =>
                  (selectedIds.has(b.id) ? 1 : 0) - (selectedIds.has(a.id) ? 1 : 0) ||
                  a.display_priority - b.display_priority
              )
              .map((provider) => {
              const isSelected = selectedIds.has(provider.id);
              return (
                <Pressable
                  key={provider.id}
                  style={({ pressed }) => [
                    styles.providerCard,
                    isSelected && styles.providerCardSelected,
                    pressed && styles.providerCardPressed,
                  ]}
                  onPress={() => handleToggle(provider.id)}
                >
                  <View style={styles.providerCardContent}>
                    {provider.logo_url ? (
                      <Image
                        source={{ uri: provider.logo_url }}
                        style={styles.providerLogo}
                      />
                    ) : (
                      <View style={styles.providerLogoPlaceholder}>
                        <Text style={styles.providerLogoPlaceholderText}>
                          {provider.name.charAt(0)}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.providerName} numberOfLines={2}>
                      {provider.name}
                    </Text>
                  </View>
                  {isSelected ? (
                    <View style={styles.providerCheckmark}>
                      <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          </>
        )}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          {selectedIds.size === 0
            ? 'No services selected — Discover will show all movies.'
            : `${selectedIds.size} service${selectedIds.size > 1 ? 's' : ''} selected — Discover will prioritize movies on your services.`}
        </Text>
      </View>
    </ScrollView>
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
    marginBottom: 8,
  },
  blackoutHint: {
    fontSize: 14,
    color: '#9ca3af',
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
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 80,
    flexGrow: 1,
  },
  cinematicSection: {
    marginBottom: 28,
  },
  cinematicSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  statCardLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 8,
    fontWeight: '500',
  },
  statCardValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#6366f1',
    letterSpacing: -0.5,
  },
  favoriteMoviePressable: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    marginBottom: 20,
  },
  favoriteMovieText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366f1',
    letterSpacing: -0.2,
  },
  chartBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  chartLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
    fontWeight: '500',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
    minHeight: 72,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarTrack: {
    width: '100%',
    height: 60,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  chartBarFill: {
    width: '100%',
    maxWidth: 28,
    backgroundColor: '#6366f1',
    borderRadius: 4,
    minHeight: 0,
  },
  chartAxisLabel: {
    marginTop: 6,
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  center: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginBottom: 24,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  servicesSearchInput: {
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    fontSize: 16,
  },
  providerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  providerCard: {
    width: '31%',
    minWidth: 90,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2d2d2d',
    padding: 12,
    alignItems: 'center',
    position: 'relative',
  },
  providerCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#1e1b4b',
  },
  providerCardPressed: {
    opacity: 0.8,
  },
  providerCardContent: {
    alignItems: 'center',
    width: '100%',
  },
  providerCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  providerLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#2d2d2d',
  },
  providerLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerLogoPlaceholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
  },
  providerName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 8,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#1e1b4b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#312e81',
  },
  infoText: {
    fontSize: 14,
    color: '#a5b4fc',
    lineHeight: 20,
  },
});
