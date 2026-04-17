import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { isTvTarget, shouldUseTvDpadFocus } from '../lib/isTv';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Groups TV focus: keeps a stable native hierarchy (`collapsable={false}`) and optional
 * `focusable` root for leanback (Android TV / Fire TV).
 */
export function TvFocusGuideView({ children, style }: Props) {
  const tv = shouldUseTvDpadFocus() || isTvTarget();

  if (!tv) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View
      collapsable={false}
      focusable={Platform.OS === 'android'}
      style={[styles.guide, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  guide: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
});
