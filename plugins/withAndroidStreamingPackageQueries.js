/**
 * Android 11+ package visibility: declare streaming apps we query / launch into.
 * Merges a <queries> block into the main manifest on prebuild.
 *
 * Keep in lockstep with STREAMING_PROVIDER_ANDROID_MATRIX + fallbacks in lib/linking-utils.ts
 * (Sony Bravia physical device ids).
 *
 * @param {import('@expo/config-plugins').ExpoConfig} config
 */
const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Exact package names used by TV intents — include primaries and every matrix fallback.
 * Sony Bravia: **com.netflix.ninja** and **com.hulu.livingroomplus** must remain listed here
 * (Android 11+ visibility / “intent kill”).
 */
const STREAMING_QUERY_PACKAGES = [
  'com.netflix.ninja',
  'com.netflix.mediaclient',
  'com.amazon.amazonvideo.livingroom',
  'com.disney.disneyplus',
  'com.hulu.livingroomplus',
  'com.hulu.livingroom',
  'com.apple.atve.sony.appletv',
  'com.apple.atve.sony.trusted',
  'com.wbd.stream',
  'com.cbs.ott',
  'com.peacocktv.peacockandroid',
  'com.crunchyroll.crunchyroid',
  'com.amcup.android',
  'com.shudder.android',
  'com.criterionchannel',
  'com.mubi',
  'com.epix.epix.now',
  'com.discovery.discoveryplus.mobile',
  'com.fubo.android',
];

/**
 * @param {import('@expo/config-plugins/build/android/Manifest').AndroidManifest} androidManifest
 */
function ensureStreamingPackageQueries(androidManifest) {
  const root = androidManifest.manifest;
  if (!root.queries) {
    root.queries = [];
  }
  let blocks = root.queries;
  if (!Array.isArray(blocks)) {
    root.queries = [blocks];
    blocks = root.queries;
  }

  let block = blocks[0];
  if (!block || typeof block !== 'object') {
    block = {};
    blocks[0] = block;
  }

  if (!block.package) {
    block.package = [];
  }
  let pkgs = block.package;
  if (!Array.isArray(pkgs)) {
    block.package = [pkgs];
    pkgs = block.package;
  }

  const seen = new Set(
    pkgs.map((p) => (p && p.$ ? p.$['android:name'] : undefined)).filter(Boolean)
  );

  for (const name of STREAMING_QUERY_PACKAGES) {
    if (seen.has(name)) continue;
    seen.add(name);
    pkgs.push({ $: { 'android:name': name } });
  }
}

module.exports = function withAndroidStreamingPackageQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    ensureStreamingPackageQueries(cfg.modResults);
    return cfg;
  });
};
