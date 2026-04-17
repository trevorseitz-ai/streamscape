import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

/**
 * Origin of the Metro dev server for same-device fetches to Expo Router API routes (`app/api/*`).
 *
 * - **Emulator:** `localhost` in the bundle URL must become `10.0.2.2` (host loopback).
 * - **Physical device:** `10.0.2.2` does **not** exist — use LAN IP (`EXPO_PUBLIC_API_URL`) or
 *   `127.0.0.1` with `adb reverse tcp:8081 tcp:8081`.
 *
 * Optional: `EXPO_PUBLIC_API_URL` (no trailing slash), e.g. `http://192.168.1.10:8081`.
 */

function stripTrailingSlash(s: string): string {
  return s.replace(/\/$/, '');
}

/** Heuristic: AVD / SDK images report generic / sdk_gphone fingerprints. */
function isProbablyAndroidEmulator(): boolean {
  if (Platform.OS !== 'android') return false;
  const c = Platform.constants as {
    Fingerprint?: string;
    Model?: string;
  };
  const fp = (c.Fingerprint ?? '').toLowerCase();
  const model = (c.Model ?? '').toLowerCase();
  return (
    fp.includes('generic') ||
    fp.includes('unknown') ||
    fp.includes('sdk_gphone') ||
    fp.includes('sdk_google') ||
    fp.includes('emulator') ||
    fp.includes('ranchu') ||
    model.includes('sdk') ||
    model.includes('emulator')
  );
}

/** `hostUri` from Expo is often `192.168.x.x:8081` without a scheme. */
function originFromHostUri(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      return `${u.protocol}//${u.host}`;
    } catch {
      return null;
    }
  }
  return `http://${t.replace(/^\/+/, '')}`;
}

/**
 * Map localhost in Metro URL to a host the device can reach.
 * Emulator → 10.0.2.2. Physical → 127.0.0.1 (works with `adb reverse`; Wi‑Fi TV needs LAN IP via env).
 */
function rewriteAndroidLocalhostToDevHost(origin: string, emulator: boolean): string {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return origin;
    }
    const port = u.port || '8081';
    const devHost = emulator ? '10.0.2.2' : '127.0.0.1';
    return `${u.protocol}//${devHost}:${port}`;
  } catch {
    return origin;
  }
}

export function getMetroDevServerOrigin(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return stripTrailingSlash(fromEnv);
  }

  const emulator = isProbablyAndroidEmulator();

  const expoConfig = Constants.expoConfig as { hostUri?: string } | null | undefined;
  const fromExpoHost = originFromHostUri(expoConfig?.hostUri);
  if (fromExpoHost) {
    return Platform.OS === 'android'
      ? rewriteAndroidLocalhostToDevHost(fromExpoHost, emulator)
      : fromExpoHost;
  }

  try {
    const scriptURL = (NativeModules.SourceCode as { scriptURL?: string } | undefined)?.scriptURL;
    if (scriptURL && /^https?:\/\//i.test(scriptURL)) {
      const u = new URL(scriptURL);
      let origin = `${u.protocol}//${u.host}`;
      if (Platform.OS === 'android') {
        origin = rewriteAndroidLocalhostToDevHost(origin, emulator);
      }
      return origin;
    }
  } catch {
    // fall through
  }

  if (Platform.OS === 'android') {
    if (emulator) {
      return 'http://10.0.2.2:8081';
    }
    if (__DEV__) {
      console.warn(
        '[metroOrigin] Physical Android: set EXPO_PUBLIC_API_URL=http://<your-mac-LAN-ip>:8081 ' +
          '(or use adb reverse + http://127.0.0.1:8081). Guessing 127.0.0.1 for adb reverse.'
      );
    }
    return 'http://127.0.0.1:8081';
  }

  return 'http://localhost:8081';
}

/** Shown in dev network diagnostics — not i18n, dev-only. */
export function getMetroNetworkSetupHints(): string {
  return [
    'Physical TV on Wi‑Fi: put your Mac IP in .env — EXPO_PUBLIC_API_URL=http://192.168.x.x:8081 — then restart Metro (same IP the CLI prints).',
    'USB + adb: run npm run adb:reverse, then EXPO_PUBLIC_API_URL=http://127.0.0.1:8081 can work without Wi‑Fi routing.',
    'Allow Node/Metro through the Mac firewall on port 8081.',
    'If LAN is blocked, try: npx expo start --tunnel (slower, but works across networks).',
    'After changing app.config / network security plugins, run: npx expo prebuild --platform android && npx expo run:android',
  ].join('\n');
}
