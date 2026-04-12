import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Android TV / Apple TV at runtime, or TV-targeted native build (extra.isTV from app.config).
 */
export function isTvTarget(): boolean {
  if (Platform.isTV) return true;
  const extra = Constants.expoConfig?.extra as { isTV?: boolean } | undefined;
  return extra?.isTV === true;
}
