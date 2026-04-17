import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { PlatformPressable } from '@react-navigation/elements';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getTVFocusRingStyle } from '../hooks/useTVFocus';
import { useTvNativeTag } from '../hooks/useTvNativeTag';
import { isTvTarget, shouldUseTvDpadFocus } from '../lib/isTv';
import { supabase } from '../lib/supabase';
import { tvAndroidNavProps } from '../lib/tvAndroidNavProps';
import { useTvSearchFocusBridge } from '../lib/tv-search-focus-context';
import { TvFocusGuideView } from './TvFocusGuideView';

/** Fixed rail width (symmetric segmented column). */
export const TV_SIDEBAR_WIDTH = 160;

const RAIL_PADDING = 20;

const ACTIVE = '#6366f1';
const INACTIVE = '#6b7280';

function tvTabLabel(routeName: string): string {
  const map: Record<string, string> = {
    index: 'Home',
    discover: 'Discover',
    watchlist: 'Watchlist',
    watched: 'Watched',
    settings: 'Settings',
  };
  return map[routeName] ?? routeName;
}

function getTabIcon(
  routeName: string,
  selected: boolean
): keyof typeof Ionicons.glyphMap {
  const iconMap: Record<
    string,
    { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
  > = {
    index: { active: 'home', inactive: 'home-outline' },
    discover: { active: 'compass', inactive: 'compass-outline' },
    watchlist: { active: 'list', inactive: 'list-outline' },
    watched: { active: 'time', inactive: 'time-outline' },
    settings: { active: 'settings', inactive: 'settings-outline' },
  };
  const icons = iconMap[routeName];
  const name = icons ? (selected ? icons.active : icons.inactive) : 'ellipse-outline';
  return name;
}

const LABEL_FONT = 17;

function SegmentDivider() {
  return <View style={styles.segmentDivider} />;
}

type TabItemProps = {
  routeName: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  hasTVPreferredFocus?: boolean;
};

function TvSidebarTabItem({
  routeName,
  label,
  selected,
  onPress,
  onLongPress,
  hasTVPreferredFocus,
}: TabItemProps) {
  const [dpadFocused, setDpadFocused] = useState(false);
  const showRing = shouldUseTvDpadFocus() || isTvTarget();
  const color = selected ? ACTIVE : INACTIVE;
  const iconName = getTabIcon(routeName, selected);
  const { setRef, nativeTag } = useTvNativeTag();

  return (
    <PlatformPressable
      ref={setRef as never}
      accessibilityRole={Platform.OS === 'web' ? 'tab' : 'button'}
      accessibilityState={{ selected }}
      focusable
      onPress={onPress}
      onLongPress={onLongPress}
      onFocus={() => setDpadFocused(true)}
      onBlur={() => setDpadFocused(false)}
      style={[
        styles.itemPressable,
        showRing ? getTVFocusRingStyle(dpadFocused) : {},
      ]}
      {...tvAndroidNavProps({
        nextFocusLeftSelf: nativeTag,
        hasTVPreferredFocus,
      })}
    >
      <Ionicons name={iconName} size={28} color={color} />
      <SegmentDivider />
      <Text style={[styles.label, { color }]} numberOfLines={2}>
        {label}
      </Text>
    </PlatformPressable>
  );
}

function TvSidebarSearchItem({
  onPress,
  searchFieldNativeTag,
  setSearchSidebarNativeTag,
}: {
  onPress: () => void;
  searchFieldNativeTag: number | null;
  setSearchSidebarNativeTag: (tag: number | null) => void;
}) {
  const [dpadFocused, setDpadFocused] = useState(false);
  const showRing = shouldUseTvDpadFocus() || isTvTarget();
  const { setRef, nativeTag } = useTvNativeTag();

  useEffect(() => {
    setSearchSidebarNativeTag(nativeTag);
    return () => setSearchSidebarNativeTag(null);
  }, [nativeTag, setSearchSidebarNativeTag]);

  return (
    <PlatformPressable
      ref={setRef as never}
      accessibilityRole="button"
      accessibilityLabel="Search"
      focusable
      onPress={onPress}
      onFocus={() => setDpadFocused(true)}
      onBlur={() => setDpadFocused(false)}
      style={[
        styles.itemPressable,
        showRing ? getTVFocusRingStyle(dpadFocused) : {},
      ]}
      {...tvAndroidNavProps({
        nextFocusLeftSelf: nativeTag,
        nextFocusRight: searchFieldNativeTag,
      })}
    >
      <Ionicons name="search-outline" size={28} color={INACTIVE} />
      <SegmentDivider />
      <Text style={[styles.label, { color: INACTIVE }]} numberOfLines={2}>
        Search
      </Text>
    </PlatformPressable>
  );
}

function TvSidebarAuthItem({
  kind,
  onPress,
}: {
  kind: 'login' | 'logout';
  onPress: () => void;
}) {
  const [dpadFocused, setDpadFocused] = useState(false);
  const showRing = shouldUseTvDpadFocus() || isTvTarget();
  const label = kind === 'login' ? 'Login' : 'Logout';
  const icon =
    kind === 'login'
      ? ('key-outline' as const)
      : ('power-outline' as const);
  const { setRef, nativeTag } = useTvNativeTag();

  return (
    <PlatformPressable
      ref={setRef as never}
      accessibilityRole="button"
      accessibilityLabel={label}
      focusable
      onPress={onPress}
      onFocus={() => setDpadFocused(true)}
      onBlur={() => setDpadFocused(false)}
      style={[
        styles.itemPressable,
        showRing ? getTVFocusRingStyle(dpadFocused) : {},
      ]}
      {...tvAndroidNavProps({
        nextFocusLeftSelf: nativeTag,
      })}
    >
      <Ionicons name={icon} size={28} color={INACTIVE} />
      <SegmentDivider />
      <Text style={[styles.label, { color: INACTIVE }]} numberOfLines={2}>
        {label}
      </Text>
    </PlatformPressable>
  );
}

/**
 * Full-height left rail: icons stacked above labels, items spaced evenly vertically.
 */
export function TvSidebarTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const router = useRouter();
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const { searchFieldNativeTag, setSearchSidebarNativeTag } = useTvSearchFocusBridge();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <TvFocusGuideView
      style={[
        styles.sidebar,
        {
          paddingTop: RAIL_PADDING + insets.top,
          paddingBottom: RAIL_PADDING + insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const selected = state.index === index;
        const { options } = descriptors[route.key];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!selected && !event.defaultPrevented) {
            navigation.dispatch({
              ...CommonActions.navigate(route.name, route.params),
              target: state.key,
            });
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const label =
          options.title != null ? String(options.title) : tvTabLabel(route.name);

        return (
          <TvSidebarTabItem
            key={route.key}
            routeName={route.name}
            label={label === 'My Watchlist' ? 'Watchlist' : label}
            selected={selected}
            onPress={onPress}
            onLongPress={onLongPress}
            hasTVPreferredFocus={route.name === 'index'}
          />
        );
      })}
      <TvSidebarSearchItem
        onPress={() => router.push('/search')}
        searchFieldNativeTag={searchFieldNativeTag}
        setSearchSidebarNativeTag={setSearchSidebarNativeTag}
      />
      {session ? (
        <TvSidebarAuthItem
          kind="logout"
          onPress={() => {
            supabase.auth.signOut();
          }}
        />
      ) : (
        <TvSidebarAuthItem
          kind="login"
          onPress={() => {
            router.push('/login');
          }}
        />
      )}
    </TvFocusGuideView>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    alignSelf: 'stretch',
    width: TV_SIDEBAR_WIDTH,
    padding: RAIL_PADDING,
    justifyContent: 'space-evenly',
    alignItems: 'stretch',
    backgroundColor: '#1a1a1a',
    borderRightWidth: 1,
    borderRightColor: '#333333',
  },
  itemPressable: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderRadius: 12,
    overflow: 'visible',
    paddingVertical: 4,
  },
  segmentDivider: {
    width: 30,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginVertical: 10,
    borderRadius: 1,
  },
  label: {
    fontSize: LABEL_FONT,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: TV_SIDEBAR_WIDTH - RAIL_PADDING * 2,
    lineHeight: 22,
  },
});
