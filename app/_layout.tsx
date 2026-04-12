import { useEffect } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { CountryProvider } from '../lib/country-context';
import { isTvTarget } from '../lib/isTv';
import { SearchProvider } from '../lib/search-context';
import { WatchlistStatusProvider } from '../lib/watchlist-status-context';

void SplashScreen.preventAutoHideAsync();

const ROOT_BG_PHONE = '#0f0f0f';
const ROOT_BG_TV = '#121212';

export default function RootLayout() {
  const isTV = isTvTarget();
  const { width: windowWidth } = Dimensions.get('window');
  const rootBg = isTV ? ROOT_BG_TV : ROOT_BG_PHONE;

  useEffect(() => {
    console.log('[SplashScreen] calling hideAsync()');
    SplashScreen.hideAsync()
      .then(() => console.log('[SplashScreen] hideAsync() finished'))
      .catch((e) => console.warn('[SplashScreen] hideAsync() failed', e));
  }, []);

  return (
    <View
      style={[
        styles.root,
        isTV && { width: windowWidth, alignSelf: 'stretch' },
        { backgroundColor: rootBg },
      ]}
    >
      <SearchProvider>
        <CountryProvider>
          <WatchlistStatusProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: rootBg, flex: 1 },
              }}
            />
          </WatchlistStatusProvider>
        </CountryProvider>
      </SearchProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...(Platform.OS === 'web' ? {} : { maxWidth: '100%' }),
  },
});
