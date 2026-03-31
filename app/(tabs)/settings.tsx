import { useEffect, useState, useCallback } from 'react';
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
