/**
 * Dev-only auth bypass for Maestro / local E2E on TV.
 * Enable with EXPO_PUBLIC_MAESTRO_BYPASS_AUTH=1 in .env and restart Metro.
 * Never active in production builds (__DEV__ gate).
 */
export function isMaestroAuthBypassEnabled(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_MAESTRO_BYPASS_AUTH === '1';
}
