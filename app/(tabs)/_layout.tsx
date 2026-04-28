import { View } from 'react-native';
import { Tabs } from 'expo-router';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import { TvSidebarTabBar, TV_SIDEBAR_WIDTH } from '../../components/TvSidebarTabBar';
import { TvFocusGuideView } from '../../components/TvFocusGuideView';
import { isTvTarget, shouldUseTvDpadFocus } from '../../lib/isTv';

function getTabIcon(routeName: string, focused: boolean) {
  const iconMap: Record<
    string,
    { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
  > = {
    index: { active: 'home', inactive: 'home-outline' },
    search: { active: 'search', inactive: 'search-outline' },
    watchlist: { active: 'list', inactive: 'list-outline' },
    library: { active: 'library', inactive: 'library-outline' },
    profile: { active: 'person', inactive: 'person-outline' },
    discover: { active: 'compass', inactive: 'compass-outline' },
    account: { active: 'person-circle', inactive: 'person-circle-outline' },
  };
  const icons = iconMap[routeName];
  const name = icons ? (focused ? icons.active : icons.inactive) : 'ellipse-outline';
  return name;
}

export default function TabLayout() {
  const isTV = isTvTarget();
  const tvDpad = shouldUseTvDpadFocus();

  const tabs = (
    <Tabs
      tabBar={isTV ? (props) => <TvSidebarTabBar {...props} /> : undefined}
      screenOptions={({ route }) => ({
        /** Navigator default — hide React Navigation header for every tab (TV uses `TvSidebarTabBar`). */
        headerShown: false,
        ...(isTV
          ? {
              tabBarPosition: 'left',
              tabBarStyle: {
                width: TV_SIDEBAR_WIDTH,
                minWidth: TV_SIDEBAR_WIDTH,
                maxWidth: TV_SIDEBAR_WIDTH,
                flexGrow: 0,
                flexShrink: 0,
                margin: 0,
                marginLeft: 0,
                marginRight: 0,
                padding: 0,
                paddingHorizontal: 0,
                paddingVertical: 0,
                gap: 0,
                borderWidth: 0,
                elevation: 0,
              },
              sceneStyle: {
                flex: 1,
                flexGrow: 1,
                flexShrink: 1,
                width: '100%',
                minWidth: 0,
                alignSelf: 'stretch',
                margin: 0,
                marginLeft: 0,
                marginRight: 0,
                padding: 0,
                paddingLeft: 0,
                paddingRight: 0,
              },
            }
          : {
              tabBarStyle: {
                backgroundColor: '#0f0f0f',
                borderTopColor: '#2d2d2d',
              },
              tabBarItemStyle: {
                alignItems: 'center',
                justifyContent: 'center',
              },
            }),
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#6b7280',
        tabBarIcon: isTV
          ? () => null
          : ({ color, size, focused }) => (
              <Ionicons
                name={getTabIcon(route.name, focused)}
                size={size}
                color={color}
              />
            ),
        ...(!isTV
          ? {
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: '500',
              },
            }
          : {}),
        ...(!isTV && tvDpad
          ? {
              tabBarButton: (props: BottomTabBarButtonProps) => (
                <PlatformPressable {...props} focusable />
              ),
            }
          : {}),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false }} />
      <Tabs.Screen name="search" options={{ title: 'Search', headerShown: false }} />
      <Tabs.Screen name="watchlist" options={{ title: 'My Watchlist', headerShown: false }} />
      <Tabs.Screen name="library" options={{ title: 'Library', headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', headerShown: false }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', headerShown: false }} />
      <Tabs.Screen name="account" options={{ title: 'Account', headerShown: false }} />
    </Tabs>
  );

  return isTV ? (
    <TvFocusGuideView
      style={{
        flex: 1,
        width: '100%',
        minWidth: 0,
        flexDirection: 'row',
        gap: 0,
        margin: 0,
        padding: 0,
        alignItems: 'stretch',
        justifyContent: 'flex-start',
      }}
    >
      {/** Single flex child so the navigator fills width (avoids intrinsic-width gap). */}
      <View style={{ flex: 1, minWidth: 0, margin: 0, padding: 0 }}>{tabs}</View>
    </TvFocusGuideView>
  ) : (
    tabs
  );
}
