import { Stack } from 'expo-router';
import { MovieProvider } from '../../lib/movie-context';

export default function MovieLayout() {
  return (
    <MovieProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="[id]"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: '#0f0f0f' },
            headerTintColor: '#ffffff',
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </MovieProvider>
  );
}
