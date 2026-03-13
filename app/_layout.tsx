import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CountryProvider } from '../lib/country-context';
import { SearchProvider } from '../lib/search-context';
import { WatchlistStatusProvider } from '../lib/watchlist-status-context';

export default function RootLayout() {
  return (
    <SearchProvider>
      <CountryProvider>
        <WatchlistStatusProvider>
          <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0f0f0f' },
          }}
        />
        </WatchlistStatusProvider>
      </CountryProvider>
    </SearchProvider>
  );
}
