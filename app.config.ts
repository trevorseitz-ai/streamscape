import type { ExpoConfig } from '@expo/config-types';

type AndroidTvFlags = {
  isTV?: boolean;
  banner?: string;
};

/**
 * TV-only native tweaks: set EXPO_PUBLIC_TV=1 (or EXPO_TV=1) before `expo prebuild` / `expo run:android`,
 * or set `android.isTV` in app.json. Base `orientation` comes from app.json (landscape) so Android TV / wide layouts fill the screen; TV flags add leanback-style config.
 */
function isTvBuild(): boolean {
  return process.env.EXPO_PUBLIC_TV === '1' || process.env.EXPO_TV === '1';
}

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const androidFlags = config.android as AndroidTvFlags | undefined;
  const tv = isTvBuild() || androidFlags?.isTV === true;

  const basePlugins = config.plugins ?? [];

  return {
    ...config,
    plugins: [
      ...basePlugins,
      './plugins/withAndroidNetworkSecurity.js',
      './plugins/withAndroidTvLauncher.js',
    ],
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
