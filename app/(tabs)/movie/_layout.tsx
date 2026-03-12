import { Stack } from 'expo-router';
import { MovieProvider } from '../../../lib/movie-context';

export default function MovieLayout() {
  return (
    <MovieProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </MovieProvider>
  );
}
