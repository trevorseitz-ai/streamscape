import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { PlatformPressable } from '@react-navigation/elements';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { getTVSidebarNavFocusStyle } from '../hooks/useTVFocus';
import { useTvNativeTag } from '../hooks/useTvNativeTag';
import { isTvTarget, shouldUseTvDpadFocus } from '../lib/isTv';
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
export const TV_SIDEBAR_WIDTH = 100;

export function getTvSidebarWidthForWindow(_windowWidth?: number): number {
  return TV_SIDEBAR_WIDTH;
}

/**
 * Fixed slot order — never derived from `state.routes.length` so the rail keeps
 * consistent spacing regardless of navigator internals.
 */
const TV_SIDEBAR_SLOTS = [
  'index',
  'search',
  'watchlist',
  'library',
  'discover',
  'profile',
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
    discover: 'Discover',
    profile: 'Profile',
  };
  return fallback[routeName];
}

function iconForSlot(
  routeName: SlotName,
  selected: boolean
): keyof typeof Ionicons.glyphMap {
  const iconMap: Record<
    SlotName,
    { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
  > = {
    index: { active: 'home', inactive: 'home-outline' },
    search: { active: 'search', inactive: 'search-outline' },
    watchlist: { active: 'list', inactive: 'list-outline' },
    library: { active: 'library', inactive: 'library-outline' },
    discover: { active: 'compass', inactive: 'compass-outline' },
    profile: { active: 'person', inactive: 'person-outline' },
  };
  const icons = iconMap[routeName];
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
      focusable={false}
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
  slotName: (typeof TV_SIDEBAR_SLOTS)[number];
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
  onRegisterSlotNavTag?: (slot: (typeof TV_SIDEBAR_SLOTS)[number], tag: number | null) => void;
  onSidebarItemFocusIn?: () => void;
};

function TvSidebarTabItem({
  slotName,
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
  onRegisterSlotNavTag,
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
    if (!onRegisterSlotNavTag) return;
    onRegisterSlotNavTag(slotName, nativeTag);
    return () => onRegisterSlotNavTag(slotName, null);
  }, [slotName, nativeTag, onRegisterSlotNavTag]);

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
      <View focusable={false} collapsable={false}>
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
      </View>
    </PlatformPressable>
  );
}

/**
 * Full-height left rail: fixed slots, space-evenly between block buffers.
 */
export function TvSidebarTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { width: windowWidth } = useWindowDimensions();
  const {
    searchFieldNativeTag,
    registerSidebarSlotNavTag,
    mainContentEntryNativeTag,
    setTvContentHasFocus,
  } = useTvSearchFocusBridge();

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

  return (
    <View
      focusable={false}
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
          return (
            <View
              key={slotName}
              focusable={false}
              style={{ width: '100%', minHeight: missingMinH }}
            />
          );
        }
        const index = state.routes.findIndex((r) => r.key === route.key);
        const selected = state.index === index;
        const desc = descriptors[route.key];
        const options = desc.options as { title?: string };
        const titleOpt = options.title != null ? String(options.title) : undefined;

        const label = labelForSlot(slotName, titleOpt);

        const iconName = iconForSlot(slotName, selected);

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

        /**
         * Every tab should jump to main content; Search uses the search field tag.
         * Other slots (Discover, Profile as last rail item, …) bridge via `mainContentEntryNativeTag`
         * so D-pad right never dead-ends on the rail edge.
         */
        const mainRightBridge: number | undefined =
          slotName === 'search' && searchFieldNativeTag != null
            ? searchFieldNativeTag
            : mainContentEntryNativeTag != null
              ? mainContentEntryNativeTag
              : undefined;
        const nextFocusRightTarget = mainRightBridge;

        return (
          <TvSidebarTabItem
            key={route.key}
            slotName={slotName}
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
            nextFocusRight={nextFocusRightTarget}
            onRegisterSlotNavTag={registerSidebarSlotNavTag}
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
