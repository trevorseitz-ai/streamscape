/**
 * Trust system + user-installed CAs (helps corporate SSL inspection / proxy debugging).
 * Only applies to native projects after `expo prebuild` — not inside Expo Go.
 *
 * @param {import('@expo/config-plugins').ExpoConfig} config
 */
const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/** Cleartext must stay allowed: Metro serves the bundle over http:// (LAN IP or adb reverse). */
const XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

function withAndroidNetworkSecurity(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const root = config.modRequest.platformProjectRoot;
      const file = path.join(root, 'app', 'src', 'main', 'res', 'xml', 'network_security_config.xml');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, XML);
      return config;
    },
  ]);

  config = withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    if (app?.$) {
      /** Metro / LAN dev servers use http://; Supabase Cloud must stay https:// in .env. */
      app.$['android:usesCleartextTraffic'] = 'true';
      app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    }
    return config;
  });

  return config;
}

module.exports = withAndroidNetworkSecurity;
