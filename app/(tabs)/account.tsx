import { View, StyleSheet } from 'react-native';

/**
 * Account tab: TV sidebar uses this route for focus/selection; Login/Logout actions
 * are handled in TvSidebarTabBar (same physical slot).
 */
export default function AccountTabScreen() {
  return <View style={styles.fill} />;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
});
