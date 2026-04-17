import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { isTvTarget } from '../lib/isTv';
import { tvFocusable } from '../lib/tvFocus';

export default function LandingScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const isTV = isTvTarget();
  const { width, height } = useWindowDimensions();

  const tvOverscan = useMemo(() => {
    if (!isTV) return { x: 0, y: 0 };
    const y = Math.max(48, Math.min(88, height * 0.07));
    const x = Math.max(40, Math.min(120, width * 0.08));
    return { x, y };
  }, [isTV, width, height]);

  useEffect(() => {
    let cancelled = false;
    const timeoutMs = 8000;
    const t = setTimeout(() => {
      if (cancelled) return;
      if (Platform.isTV) {
        router.replace('/tv-landing');
      } else {
        setChecking(false);
        if (__DEV__) {
          console.warn(
            '[Landing] Session check timed out — network or Supabase may be unreachable. You can open Network diagnostics from the dev link below.'
          );
        }
      }
    }, timeoutMs);

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        clearTimeout(t);
        if (session) {
          router.replace('/(tabs)');
        } else if (Platform.isTV) {
          router.replace('/tv-landing');
        } else {
          setChecking(false);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        clearTimeout(t);
        if (__DEV__) console.warn('[Landing] getSession failed', e);
        if (Platform.isTV) {
          router.replace('/tv-landing');
        } else {
          setChecking(false);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [router]);

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const heroBlock = (
    <View style={[styles.hero, isTV && styles.heroTv]}>
      <View style={styles.iconRow}>
        <Ionicons name="film-outline" size={isTV ? 32 : 28} color="#6366f1" />
        <Text style={[styles.brand, isTV && styles.brandTv]}>ReelDive</Text>
      </View>

      <Text style={[styles.headline, isTV && styles.headlineTv]}>
        Stop Scrolling.{'\n'}Start Streaming.
      </Text>

      <Text style={[styles.subheadline, isTV && styles.subheadlineTv]}>
        Filter by your actual subscriptions. Discover hidden gems rated by real
        viewers. Build the ultimate watchlist.
      </Text>

      <Pressable
        {...tvFocusable()}
        style={({ pressed }) => [
          styles.ctaButton,
          isTV && styles.ctaButtonTv,
          pressed && styles.ctaPressed,
        ]}
        onPress={() => router.push('/login')}
      >
        <Text style={[styles.ctaText, isTV && styles.ctaTextTv]}>Get Started</Text>
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
  );

  const featuresBlock = (
    <View style={[styles.features, isTV && styles.featuresTv]}>
      <View style={styles.featureRow}>
        <Ionicons name="search" size={20} color="#a5b4fc" />
        <Text style={[styles.featureText, isTV && styles.featureTextTv]}>
          Search any movie instantly
        </Text>
      </View>
      <View style={styles.featureRow}>
        <Ionicons name="compass-outline" size={20} color="#a5b4fc" />
        <Text style={[styles.featureText, isTV && styles.featureTextTv]}>
          Discover by year, genre, and rating
        </Text>
      </View>
      <View style={styles.featureRow}>
        <Ionicons name="tv-outline" size={20} color="#a5b4fc" />
        <Text style={[styles.featureText, isTV && styles.featureTextTv]}>
          See only what's on your services
        </Text>
      </View>
      <View style={styles.featureRow}>
        <Ionicons name="list" size={20} color="#a5b4fc" />
        <Text style={[styles.featureText, isTV && styles.featureTextTv]}>
          Rank and reorder your watchlist
        </Text>
      </View>
    </View>
  );

  const footerBlock = (
    <View style={isTV ? styles.footerFlow : styles.footer}>
      <Text style={styles.footerText}>Powered by TMDB</Text>
      {__DEV__ ? (
        <Pressable
          {...tvFocusable()}
          style={({ pressed }) => [styles.devDiagLink, pressed && styles.devDiagLinkPressed]}
          onPress={() => router.push('/dev/network-diag')}
        >
          <Text style={styles.devDiagLinkText}>Network diagnostics (dev)</Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (isTV) {
    return (
      <ScrollView
        style={styles.scrollRoot}
        contentContainerStyle={[
          styles.scrollContentTv,
          {
            paddingTop: tvOverscan.y,
            paddingBottom: tvOverscan.y + 32,
            paddingHorizontal: tvOverscan.x,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {heroBlock}
        {featuresBlock}
        {footerBlock}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {heroBlock}
      {featuresBlock}
      {footerBlock}
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
  scrollRoot: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  scrollContentTv: {
    flexGrow: 1,
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
  heroTv: {
    alignItems: 'center',
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
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
  brandTv: {
    fontSize: 26,
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
  headlineTv: {
    fontSize: 42,
    lineHeight: 50,
    maxWidth: '100%',
  },
  subheadline: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
    marginBottom: 36,
  },
  subheadlineTv: {
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 560,
    marginBottom: 28,
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
  ctaButtonTv: {
    paddingVertical: 18,
    paddingHorizontal: 44,
    minHeight: 56,
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
  ctaTextTv: {
    fontSize: 20,
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
  featuresTv: {
    marginTop: 40,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
    paddingHorizontal: 0,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureText: {
    color: '#d1d5db',
    fontSize: 15,
    flex: 1,
  },
  featureTextTv: {
    fontSize: 18,
    lineHeight: 26,
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerFlow: {
    marginTop: 40,
    alignItems: 'center',
    paddingBottom: 8,
  },
  devDiagLink: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignSelf: 'center',
  },
  devDiagLinkPressed: {
    opacity: 0.7,
  },
  devDiagLinkText: {
    fontSize: 13,
    color: '#818cf8',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footerText: {
    color: '#4b5563',
    fontSize: 12,
  },
});
