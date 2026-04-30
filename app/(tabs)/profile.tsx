import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  memo,
} from 'react';
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
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bucketViewportWidth } from '../../components/MovieRow';
import { supabase } from '../../lib/supabase';
import {
  getSavedProviderIds,
  saveProviderIds,
} from '../../lib/provider-preferences';
import { resolveStreamFinderProviderLogoUrl } from '../../lib/stream-finder-supabase';
import { isTvTarget } from '../../lib/isTv';

const CONTENT_HORIZONTAL_PAD = 20;
const PROFILE_GRID_GAP = 10;

interface ProviderEntry {
  id: number;
  name: string;
  logo_url: string;
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
  const { width: rawWidth } = useWindowDimensions();
  const viewportBucket = bucketViewportWidth(rawWidth);
  const innerContentWidth =
    viewportBucket - CONTENT_HORIZONTAL_PAD * 2;
  const isTV = isTvTarget();
  /** Android TV: list / chrome must not become accidental focus targets after grid updates. */
  const tvNf =
    isTV && Platform.OS === 'android'
      ? ({ focusable: false, collapsable: false } as const)
      : {};
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [catalogPrunedNotice, setCatalogPrunedNotice] = useState(false);
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

  /** Stream Finder catalog: load once per Profile mount (anon RLS read). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFetchError(null);
      setCatalogLoading(true);
      try {
        const { data, error } = await supabase
          .from('stream_finder_providers')
          .select('provider_id, name, logo_path')
          .order('name', { ascending: true });

        if (cancelled) return;
        if (error) {
          setFetchError(error.message);
          setProviders([]);
          return;
        }

        const rows = data ?? [];
        const mapped: ProviderEntry[] = rows.map((row) => ({
          id: Number(row.provider_id),
          name: row.name,
          logo_url: resolveStreamFinderProviderLogoUrl(row.logo_path),
        }));

        setProviders(mapped);
      } catch (err) {
        if (!cancelled) {
          setFetchError(
            err instanceof Error ? err.message : 'Failed to load providers'
          );
          setProviders([]);
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeProviderIdSet = useMemo(
    () => new Set(providers.map((p) => p.id)),
    [providers]
  );

  /**
   * Hydrate selections from profile / local storage, then prune to the active
   * `stream_finder_providers` catalog once the catalog load has finished.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (catalogLoading) return;

      let rawSaved: number[] = [];

      if (fetchError) {
        if (session) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('enabled_services')
            .eq('id', session.user.id)
            .maybeSingle();
          if (cancelled) return;
          if (profile?.enabled_services) {
            rawSaved = providerIdsToNumberArray(
              providerIdSetFromValues(profile.enabled_services as unknown[])
            );
          } else {
            rawSaved = await getSavedProviderIds();
          }
        } else {
          rawSaved = await getSavedProviderIds();
        }
        if (!cancelled) {
          setSelectedIds(providerIdSetFromValues(rawSaved as unknown[]));
        }
        return;
      }

      if (session) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('enabled_services')
          .eq('id', session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (profile?.enabled_services) {
          rawSaved = providerIdsToNumberArray(
            providerIdSetFromValues(profile.enabled_services as unknown[])
          );
        } else {
          rawSaved = await getSavedProviderIds();
        }
      } else {
        rawSaved = await getSavedProviderIds();
      }

      if (cancelled) return;

      const pruned = rawSaved.filter((id) => activeProviderIdSet.has(id));

      if (pruned.length !== rawSaved.length) {
        const removed = rawSaved.filter((id) => !activeProviderIdSet.has(id));
        console.info(
          '[profile] Pruned stale streaming selections (not in stream_finder_providers)',
          { removed }
        );
        await saveProviderIds(pruned);
        if (session) {
          await supabase.from('user_profiles').upsert(
            { id: session.user.id, enabled_services: pruned },
            { onConflict: 'id' }
          );
        }
        if (!cancelled) setCatalogPrunedNotice(true);
      }

      if (!cancelled) {
        setSelectedIds(providerIdSetFromValues(pruned as unknown[]));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    session,
    providers,
    catalogLoading,
    fetchError,
    activeProviderIdSet,
  ]);

  useEffect(() => {
    if (!catalogPrunedNotice) return;
    const t = setTimeout(() => setCatalogPrunedNotice(false), 10000);
    return () => clearTimeout(t);
  }, [catalogPrunedNotice]);

  /** Two-way: add or remove provider id from selection (new Set each update). */
  const handleSave = useCallback(async () => {
    const idsArray = providerIdsToNumberArray(selectedIds).filter((id) =>
      activeProviderIdSet.has(id)
    );
    try {
      await saveProviderIds(idsArray);
      setSelectedIds(providerIdSetFromValues(idsArray as unknown[]));
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
  }, [selectedIds, session, activeProviderIdSet]);

  const selectionRevision = useMemo(
    () => Array.from(selectedIds).sort().join(','),
    [selectedIds]
  );

  /**
   * Search filter + fixed display order only (no re-sort when selection changes).
   * Order stays stable so TV FlatList cells are not remounted on add/remove.
   */
  const numColumns = useMemo(() => {
    if (isTV) return Math.min(8, Math.max(4, Math.floor(innerContentWidth / 112)));
    return innerContentWidth >= 380 ? 5 : 4;
  }, [innerContentWidth, isTV]);

  const tileWidth = useMemo(() => {
    const usable = innerContentWidth - PROFILE_GRID_GAP * (numColumns - 1);
    return Math.max(72, Math.floor(usable / numColumns));
  }, [innerContentWidth, numColumns]);

  const sortedFilteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return providers.filter((p) => p.name.toLowerCase().includes(q));
  }, [providers, searchQuery]);

  const servicesEmptyQuiet =
    !catalogLoading &&
    !fetchError &&
    sortedFilteredProviders.length === 0 &&
    providers.length > 0;

  const catalogEmptyAfterSync =
    !catalogLoading && !fetchError && providers.length === 0;

  const handleToggle = useCallback(
    (providerId: number) => {
      if (!activeProviderIdSet.has(providerId)) return;

      const key = normalizeProviderId(providerId);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        const idsArray = providerIdsToNumberArray(next).filter((id) =>
          activeProviderIdSet.has(id)
        );

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

        return providerIdSetFromValues(idsArray as unknown[]);
      });
    },
    [session, activeProviderIdSet]
  );

  const renderProviderItem = useCallback<ListRenderItem<ProviderEntry>>(
    ({ item }) => {
      const idKey = normalizeProviderId(item.id);
      const isSelected = selectedIds.has(idKey);
      return (
        <ProviderCard
          item={item}
          isSelected={isSelected}
          tileWidth={tileWidth}
          onPress={() => handleToggle(item.id)}
        />
      );
    },
    [selectedIds, handleToggle, tileWidth]
  );

  const listHeader = useMemo(
    () => (
      <>
        <View style={styles.cinematicSection} {...tvNf}>
          <Text style={styles.cinematicSectionTitle}>Your Cinematic Profile</Text>
          <View style={styles.statsRow} {...tvNf}>
            <View style={styles.statCard} {...tvNf}>
              <Text style={styles.statCardLabel}>Movies Watched</Text>
              <Text style={styles.statCardValue}>{totalWatched}</Text>
            </View>
            <View style={styles.statCard} {...tvNf}>
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
          <View style={styles.chartBlock} {...tvNf}>
            <Text style={styles.chartLabel}>Rating distribution</Text>
            <View style={styles.chartRow} {...tvNf}>
              {ratingDistribution.map((count, index) => {
                const rating = index + 1;
                const maxCount = Math.max(...ratingDistribution, 0);
                const barHeight =
                  maxCount === 0 ? 0 : (count / maxCount) * 60;
                return (
                  <View key={rating} style={styles.chartColumn} {...tvNf}>
                    <View style={styles.chartBarTrack} {...tvNf}>
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

        <View style={styles.header} {...tvNf}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your streaming preferences</Text>
        </View>

        <SavePreferencesButton onPress={handleSave} />

        <View style={styles.section} {...tvNf}>
          <Text style={styles.sectionTitle}>My Services</Text>
          <Text style={styles.sectionDescription}>
            Tap to select the services you subscribe to. Discover results will be
            filtered to show movies available on your services.
          </Text>

          {catalogPrunedNotice ? (
            <Text style={styles.catalogPrunedHint} {...tvNf}>
              Your saved services were updated to match the current streaming catalog (some
              entries are no longer in the feed).
            </Text>
          ) : null}

          {fetchError ? (
            <View style={styles.errorBox} {...tvNf}>
              <Text style={styles.errorText}>{fetchError}</Text>
            </View>
          ) : catalogLoading ? (
            <View style={styles.servicesCatalogLoading} {...tvNf}>
              <ActivityIndicator size="small" color="#6366f1" />
              <Text style={styles.servicesCatalogLoadingText}>
                Loading available services...
              </Text>
            </View>
          ) : catalogEmptyAfterSync ? (
            <Text style={styles.servicesQuietEmpty}>
              Loading available services...
            </Text>
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
      catalogLoading,
      catalogEmptyAfterSync,
      catalogPrunedNotice,
      favoriteMovie,
      fetchError,
      handleSave,
      ratingDistribution,
      router,
      searchQuery,
      totalWatched,
      tvNf,
    ]
  );

  const listFooter = useMemo(
    () => (
      <>
        <View style={styles.infoBox} {...tvNf}>
          <Text style={styles.infoText}>
            {selectedIds.size === 0
              ? 'No services selected — Discover will show all movies.'
              : `${selectedIds.size} service${selectedIds.size > 1 ? 's' : ''} selected — Discover will prioritize movies on your services.`}
          </Text>
        </View>

        {__DEV__ ? (
          <View style={styles.devSection} {...tvNf}>
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
    [router, selectedIds.size, tvNf]
  );

  // Auth guard: blackout when not logged in (Log In button always accessible)
  if (!session) {
    return (
      <View style={styles.blackout} {...tvNf}>
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

  return (
    <FlatList
      {...tvNf}
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={false}
      ListHeaderComponent={listHeader}
      data={
        fetchError || catalogLoading || catalogEmptyAfterSync
          ? []
          : sortedFilteredProviders
      }
      keyExtractor={(item) => normalizeProviderId(item.id)}
      numColumns={numColumns}
      extraData={{ selectionRevision, tileWidth, numColumns }}
      columnWrapperStyle={
        fetchError || catalogLoading || catalogEmptyAfterSync
          ? undefined
          : styles.providerRow
      }
      renderItem={renderProviderItem}
      ListFooterComponent={listFooter}
      ListEmptyComponent={
        servicesEmptyQuiet ? (
          <Text style={[styles.servicesQuietEmpty, { marginBottom: 16 }]}>
            No services match your search.
          </Text>
        ) : null
      }
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
  servicesCatalogLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  servicesCatalogLoadingText: {
    flex: 1,
    fontSize: 14,
    color: '#9ca3af',
  },
  servicesQuietEmpty: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  catalogPrunedHint: {
    fontSize: 13,
    color: '#818cf8',
    lineHeight: 18,
    marginBottom: 14,
  },
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: PROFILE_GRID_GAP,
    marginBottom: PROFILE_GRID_GAP,
    width: '100%',
  },
  providerCard: {
    borderRadius: 10,
    borderWidth: 2,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  /** Unselected: dimmed, neutral border */
  providerCardInactive: {
    borderColor: '#2d2d2d',
    backgroundColor: '#1a1a1a',
    opacity: 0.7,
  },
  /** Selected: green border, full opacity */
  providerCardActive: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    opacity: 1,
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
  tileWidth: number;
  onPress: () => void;
};

function providerCardPropsAreEqual(
  prev: Readonly<ProviderCardProps>,
  next: Readonly<ProviderCardProps>
): boolean {
  return (
    normalizeProviderId(prev.item.id) === normalizeProviderId(next.item.id) &&
    prev.isSelected === next.isSelected &&
    prev.tileWidth === next.tileWidth &&
    prev.item.logo_url === next.item.logo_url
  );
}

const ProviderCard = memo(function ProviderCard({
  item,
  isSelected,
  tileWidth,
  onPress,
}: ProviderCardProps) {
  const [isFocused, setIsFocused] = useState(false);
  const logoSize = Math.min(
    56,
    Math.max(36, Math.floor(tileWidth * 0.52))
  );

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={({ pressed }) => [
        styles.providerCard,
        { width: tileWidth },
        isSelected ? styles.providerCardActive : styles.providerCardInactive,
        isFocused && styles.providerCardFocused,
        pressed && styles.providerCardPressing,
      ]}
      onPress={onPress}
    >
      <View style={styles.providerCardContent}>
        <Image
          source={{ uri: item.logo_url }}
          style={[
            styles.providerLogo,
            { width: logoSize, height: logoSize },
          ]}
        />
        <Text style={styles.providerName} numberOfLines={2}>
          {item.name}
        </Text>
      </View>
      {isSelected ? (
        <View style={styles.providerCheckmark} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
        </View>
      ) : null}
    </Pressable>
  );
}, providerCardPropsAreEqual);
