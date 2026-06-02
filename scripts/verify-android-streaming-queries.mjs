#!/usr/bin/env node
/**
 * Gate: after `expo prebuild`, ensure streaming <queries> merged into the main manifest.
 * Fails if android/ is missing or Bravia-critical packages are absent from XML.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const manifestPath = path.join(
  process.cwd(),
  'android',
  'app',
  'src',
  'main',
  'AndroidManifest.xml'
);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  fail(
    `[verify-android-streaming-queries] Missing ${manifestPath}\nRun: npx expo prebuild --platform android`
  );
}

const xml = fs.readFileSync(manifestPath, 'utf8');
if (!xml.includes('<queries')) {
  fail(
    '[verify-android-streaming-queries] No <queries> element in manifest — streaming plugin may not have run.'
  );
}

const requiredPackages = ['com.netflix.ninja', 'com.hulu.livingroomplus'];
for (const pkg of requiredPackages) {
  if (!xml.includes(`android:name="${pkg}"`) && !xml.includes(`android:name='${pkg}'`)) {
    fail(
      `[verify-android-streaming-queries] Missing <package android:name="${pkg}" /> in manifest — check plugins/withAndroidStreamingPackageQueries.js`
    );
  }
}

console.log(
  `[verify-android-streaming-queries] OK — <queries> present; checked ${requiredPackages.join(', ')}`
);
