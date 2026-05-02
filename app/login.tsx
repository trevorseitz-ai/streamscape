import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ScrollView,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { isTvTarget, shouldUseTvDpadFocus } from '../lib/isTv';

const TV_FOCUS_PRIMARY = '#6200EE';

/** Brand hero (`assets/`). Swap in final Sonar reel artwork — placeholder may mirror `tv-banner`. */
const LOGIN_HERO_MARK = require('../assets/reeldive-sonar-reel-hero-mark.png');

type TvFocusPressableProps = Omit<React.ComponentProps<typeof Pressable>, 'style' | 'children'> & {
  useTvOutline: boolean;
  style?: StyleProp<ViewStyle>;
  focusedStyle: ViewStyle;
  children: React.ReactNode;
};

function TvFocusPressable({
  useTvOutline,
  style,
  focusedStyle,
  children,
  onFocus,
  onBlur,
  ...rest
}: TvFocusPressableProps) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      {...rest}
      focusable={useTvOutline ? true : undefined}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[style, useTvOutline && focused && focusedStyle]}
    >
      {children}
    </Pressable>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useTvOutline = Platform.OS !== 'web' && (isTvTarget() || shouldUseTvDpadFocus());

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View
            style={styles.headerBlock}
            testID="maestro-login-header"
            accessibilityRole="header"
            accessibilityLabel="Welcome back to ReelDive"
          >
            <Image
              source={LOGIN_HERO_MARK}
              style={styles.heroMark}
              resizeMode="contain"
              {...(Platform.OS === 'android'
                ? ({
                    accessibilityElementsHidden: true,
                    importantForAccessibility: 'no-hide-descendants',
                  } as const)
                : {})}
            />
          </View>
          <Text style={styles.subtitle}>Sign in to your ReelDive account</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#6b7280"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            testID="maestro-login-email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#6b7280"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            testID="maestro-login-password"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TvFocusPressable
            testID="maestro-login-submit"
            useTvOutline={useTvOutline}
            style={[styles.button, loading && styles.buttonDisabled]}
            focusedStyle={styles.buttonTvFocused}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Log in</Text>
            )}
          </TvFocusPressable>
          <TvFocusPressable
            testID="maestro-login-signup"
            useTvOutline={useTvOutline}
            style={styles.link}
            focusedStyle={styles.linkTvFocused}
            onPress={() => Linking.openURL('https://getreeldive.com')}
          >
            <Text style={styles.linkText}>
              Want to join the beta? <Text style={styles.linkBold}>Join the Waitlist</Text>
            </Text>
          </TvFocusPressable>

          <TvFocusPressable
            useTvOutline={useTvOutline}
            style={styles.back}
            focusedStyle={styles.backTvFocused}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>← Back</Text>
          </TvFocusPressable>

          {__DEV__ ? (
            <TvFocusPressable
              useTvOutline={useTvOutline}
              style={styles.devDiagLink}
              focusedStyle={styles.devDiagTvFocused}
              onPress={() => router.push('/dev/network-diag')}
            >
              <Text style={styles.devDiagLinkText}>Network diagnostics (dev)</Text>
            </TvFocusPressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 32,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  heroMark: {
    width: '88%',
    maxWidth: 360,
    height: 96,
    alignSelf: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 8,
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2d2d2d',
    marginBottom: 16,
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  buttonTvFocused: {
    borderColor: TV_FOCUS_PRIMARY,
    transform: [{ scale: 1.05 }],
    shadowColor: '#6200EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    marginTop: 24,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 3,
    borderColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignSelf: 'center',
  },
  linkTvFocused: {
    borderColor: TV_FOCUS_PRIMARY,
    transform: [{ scale: 1.05 }],
    shadowColor: '#6200EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 20,
  },
  linkText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  linkBold: {
    color: '#6366f1',
    fontWeight: '600',
  },
  back: {
    marginTop: 32,
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 3,
    borderColor: 'transparent',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backTvFocused: {
    borderColor: TV_FOCUS_PRIMARY,
    transform: [{ scale: 1.05 }],
  },
  backText: {
    color: '#6b7280',
    fontSize: 14,
  },
  devDiagLink: {
    marginTop: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: 'transparent',
    alignSelf: 'flex-start',
  },
  devDiagTvFocused: {
    borderColor: TV_FOCUS_PRIMARY,
    transform: [{ scale: 1.05 }],
  },
  devDiagLinkText: {
    fontSize: 13,
    color: '#818cf8',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
