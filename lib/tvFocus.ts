import { shouldUseTvDpadFocus } from './isTv';

/**
 * Android TV / Google TV: directional pad only moves between views marked `focusable`.
 * If `Platform.isTV` is false (common with a non-leanback dev build), set
 * `EXPO_PUBLIC_TV_FOCUS=1` in `.env` — see `shouldUseTvDpadFocus`.
 */
export function tvFocusable(): { focusable?: boolean } {
  return shouldUseTvDpadFocus() ? { focusable: true } : {};
}

/**
 * First focus target on a screen so the remote has somewhere to land (Android TV implements this
 * prop natively on ReactViewGroup, not only on iOS).
 */
export function tvPreferredFocusProps(): {
  focusable?: boolean;
  hasTVPreferredFocus?: boolean;
} {
  if (!shouldUseTvDpadFocus()) return {};
  return { focusable: true, hasTVPreferredFocus: true };
}
