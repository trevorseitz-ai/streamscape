import { useEffect, useState, useCallback, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  Pressable,
  ListRenderItem,
  Alert,
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

/** Normalize TMDB / Supabase / storage IDs so Set membership never fails on 8 vs "8". */
function normalizeProviderId(id: unknown): string {
  if (typeof id === 'number' && Number.isFinite(id)) return String(Math.trunc(id));
  if (typeof id === 'string' && id.trim() !== '') {
    const n = Number(id);
    return Number.isFinite(n) ? String(Math.trunc(n)) : id.trim();
  }
  const n = Number(id);
  return Number.isFinite(n) ? String(Math.trunc(n)) : String(id);
}

function providerIdSetFromValues(ids: unknown[]): Set<string> {
  return new Set(ids.map(normalizeProviderId));
}

function providerIdsToNumberArray(set: Set<string>): number[] {
  return Array.from(set, (s) => Number(s)).filter((n) => Number.isFinite(n));
}

export default function SettingsScreen() {
  const router = useRouter();
  const { selectedCountry } = useCountry();
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
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
            const raw = profile.enabled_services as unknown[];
            enabledIds = providerIdsToNumberArray(providerIdSetFromValues(raw));
            setSelectedIds(providerIdSetFromValues(raw));
            saveProviderIds(enabledIds);
          } else {
            enabledIds = await getSavedProviderIds();
            setSelectedIds(providerIdSetFromValues(enabledIds as unknown[]));
          }
        } else {
          enabledIds = await getSavedProviderIds();
          setSelectedIds(providerIdSetFromValues(enabledIds as unknown[]));
        }

        const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
        if (!apiKey) {
          setFetchError('TMDB API key not configured');
          return;
        }

        const url = `${TMDB_BASE}/watch/providers/movie?watch_region=${selectedCountry}&language=en-US`;

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

  /** Two-way: add or remove provider id from selection (new Set each update). */
  const handleToggle = useCallback(
    (providerId: number) => {
      const key = normalizeProviderId(providerId);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        const idsArray = providerIdsToNumberArray(next);
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

  const handleSave = useCallback(async () => {
    const idsArray = providerIdsToNumberArray(selectedIds);
    try {
      await saveProviderIds(idsArray);
      if (session) {
        const { error } = await supabase
          .from('user_profiles')
          .upsert(
            { id: session.user.id, enabled_services: idsArray },
            { onConflict: 'id' }
          );
        if (error) {
          Alert.alert('Error', error.message);
          return;
        }
      }
      Alert.alert('Success', 'Providers saved successfully!');
    } catch (e) {
      Alert.alert(
        'Error',
        e instanceof Error ? e.message : 'Could not save preferences'
      );
    }
  }, [selectedIds, session]);

  const selectionRevision = useMemo(
    () => Array.from(selectedIds).sort().join(','),
    [selectedIds]
  );

  const sortedFilteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...providers]
      .filter((p) => p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aSel = selectedIds.has(normalizeProviderId(a.id)) ? 1 : 0;
        const bSel = selectedIds.has(normalizeProviderId(b.id)) ? 1 : 0;
        return bSel - aSel || a.display_priority - b.display_priority;
      });
  }, [providers, searchQuery, selectedIds]);

  const renderProviderItem: ListRenderItem<ProviderEntry> = useCallback(
    ({ item }) => {
      const idKey = normalizeProviderId(item.id);
      const isSelected = selectedIds.has(idKey);
      return (
        <ProviderCard
          item={item}
          isSelected={isSelected}
          onPress={() => handleToggle(item.id)}
        />
      );
    },
    [handleToggle, selectedIds]
  );

  const listHeader = useMemo(
    () => (
      <>
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
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your streaming preferences</Text>
        </View>

        <SavePreferencesButton onPress={handleSave} />

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
            </>
          )}
        </View>
      </>
    ),
    [
      averageRating,
      favoriteMovie,
      fetchError,
      handleSave,
      ratingDistribution,
      router,
      searchQuery,
      totalWatched,
    ]
  );

  const listFooter = useMemo(
    () => (
      <>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {selectedIds.size === 0
              ? 'No services selected — Discover will show all movies.'
              : `${selectedIds.size} service${selectedIds.size > 1 ? 's' : ''} selected — Discover will prioritize movies on your services.`}
          </Text>
        </View>

        {__DEV__ ? (
          <View style={styles.devSection}>
            <Text style={styles.devSectionTitle}>Developer</Text>
            <Pressable
              style={({ pressed }) => [
                styles.devRow,
                pressed && styles.providerCardPressing,
              ]}
              onPress={() => router.push('/dev/network-diag')}
            >
              <Text style={styles.devRowText}>Network diagnostics</Text>
              <Ionicons name="chevron-forward" size={20} color="#a5b4fc" />
            </Pressable>
            <Text style={styles.devHint}>
              Test TMDB, Metro, and Supabase from inside the app (no TV browser). On your Mac you can
              also run: npm run adb:open-url -- https://www.google.com
            </Text>
          </View>
        ) : null}
      </>
    ),
    [router, selectedIds.size]
  );

  // Auth guard: blackout when not logged in (Log In button always accessible)
  if (!session) {
    return (
      <View style={styles.blackout}>
        <Text style={styles.blackoutBrand}>ReelDive</Text>
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

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={false}
      ListHeaderComponent={listHeader}
      data={fetchError ? [] : sortedFilteredProviders}
      keyExtractor={(item) => normalizeProviderId(item.id)}
      numColumns={3}
      extraData={selectionRevision}
      columnWrapperStyle={fetchError ? undefined : styles.providerRow}
      renderItem={renderProviderItem}
      ListFooterComponent={listFooter}
    />
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
    marginBottom: 16,
  },
  savePreferencesButton: {
    alignSelf: 'stretch',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  savePreferencesButtonFocused: {
    borderColor: '#ffffff',
    borderWidth: 3,
    transform: [{ scale: 1.05 }],
    overflow: 'visible',
    zIndex: 2,
    elevation: 6,
  },
  savePreferencesButtonPressing: {
    opacity: 0.88,
  },
  savePreferencesButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
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
  providerRow: {
    gap: 12,
    marginBottom: 12,
  },
  providerCard: {
    flex: 1,
    minWidth: 90,
    maxWidth: '33.33%',
    borderRadius: 10,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  /** Unselected: stable layout (same border width) without a visible outline */
  providerCardInactive: {
    borderColor: 'transparent',
    backgroundColor: '#1a1a1a',
  },
  /** Selected: indigo frame + subtle tint so state reads instantly */
  providerCardActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.16)',
  },
  /** D-pad / TV remote focus — distinct from saved selection */
  providerCardFocused: {
    borderColor: '#ffffff',
    borderWidth: 3,
    transform: [{ scale: 1.05 }],
    overflow: 'visible',
    zIndex: 2,
    elevation: 6,
  },
  providerCardPressing: {
    opacity: 0.88,
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
  devSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  devSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#312e81',
  },
  devRowText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0e7ff',
  },
  devHint: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
    marginTop: 10,
  },
});

