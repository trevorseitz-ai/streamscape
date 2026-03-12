import { Stack } from 'expo-router';
import { MovieProvider } from '../../../lib/movie-context';
import { HeaderRight } from '../../../components/HeaderRight';
import { MovieHeaderTitle } from '../../../components/MovieHeaderTitle';

export default function MovieLayout() {
  return (
    <MovieProvider>
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: '#0f0f0f' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '600' },
          headerTitleAlign: 'left',
          headerShadowVisible: false,
          headerTitle: () => <MovieHeaderTitle />,
          headerRight: () => (
            <HeaderRight routeName="movie" compact />
          ),
        }}
      />
    </MovieProvider>
  );
}
