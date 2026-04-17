/**
 * Android TV launcher: LEANBACK_LAUNCHER, optional leanback/touchscreen features,
 * and TV banner drawable for the home screen row.
 *
 * @param {import('@expo/config-plugins').ExpoConfig} config
 */
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const {
  getMainActivityOrThrow,
  getMainApplicationOrThrow,
} = require('@expo/config-plugins/build/android/Manifest');

/**
 * @param {import('@expo/config-plugins/build/android/Manifest').AndroidManifest} androidManifest
 * @param {string} name
 */
function ensureUsesFeature(androidManifest, name) {
  const root = androidManifest.manifest;
  let list = root['uses-feature'];
  if (!list) {
    root['uses-feature'] = [];
  } else if (!Array.isArray(list)) {
    root['uses-feature'] = [list];
  }
  list = root['uses-feature'];
  const exists = list.some((f) => f.$['android:name'] === name);
  if (!exists) {
    list.push({ $: { 'android:name': name, 'android:required': 'false' } });
  }
}

/**
 * @param {import('@expo/config-plugins/build/android/Manifest').AndroidManifest} androidManifest
 */
function addLeanbackLauncher(androidManifest) {
  const mainActivity = getMainActivityOrThrow(androidManifest);
  const filters = mainActivity['intent-filter'];
  if (!Array.isArray(filters)) {
    return androidManifest;
  }
  for (const filter of filters) {
    const hasMain = filter.action?.some(
      (a) => a.$['android:name'] === 'android.intent.action.MAIN'
    );
    const hasLauncher = filter.category?.some(
      (c) => c.$['android:name'] === 'android.intent.category.LAUNCHER'
    );
    if (hasMain && hasLauncher) {
      const categories = filter.category || (filter.category = []);
      const hasLeanback = categories.some(
        (c) => c.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER'
      );
      if (!hasLeanback) {
        categories.push({
          $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' },
        });
      }
      break;
    }
  }
  return androidManifest;
}

module.exports = function withAndroidTvLauncher(config) {
  const relBanner =
    (config.android && typeof config.android.banner === 'string' && config.android.banner) ||
    './assets/tv-banner.png';

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const bannerSrc = path.resolve(projectRoot, relBanner.replace(/^\.\//, ''));
      const root = cfg.modRequest.platformProjectRoot;
      const destDir = path.join(root, 'app', 'src', 'main', 'res', 'drawable');
      fs.mkdirSync(destDir, { recursive: true });
      if (fs.existsSync(bannerSrc)) {
        fs.copyFileSync(bannerSrc, path.join(destDir, 'banner.png'));
      }
      return cfg;
    },
  ]);

  config = withAndroidManifest(config, (cfg) => {
    const androidManifest = cfg.modResults;
    const projectRoot = cfg.modRequest.projectRoot;
    const bannerSrc = path.resolve(projectRoot, relBanner.replace(/^\.\//, ''));

    ensureUsesFeature(androidManifest, 'android.software.leanback');
    ensureUsesFeature(androidManifest, 'android.hardware.touchscreen');
    addLeanbackLauncher(androidManifest);

    if (fs.existsSync(bannerSrc)) {
      const app = getMainApplicationOrThrow(androidManifest);
      if (!app.$) app.$ = {};
      app.$['android:banner'] = '@drawable/banner';
    }

    return cfg;
  });

  return config;
};
