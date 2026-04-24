import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Android TV / Apple TV at runtime, or TV-targeted native build (extra.isTV from app.config).
 *
 * **Web (including production in the browser) must never be treated as TV** — not via
 * `Platform.isTV`, not via `expoConfig.extra.isTV` from env, and not via simulated UA.
 */
export function isTvTarget(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.isTV) return true;
  const extra = Constants.expoConfig?.extra as { isTV?: boolean } | undefined;
  return extra?.isTV === true;
}

/**
 * Whether to enable D-pad / remote focus (`focusable` on controls, custom tab bar button).
 *
 * `Platform.isTV` is false for many **phone APK** builds running on a TV emulator (uiMode stays
 * `normal`). In that case set **`EXPO_PUBLIC_TV_FOCUS=1`** in `.env` and restart Metro so the
 * remote can move focus between buttons.
 */
export function shouldUseTvDpadFocus(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.isTV) return true;

  const extra = Constants.expoConfig?.extra as { isTV?: boolean } | undefined;
  if (extra?.isTV === true) return true;

  if (process.env.EXPO_PUBLIC_TV_FOCUS === '1') return true;

  if (Platform.OS === 'android') {
    try {
      const uiMode = (Platform.constants as { uiMode?: string }).uiMode;
      if (uiMode === 'tv') return true;
    } catch {
      /* ignore */
    }
  }

  return false;
}
