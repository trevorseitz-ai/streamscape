import { useState } from 'react';
import { PlatformPressable } from '@react-navigation/elements';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { getTVFocusRingStyle } from '../hooks/useTVFocus';
import { isTvTarget, shouldUseTvDpadFocus } from '../lib/isTv';

const TV_TAB_INSET = 3;

/**
 * Tab bar control with TV focus ring (Netflix-style sidebar).
 */
export function TvTabBarButton(props: BottomTabBarButtonProps) {
  const [focused, setFocused] = useState(false);
  const showRing = shouldUseTvDpadFocus() || isTvTarget();

  const isTV = isTvTarget();

  return (
    <PlatformPressable
      {...props}
      focusable
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[
        props.style,
        isTV && { marginHorizontal: TV_TAB_INSET },
        showRing ? getTVFocusRingStyle(focused) : {},
      ]}
    />
  );
}