type SavePreferencesButtonProps = {
  onPress: () => void;
};

function SavePreferencesButton({ onPress }: SavePreferencesButtonProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={({ pressed }) => [
        styles.savePreferencesButton,
        isFocused && styles.savePreferencesButtonFocused,
        pressed && styles.savePreferencesButtonPressing,
      ]}
      onPress={onPress}
    >
      <Text style={styles.savePreferencesButtonText}>Save Preferences</Text>
    </Pressable>
  );
}

type ProviderCardProps = {
  item: ProviderEntry;
  isSelected: boolean;
  onPress: () => void;
};

function ProviderCard({ item, isSelected, onPress }: ProviderCardProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={({ pressed }) => [
        styles.providerCard,
        isSelected ? styles.providerCardActive : styles.providerCardInactive,
        isFocused && styles.providerCardFocused,
        pressed && styles.providerCardPressing,
      ]}
      onPress={onPress}
    >
      <View style={styles.providerCardContent}>
        {item.logo_url ? (
          <Image source={{ uri: item.logo_url }} style={styles.providerLogo} />
        ) : (
          <View style={styles.providerLogoPlaceholder}>
            <Text style={styles.providerLogoPlaceholderText}>
              {item.name.charAt(0)}
            </Text>
          </View>
        )}
        <Text style={styles.providerName} numberOfLines={2}>
          {item.name}
        </Text>
      </View>
      {isSelected ? (
        <View style={styles.providerCheckmark} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={18} color="#6366f1" />
        </View>
      ) : null}
    </Pressable>
  );
}
