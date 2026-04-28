import { Stack } from 'expo-router';
import { MovieProvider } from '../../lib/movie-context';
import { isTvTarget } from '../../lib/isTv';

export default function MovieLayout() {
  const isTV = isTvTarget();
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
            headerShown: !isTV,
            headerStyle: { backgroundColor: '#0f0f0f' },
            headerTintColor: '#ffffff',
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </MovieProvider>
  );
}
