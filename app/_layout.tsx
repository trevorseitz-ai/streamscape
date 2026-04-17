/**
 * Initial route is `app/index.tsx`. Unauthenticated `Platform.isTV` users are redirected there to
 * `/tv-landing` (see app/index.tsx) instead of the phone marketing screen.
 */
import { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
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

export default function RootLayout() {
  const isTV = isTvTarget();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const rootBg = isTV ? ROOT_BG_TV : ROOT_BG_PHONE;
  const layoutReady = windowWidth > 0 && windowHeight > 0;

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
      <View
        style={[
          styles.root,
          isTV &&
            layoutReady && {
              width: windowWidth,
              minHeight: windowHeight,
              alignSelf: 'stretch',
            },
          { backgroundColor: rootBg },
        ]}
      >
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
    ...(Platform.OS === 'web' ? {} : { maxWidth: '100%' }),
  },
});
