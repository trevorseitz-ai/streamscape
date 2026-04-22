import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { PlatformPressable } from '@react-navigation/elements';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getTVSidebarNavFocusStyle } from '../hooks/useTVFocus';
import { useTvNativeTag } from '../hooks/useTvNativeTag';
import { isTvTarget, shouldUseTvDpadFocus } from '../lib/isTv';
import { supabase } from '../lib/supabase';
import { tvAndroidNavProps } from '../lib/tvAndroidNavProps';
import {
  useTvSearchFocusBridge,
} from '../lib/tv-search-focus-context';
import {
  tvScale,
  getTvSidebarPaddingH,
  getTvSidebarPaddingV,
  getTvSidebarIconSize,
  getTvSidebarLabelFontSize,
  getTvSidebarLabelLineHeight,
  getTvSidebarSegmentLineWidth,
  getTvSidebarSegmentLineHeight,
  getTvSidebarSegmentLineMarginV,
} from '../lib/tvUiScale';

/** Fixed left rail width (~10% on 1080p landscape); do not stretch with parent flex. */
export const TV_SIDEBAR_WIDTH = 160;

export function getTvSidebarWidthForWindow(_windowWidth?: number): number {
  return TV_SIDEBAR_WIDTH;
}

/**
 * Fixed 7-slot order — never derived from `state.routes.length` so spacing stays
 * symmetric when auth state changes.
 */
const TV_SIDEBAR_SLOTS = [
  'index',
  'search',
  'watchlist',
  'library',
  'profile',
  'discover',
  'account',
] as const;

type SlotName = (typeof TV_SIDEBAR_SLOTS)[number];

const ACTIVE = '#6366f1';
const INACTIVE = '#6b7280';

function labelForSlot(routeName: SlotName, optionsTitle: string | undefined): string {
  if (optionsTitle != null && optionsTitle !== '') {
    if (optionsTitle === 'My Watchlist') return 'Watchlist';
    return optionsTitle;
  }
  const fallback: Record<SlotName, string> = {
    index: 'Home',
    search: 'Search',
    watchlist: 'Watchlist',
    library: 'Library',
    profile: 'Profile',
    discover: 'Discover',
    account: 'Account',
  };
  return fallback[routeName];
}

