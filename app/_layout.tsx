/**
 * Initial route is `app/index.tsx`. Unauthenticated `Platform.isTV` users are redirected there to
 * `/login` (see app/index.tsx) instead of the phone marketing screen.
 *
 * Session-based redirects belong in screens via `useEffect` (see `app/index.tsx`, `discover.tsx`) —
 * this root layout intentionally does **not** call `router.replace` during render.
 */
import { useEffect } from 'react';
import { LogBox, Platform, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { lockAsync as lockScreenOrientation, OrientationLock } from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CountryProvider } from '../lib/country-context';
import { isTvTarget } from '../lib/isTv';
import { SearchProvider } from '../lib/search-context';
import { WatchlistStatusProvider } from '../lib/watchlist-status-context';
import { RootErrorBoundary } from '../components/RootErrorBoundary';
import { TvSearchFocusProvider } from '../lib/tv-search-focus-context';

const ROOT_BG_PHONE = '#0f0f0f';
const ROOT_BG_TV = '#121212';

if (__DEV__) {
  // expo-keep-awake is pulled in by the Expo dev client (keeps the screen on
  // during development). On Android TV the keep-screen-on flag is not always
  // grantable, so `ExpoKeepAwake.activate` rejects. It is harmless and absent
  // from production builds — silence the intrusive LogBox overlay that is hard
  // to dismiss with a remote on the 10-foot UI.
  LogBox.ignoreLogs([
    /ExpoKeepAwake\.activate/,
    /Activating keep awake failed/,
    /keep awake/i,
  ]);
}

export default function RootLayout() {
  const isTV = isTvTarget();
  const rootBg = isTV ? ROOT_BG_TV : ROOT_BG_PHONE;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    lockScreenOrientation(OrientationLock.LANDSCAPE).catch((e) =>
      console.warn('[ScreenOrientation] lock LANDSCAPE failed', e)
    );
  }, []);

  useEffect(() => {
    // Hide after two animation frames so layout has committed (avoids blank after splash).
    // Avoids deprecated InteractionManager.runAfterInteractions (RN 0.83+).
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        console.log('[SplashScreen] calling hideAsync()');
        SplashScreen.hideAsync()
          .then(() => console.log('[SplashScreen] hideAsync() finished'))
          .catch((e) => console.warn('[SplashScreen] hideAsync() failed', e));
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <View style={[styles.root, { backgroundColor: rootBg }]}>
        <RootErrorBoundary>
          <SearchProvider>
            <CountryProvider>
              <WatchlistStatusProvider>
                <TvSearchFocusProvider>
                  <StatusBar style="light" hidden={isTV} />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: {
                        backgroundColor: rootBg,
                        flex: 1,
                        width: '100%',
                        alignSelf: 'stretch',
                      },
                    }}
                  />
                </TvSearchFocusProvider>
              </WatchlistStatusProvider>
            </CountryProvider>
          </SearchProvider>
        </RootErrorBoundary>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
