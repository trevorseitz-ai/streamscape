#!/usr/bin/env node
/**
 * Open a URL on the connected Android device/emulator default browser — no typing on TV.
 * Usage: npm run adb:open-url -- https://www.google.com
 */
import { spawnSync } from 'node:child_process';

const url = process.argv.slice(2).join(' ') || 'https://www.google.com';
const r = spawnSync('adb', ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url], {
  stdio: 'inherit',
});
process.exit(r.status === 0 ? 0 : 1);
