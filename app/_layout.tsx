import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CountryProvider } from '../lib/country-context';
import { SearchProvider } from '../lib/search-context';

export default function RootLayout() {
  return (
    <SearchProvider>
      <CountryProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0f0f0f' },
          }}
        />
      </CountryProvider>
    </SearchProvider>
  );
}
