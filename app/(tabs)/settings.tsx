import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import {
  getSavedProviderIds,
  saveProviderIds,
} from '../../lib/provider-preferences';

interface ProviderEntry {
  id: number;
  name: string;
  logo_url: string | null;
}

export default function SettingsScreen() {
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const savedIds = await getSavedProviderIds();
        setSelectedIds(new Set(savedIds));

        const baseUrl =
          Platform.OS === 'web'
            ? typeof window !== 'undefined'
              ? window.location.origin
              : ''
            : process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8081';

        const res = await fetch(`${baseUrl}/api/providers`);
        const data = await res.json();

        if (res.ok && data.providers) {
          setProviders(data.providers);
        } else {
          setFetchError(data.error ?? 'Failed to load providers');
        }
      } catch (err) {
        setFetchError(
          err instanceof Error ? err.message : 'Failed to load providers'
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const handleToggle = useCallback(
    (providerId: number, value: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (value) {
          next.add(providerId);
        } else {
          next.delete(providerId);
        }
        saveProviderIds(Array.from(next));
        return next;
      });
    },
    []
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

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
        <Text style={styles.sectionTitle}>My Streaming Services</Text>
        <Text style={styles.sectionDescription}>
          Select the services you subscribe to. Discover results will be filtered
          to show movies available on your services.
        </Text>

        {fetchError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{fetchError}</Text>
          </View>
        ) : (
          <View style={styles.providerList}>
            {providers.map((provider) => (
              <View key={provider.id} style={styles.providerRow}>
                <View style={styles.providerInfo}>
                  {provider.logo_url ? (
                    <Image
                      source={{ uri: provider.logo_url }}
                      style={styles.providerLogo}
                    />
                  ) : (
                    <View style={styles.providerLogoPlaceholder}>
                      <Text style={styles.providerLogoPlaceholderText}>?</Text>
                    </View>
                  )}
                  <Text style={styles.providerName}>{provider.name}</Text>
                </View>
                <Switch
                  value={selectedIds.has(provider.id)}
                  onValueChange={(value) => handleToggle(provider.id, value)}
                  trackColor={{ false: '#2d2d2d', true: '#4f46e5' }}
                  thumbColor={
                    selectedIds.has(provider.id) ? '#a5b4fc' : '#6b7280'
                  }
                />
              </View>
            ))}
          </View>
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
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 40,
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
  providerList: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    overflow: 'hidden',
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d2d',
  },
  providerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#2d2d2d',
  },
  providerLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerLogoPlaceholderText: {
    fontSize: 16,
    color: '#6b7280',
  },
  providerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    flexShrink: 1,
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
