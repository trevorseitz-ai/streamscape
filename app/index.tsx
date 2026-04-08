import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function LandingScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/(tabs)');
      } else {
        setChecking(false);
      }
    });
  }, []);

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.iconRow}>
          <Ionicons name="film-outline" size={28} color="#6366f1" />
          <Text style={styles.brand}>ReelDive</Text>
        </View>

        <Text style={styles.headline}>
          Stop Scrolling.{'\n'}Start Streaming.
        </Text>

        <Text style={styles.subheadline}>
          Filter by your actual subscriptions. Discover hidden gems rated by
          real viewers. Build the ultimate watchlist.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && styles.ctaPressed,
          ]}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.ctaText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color="#ffffff" />
        </Pressable>

        <Pressable
          style={styles.secondaryLink}
          onPress={() => Linking.openURL('https://getreeldive.com')}
        >
          <Text style={styles.secondaryText}>
            Want to join the beta?{' '}
            <Text style={styles.secondaryBold}>Join the Waitlist</Text>
          </Text>
        </Pressable>
      </View>

      <View style={styles.features}>
        <View style={styles.featureRow}>
          <Ionicons name="search" size={20} color="#a5b4fc" />
          <Text style={styles.featureText}>
            Search any movie instantly
          </Text>
        </View>
        <View style={styles.featureRow}>
          <Ionicons name="compass-outline" size={20} color="#a5b4fc" />
          <Text style={styles.featureText}>
            Discover by year, genre, and rating
          </Text>
        </View>
        <View style={styles.featureRow}>
          <Ionicons name="tv-outline" size={20} color="#a5b4fc" />
          <Text style={styles.featureText}>
            See only what's on your services
          </Text>
        </View>
        <View style={styles.featureRow}>
          <Ionicons name="list" size={20} color="#a5b4fc" />
          <Text style={styles.featureText}>
            Rank and reorder your watchlist
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by TMDB</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  hero: {
    alignItems: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
  },
  brand: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headline: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 44,
    marginBottom: 16,
  },
  subheadline: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
    marginBottom: 36,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 14,
    gap: 10,
  },
  ctaPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryLink: {
    marginTop: 20,
  },
  secondaryText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  secondaryBold: {
    color: '#6366f1',
    fontWeight: '600',
  },
  features: {
    marginTop: 56,
    gap: 16,
    paddingHorizontal: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureText: {
    color: '#d1d5db',
    fontSize: 15,
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    color: '#4b5563',
    fontSize: 12,
  },
});
