import { useCallback, useMemo, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { isTvTarget, shouldUseTvDpadFocus } from '../lib/isTv';

/**
 * Focus ring for D-pad / TV remote: scale + white border + shadow (see product spec).
 */
export function getTVFocusRingStyle(focused: boolean): ViewStyle {
  if (!focused) {
    return {};
  }
  return {
    transform: [{ scale: 1.1 }],
    borderColor: '#FFFFFF',
    borderWidth: 3,
    shadowOpacity: 0.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 12,
  };
}

/**
 * Tracks focus for a single focusable (e.g. movie poster) and returns merged ring styles on TV.
 */
export function useTVFocusRing() {
  const enabled = shouldUseTvDpadFocus() || isTvTarget();
  const [focused, setFocused] = useState(false);

  const ringStyle = useMemo(
    () => (enabled ? getTVFocusRingStyle(focused) : {}),
    [enabled, focused]
  );

  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);

  return { enabled, focused, onFocus, onBlur, ringStyle };
}