function iconForSlot(
  routeName: SlotName,
  selected: boolean,
  session: { user: { id: string } } | null
): keyof typeof Ionicons.glyphMap {
  if (routeName === 'account') {
    if (session) {
      return selected ? 'log-out' : 'log-out-outline';
    }
    return selected ? 'log-in' : 'log-in-outline';
  }
  const iconMap: Record<
    Exclude<SlotName, 'account'>,
    { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
  > = {
    index: { active: 'home', inactive: 'home-outline' },
    search: { active: 'search', inactive: 'search-outline' },
    watchlist: { active: 'list', inactive: 'list-outline' },
    library: { active: 'library', inactive: 'library-outline' },
    profile: { active: 'person', inactive: 'person-outline' },
    discover: { active: 'compass', inactive: 'compass-outline' },
  };
  const icons = iconMap[routeName as Exclude<SlotName, 'account'>];
  const name = icons ? (selected ? icons.active : icons.inactive) : 'ellipse-outline';
  return name;
}

function SegmentLine({
  focused,
  width: lineW,
  height: lineH,
  marginV,
}: {
  focused: boolean;
  width: number;
  height: number;
  marginV: number;
}) {
  return (
    <View
      style={[
        {
          width: lineW,
          height: lineH,
          marginVertical: marginV,
          backgroundColor: 'rgba(255,255,255,0.3)',
          alignSelf: 'center',
        },
        focused && styles.segmentLineFocused,
      ]}
    />
  );
}

type TabItemProps = {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconSize: number;
  labelFontSize: number;
  labelLineHeight: number;
  labelMaxWidth: number;
  lineW: number;
  lineH: number;
  lineMarginV: number;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  hasTVPreferredFocus?: boolean;
  nextFocusRight?: number | null;
  onSearchRailNativeTag?: (tag: number | null) => void;
  onSidebarItemFocusIn?: () => void;
};

function TvSidebarTabItem({
  label,
  iconName,
  iconSize,
  labelFontSize,
  labelLineHeight,
  labelMaxWidth,
  lineW,
  lineH,
  lineMarginV,
  selected,
  onPress,
  onLongPress,
  hasTVPreferredFocus,
  nextFocusRight,
  onSearchRailNativeTag,
  onSidebarItemFocusIn,
}: TabItemProps) {
  const [dpadFocused, setDpadFocused] = useState(false);
  const showRing = shouldUseTvDpadFocus() || isTvTarget();
  const { tvContentHasFocus } = useTvSearchFocusBridge();
  const dimSelectedWhileBrowsingContent =
    selected && tvContentHasFocus && !dpadFocused;
  const color = dpadFocused ? '#ffffff' : selected ? ACTIVE : INACTIVE;
  const { setRef, nativeTag } = useTvNativeTag();

  useEffect(() => {
    if (!onSearchRailNativeTag) return;
    onSearchRailNativeTag(nativeTag);
    return () => onSearchRailNativeTag(null);
  }, [nativeTag, onSearchRailNativeTag]);

  return (
    <PlatformPressable
      ref={setRef as never}
      accessibilityRole={Platform.OS === 'web' ? 'tab' : 'button'}
      accessibilityState={{ selected }}
      focusable={true}
      onPress={onPress}
      onLongPress={onLongPress}
      onFocus={() => {
        setDpadFocused(true);
        onSidebarItemFocusIn?.();
      }}
      onBlur={() => setDpadFocused(false)}
      style={[
        styles.itemPressable,
        dimSelectedWhileBrowsingContent && styles.navItemSelectedDimmed,
        showRing ? getTVSidebarNavFocusStyle(dpadFocused) : {},
      ]}
      {...tvAndroidNavProps({
        nextFocusLeftSelf: nativeTag,
        hasTVPreferredFocus,
        ...(nextFocusRight != null ? { nextFocusRight } : {}),
      })}
    >
      <Ionicons name={iconName} size={iconSize} color={color} />
      <SegmentLine
        focused={dpadFocused}
        width={lineW}
        height={lineH}
        marginV={lineMarginV}
      />
      <Text
        style={[
          styles.label,
          {
            color,
            fontSize: labelFontSize,
            lineHeight: labelLineHeight,
            maxWidth: labelMaxWidth,
          },
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </PlatformPressable>
  );
}

/**
 * Full-height left rail: exactly 7 fixed slots, space-evenly between block buffers.
 */
export function TvSidebarTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const {
    searchFieldNativeTag,
    setSearchSidebarNativeTag,
    mainContentEntryNativeTag,
    setTvContentHasFocus,
  } = useTvSearchFocusBridge();
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);

  const padH = getTvSidebarPaddingH(windowWidth);
  const padV = getTvSidebarPaddingV(windowWidth);
  const iconSize = getTvSidebarIconSize();
  const labelFont = getTvSidebarLabelFontSize();
  const labelLh = getTvSidebarLabelLineHeight();
  const lineW = getTvSidebarSegmentLineWidth();
  const lineH = getTvSidebarSegmentLineHeight();
  const lineMv = getTvSidebarSegmentLineMarginV();
  const labelMaxW = Math.max(48, TV_SIDEBAR_WIDTH - padH * 2);
  const missingMinH = Math.max(40, Math.round(56 * tvScale));

  const activeRouteName = state.routes[state.index]?.name;
  const focusBridgeRight =
    activeRouteName === 'search' && searchFieldNativeTag != null
      ? searchFieldNativeTag
      : mainContentEntryNativeTag;

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
    <View
      collapsable={Platform.OS === 'android' ? false : undefined}
      style={[
        styles.sidebar,
        {
          paddingHorizontal: padH,
          paddingTop: padV + insets.top,
          paddingBottom: padV + insets.bottom,
        },
      ]}
    >
      {TV_SIDEBAR_SLOTS.map((slotName) => {
        const route = state.routes.find((r) => r.name === slotName);
        if (!route) {
          return <View key={slotName} style={{ width: '100%', minHeight: missingMinH }} />;
        }
        const index = state.routes.findIndex((r) => r.key === route.key);
        const selected = state.index === index;
        const desc = descriptors[route.key];
        const options = desc.options as { title?: string };
        const titleOpt = options.title != null ? String(options.title) : undefined;

        const label =
          slotName === 'account'
            ? session
              ? 'Logout'
              : 'Login'
            : labelForSlot(slotName, titleOpt);

        const iconName = iconForSlot(slotName, selected, session);

        const onPress = () => {
          if (slotName === 'account') {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (event.defaultPrevented) return;
            if (session) {
              void supabase.auth.signOut();
            } else {
              router.push('/login');
            }
            return;
          }

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

        const homeOrSearchBridge =
          (slotName === 'index' || slotName === 'search') && focusBridgeRight != null
            ? focusBridgeRight
            : undefined;

        return (
          <TvSidebarTabItem
            key={route.key}
            label={label}
            iconName={iconName}
            iconSize={iconSize}
            labelFontSize={labelFont}
            labelLineHeight={labelLh}
            labelMaxWidth={labelMaxW}
            lineW={lineW}
            lineH={lineH}
            lineMarginV={lineMv}
            selected={selected}
            onPress={onPress}
            onLongPress={onLongPress}
            hasTVPreferredFocus={slotName === 'index'}
            nextFocusRight={homeOrSearchBridge}
            onSearchRailNativeTag={
              slotName === 'search' ? setSearchSidebarNativeTag : undefined
            }
            onSidebarItemFocusIn={() => setTvContentHasFocus(false)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: TV_SIDEBAR_WIDTH,
    minWidth: TV_SIDEBAR_WIDTH,
    maxWidth: TV_SIDEBAR_WIDTH,
    alignSelf: 'stretch',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRightWidth: 1,
    borderRightColor: '#222222',
    /** Flush against scene — kill any navigator default bumper */
    marginRight: 0,
    marginLeft: 0,
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
  /** Selected tab while focus is in main content (not on the rail). */
  navItemSelectedDimmed: {
    opacity: 0.5,
  },
  segmentLineFocused: {
    backgroundColor: '#ffffff',
  },
  label: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
