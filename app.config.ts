import type { ExpoConfig } from '@expo/config-types';

/**
 * TV / Android TV builds: set EXPO_PUBLIC_TV=1 (or EXPO_TV=1) before `expo prebuild` / `expo run:android`.
 * Runtime on a TV device still uses Platform.isTV for layout; this flag locks landscape + TV-only experiments for native.
 */
function isTvBuild(): boolean {
  return process.env.EXPO_PUBLIC_TV === '1' || process.env.EXPO_TV === '1';
}

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const tv = isTvBuild();

  return {
    ...config,
    orientation: tv ? 'landscape' : (config.orientation ?? 'portrait'),
    backgroundColor: tv ? '#121212' : config.backgroundColor,
    android: {
      ...config.android,
      ...(tv
        ? {
            backgroundColor: '#121212',
          }
        : {}),
    },
    experiments: {
      ...config.experiments,
      ...(tv ? { supportsTVOnly: true } : {}),
    },
    extra: {
      ...(typeof config.extra === 'object' && config.extra !== null ? config.extra : {}),
      isTV: tv,
    },
  };
};
