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
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Pressable,
  Alert,
  Modal,
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
import { flushDiscoverFeedCachesAfterProfileSave } from '../../lib/discover-streaming-preferences-reset';
import { isTvTarget, shouldUseTvDpadFocus } from '../../lib/isTv';
import { tvPreferredFocusProps } from '../../lib/tvFocus';

const CONTENT_HORIZONTAL_PAD = 20;
const PROFILE_GRID_GAP = 10;
/** Fixed provider tile — same rail width as search + save (`100%` of padded content, `maxWidth: innerContentWidth`). */
const PROFILE_PROVIDER_CELL_W_PX = 80;
const PROFILE_PROVIDER_CELL_ICON_PX = 48;
const PROFILE_PROVIDER_CELL_MIN_H_PX = 96;

interface ProviderEntry {
  id: number;
  name: string;
  logo_url: string;
}

type ProfileSaveFeedback = {
  variant: 'success' | 'error';
  title: string;
  message: string;
};

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
  /** Native Alert dialogs do not receive D-pad focus on Android TV — use an in-tree Modal instead. */
  const useTvSaveFeedbackModal = shouldUseTvDpadFocus();
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
  const [profileSaveFeedback, setProfileSaveFeedback] =
    useState<ProfileSaveFeedback | null>(null);

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

  /** IDs returned from sync (`stream_finder_providers`). New providers after sync appear here after reload/prefetch. */
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
    console.log('[ReelDive Debug] Save Preferences: handler entered (button press / onPress).');

    try {
      const idsArray = providerIdsToNumberArray(selectedIds).filter((id) =>
        activeProviderIdSet.has(id)
      );
      console.log('[ReelDive Debug] Save Preferences: normalized provider id array for persist:', {
        count: idsArray.length,
        ids: idsArray,
        sessionPresent: session != null,
        sessionUserId: session?.user?.id ?? '(none)',
        catalogSize: activeProviderIdSet.size,
      });

      console.log('[ReelDive Debug] Save Preferences: writing to AsyncStorage via saveProviderIds...');
      await saveProviderIds(idsArray);
      console.log('[ReelDive Debug] Save Preferences: AsyncStorage saveProviderIds resolved OK.');

      setSelectedIds(providerIdSetFromValues(idsArray as unknown[]));
      console.log('[ReelDive Debug] Save Preferences: React selectedIds state synced to saved array.');

      if (session) {
        console.log(
          '[ReelDive Debug] Save Preferences: session exists — initiating Supabase user_profiles upsert...'
        );
        const { error } = await supabase
          .from('user_profiles')
          .upsert(
            { id: session.user.id, enabled_services: idsArray },
            { onConflict: 'id' }
          );
        console.log('[ReelDive Debug] Save Preferences: Supabase upsert await finished.', {
          hasError: error != null,
          errorMessage: error?.message ?? null,
          errorDetails: error ?? null,
        });

        if (error) {
          console.error('[ReelDive Debug] Save Preferences: Supabase returned error — aborting flush & success UI.', error);
          if (useTvSaveFeedbackModal) {
            setProfileSaveFeedback({ variant: 'error', title: 'Error', message: error.message });
          } else {
            Alert.alert('Error', error.message);
          }
          return;
        }
      } else {
        console.log(
          '[ReelDive Debug] Save Preferences: no session object — skipping Supabase upsert (local storage only path).'
        );
      }

      console.log(
        '[ReelDive Debug] Save Preferences: persistence successful — invoking flushDiscoverFeedCachesAfterProfileSave()...'
      );
      flushDiscoverFeedCachesAfterProfileSave();
      console.log(
        '[ReelDive Debug] Save Preferences: flushDiscoverFeedCachesAfterProfileSave() returned (sync dispatcher done).'
      );

      if (useTvSaveFeedbackModal) {
        setProfileSaveFeedback({
          variant: 'success',
          title: 'Success',
          message: 'Providers saved successfully!',
        });
      } else {
        Alert.alert('Success', 'Providers saved successfully!');
      }
      console.log(
        `[ReelDive Debug] Save Preferences: success ${useTvSaveFeedbackModal ? 'TV modal' : 'Alert'} queued; handler exiting normally.`
      );
    } catch (catchError) {
      console.error(
        '[ReelDive Debug] CRITICAL UNHANDLED EXCEPTION inside Profile handleSave:',
        catchError
      );
      const msg =
        catchError instanceof Error ? catchError.message : 'Could not save preferences';
      if (useTvSaveFeedbackModal) {
        setProfileSaveFeedback({ variant: 'error', title: 'Error', message: msg });
      } else {
        Alert.alert('Error', msg);
      }
    }
  }, [selectedIds, session, activeProviderIdSet, useTvSaveFeedbackModal]);

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

  const listHeader = useMemo(
    () => (
      <View style={styles.section} {...tvNf}>
        <Text style={styles.sectionTitle}>My Services</Text>
        <Text style={styles.sectionDescription}>
          Tap to select the services you subscribe to. Discover results will be filtered to
          show movies available on your services.
        </Text>

        {catalogPrunedNotice ? (
          <Text style={styles.catalogPrunedHint} {...tvNf}>
            Your saved services were updated to match the current streaming catalog (some entries
            are no longer in the feed).
          </Text>
        ) : null}

        {fetchError ? (
          <View style={styles.errorBox} {...tvNf}>
            <Text style={styles.errorText}>{fetchError}</Text>
          </View>
        ) : catalogLoading ? (
          <View style={styles.servicesCatalogLoading} {...tvNf}>
            <ActivityIndicator size="small" color="#6366f1" />
            <Text style={styles.servicesCatalogLoadingText}>Loading available services...</Text>
          </View>
        ) : catalogEmptyAfterSync ? (
          <Text style={styles.servicesQuietEmpty}>Loading available services...</Text>
        ) : (
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
        )}
      </View>
    ),
    [catalogEmptyAfterSync, catalogLoading, catalogPrunedNotice, fetchError, searchQuery, tvNf]
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
          testID="maestro-onboarding-login-btn"
          style={styles.blackoutButton}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.blackoutButtonText}>Log In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screenWithStickySave} collapsable={false} {...tvNf}>
      <ScrollView
        {...tvNf}
        style={styles.containerFlex}
        contentContainerStyle={styles.contentWithStickySaveInset}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {listHeader}
        {!fetchError && !catalogLoading && !catalogEmptyAfterSync ? (
          <View
            style={[
              styles.providerGridStrictBox,
              { maxWidth: innerContentWidth, width: '100%', alignSelf: 'center' },
            ]}
            {...tvNf}
          >
            <View style={styles.providerWrapRow} {...tvNf}>
              {sortedFilteredProviders.map((item) => {
                const idKey = normalizeProviderId(item.id);
                return (
                  <ProviderCard
                    key={idKey}
                    item={item}
                    isSelected={selectedIds.has(idKey)}
                    onPress={() => handleToggle(item.id)}
                  />
                );
              })}
            </View>
          </View>
        ) : null}
        {servicesEmptyQuiet ? (
          <Text style={[styles.servicesQuietEmpty, { marginBottom: 16 }]} {...tvNf}>
            No services match your search.
          </Text>
        ) : null}
        {listFooter}
      </ScrollView>
      <View style={styles.profileSaveBar} collapsable={false} {...tvNf}>
        <SavePreferencesButton onPress={handleSave} stickyBar />
      </View>

      {useTvSaveFeedbackModal ? (
        <Modal
          visible={profileSaveFeedback != null}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setProfileSaveFeedback(null)}
        >
          <View style={styles.profileSaveModalOverlay} collapsable={false} {...tvNf}>
            <View style={styles.profileSaveModalCard} collapsable={false}>
              {profileSaveFeedback ? (
                <>
                  <Text style={styles.profileSaveModalTitle} {...tvNf}>
                    {profileSaveFeedback.title}
                  </Text>
                  <Text style={styles.profileSaveModalBody} {...tvNf}>
                    {profileSaveFeedback.message}
                  </Text>
                  <ProfileSaveModalOkButton
                    onPress={() => setProfileSaveFeedback(null)}
                  />
                </>
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}
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
  /** Root for signed-in Profile: scroll region + pinned save strip */
  screenWithStickySave: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignSelf: 'stretch',
    minHeight: 0,
    width: '100%',
  },
  containerFlex: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#0f0f0f',
  },
  contentWithStickySaveInset: {
    paddingTop: 16,
    paddingHorizontal: CONTENT_HORIZONTAL_PAD,
    paddingBottom: 20,
    flexGrow: 1,
  },
  profileSaveBar: {
    flexShrink: 0,
    flexGrow: 0,
    paddingHorizontal: CONTENT_HORIZONTAL_PAD,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: '#0f0f0f',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2d2d2d',
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
  savePreferencesButtonStickyStrip: {
    marginBottom: 0,
  },
  savePreferencesButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
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
  /** Same padded width rails as **`servicesSearchInput`** / scroll body — tiles wrap inside, never scaled past this box. */
  providerGridStrictBox: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    flexGrow: 0,
    flexShrink: 1,
  },
  providerWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: PROFILE_GRID_GAP,
    marginBottom: PROFILE_GRID_GAP,
  },
  providerCard: {
    width: PROFILE_PROVIDER_CELL_W_PX,
    minHeight: PROFILE_PROVIDER_CELL_MIN_H_PX,
    flexGrow: 0,
    flexShrink: 0,
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
    flexGrow: 0,
    flexShrink: 0,
  },
  providerCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  providerLogo: {
    width: PROFILE_PROVIDER_CELL_ICON_PX,
    height: PROFILE_PROVIDER_CELL_ICON_PX,
    borderRadius: 10,
    backgroundColor: '#2d2d2d',
    flexGrow: 0,
    flexShrink: 0,
  },
  providerLogoPlaceholder: {
    width: PROFILE_PROVIDER_CELL_ICON_PX,
    height: PROFILE_PROVIDER_CELL_ICON_PX,
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
  profileSaveModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  profileSaveModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    paddingVertical: 26,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  profileSaveModalTitle: {
    color: '#f9fafb',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  profileSaveModalBody: {
    color: '#9ca3af',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },
  profileSaveModalOk: {
    alignSelf: 'stretch',
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  profileSaveModalOkFocused: {
    borderColor: '#ffffff',
    borderWidth: 3,
  },
  profileSaveModalOkPressing: {
    opacity: 0.88,
  },
  profileSaveModalOkText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

/** Single focus target for TV save/error overlay — **`hasTVPreferredFocus`** lands D-pad on OK immediately. */
function ProfileSaveModalOkButton({ onPress }: { onPress: () => void }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      {...tvPreferredFocusProps()}
      focusable
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={({ pressed }) => [
        styles.profileSaveModalOk,
        isFocused && styles.profileSaveModalOkFocused,
        pressed && styles.profileSaveModalOkPressing,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="OK"
    >
      <Text style={styles.profileSaveModalOkText}>OK</Text>
    </Pressable>
  );
}

type SavePreferencesButtonProps = {
  onPress: () => void;
  /** When true, omit bottom margin — used by the pinned Profile save strip. */
  stickyBar?: boolean;
};

function SavePreferencesButton({ onPress, stickyBar }: SavePreferencesButtonProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={({ pressed }) => [
        styles.savePreferencesButton,
        stickyBar && styles.savePreferencesButtonStickyStrip,
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

function providerCardPropsAreEqual(
  prev: Readonly<ProviderCardProps>,
  next: Readonly<ProviderCardProps>
): boolean {
  return (
    normalizeProviderId(prev.item.id) === normalizeProviderId(next.item.id) &&
    prev.isSelected === next.isSelected &&
    prev.item.logo_url === next.item.logo_url
  );
}

const ProviderCard = memo(function ProviderCard({
  item,
  isSelected,
  onPress,
}: ProviderCardProps) {
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
        <Image source={{ uri: item.logo_url }} style={styles.providerLogo} />
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
