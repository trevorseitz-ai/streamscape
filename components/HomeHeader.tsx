import React, { useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useTvNativeTag } from '../hooks/useTvNativeTag';
import { isTvTarget } from '../lib/isTv';
import { tvBodyFontSize, tvTitleFontSize } from '../lib/tvTypography';
import { tvFocusable, tvPreferredFocusProps } from '../lib/tvFocus';
import { tvAndroidNavProps } from '../lib/tvAndroidNavProps';
import { useTvSearchFocusBridge } from '../lib/tv-search-focus-context';
import { HeaderRight } from './HeaderRight';

export interface HomeHeaderProps {
  session?: { user: { id: string; email?: string } } | null;
  onLogout?: () => void;
  onLogin?: () => void;
}

export function HomeHeader(props: HomeHeaderProps) {
  const { session = null, onLogout = () => {}, onLogin = () => {} } = props;
  const router = useRouter();
  const { isLandscape } = useBreakpoint();
  const isTV = isTvTarget();
  const searchIconSize = isTV ? 28 : 20;
  const [searchFocused, setSearchFocused] = useState(false);
  const { setRef, nativeTag } = useTvNativeTag();
  const { setSearchFieldNativeTag, searchSidebarNativeTag } = useTvSearchFocusBridge();

  const handleSearchPress = () => {
    router.push('/search');
  };

  useLayoutEffect(() => {
    if (!isTV) {
      setSearchFieldNativeTag(null);
      return;
    }
    setSearchFieldNativeTag(nativeTag);
    return () => setSearchFieldNativeTag(null);
  }, [isTV, nativeTag, setSearchFieldNativeTag]);

  const renderSearchControl = (wrapperStyle: StyleProp<ViewStyle>, placeholderStyle: StyleProp<ViewStyle>) => {
    if (!isTV) {
      return (
        <Pressable
          {...tvPreferredFocusProps()}
          style={[styles.fakeInput, wrapperStyle]}
          onPress={handleSearchPress}
        >
          <Ionicons
            name="search"
            size={searchIconSize}
            color="#6b7280"
            style={styles.searchIcon}
          />
          <Text style={[styles.placeholderText, isTV && { fontSize: tvBodyFontSize(16) }]}>
            Search movies...
          </Text>
        </Pressable>
      );
    }

    return (
      <View
        ref={setRef}
        collapsable={false}
        focusable
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
        style={[
          styles.fakeInput,
          wrapperStyle,
          searchFocused && styles.fakeInputTvFocused,
        ]}
        {...tvAndroidNavProps({
          nextFocusLeft: searchSidebarNativeTag,
        })}
      >
        <Pressable
          onPress={handleSearchPress}
          style={[styles.searchInner, placeholderStyle]}
          {...tvFocusable()}
        >
          <Ionicons
            name="search"
            size={searchIconSize}
            color="#6b7280"
            style={styles.searchIcon}
          />
          <Text style={[styles.placeholderText, { fontSize: tvBodyFontSize(16) }]}>
            Search movies...
          </Text>
        </Pressable>
      </View>
    );
  };

  if (isLandscape) {
    return (
      <View style={[styles.headerRow, isTV && styles.headerRowTv]}>
        <View style={styles.leftGroup}>
          <View style={styles.branding}>
            <Text style={[styles.title, isTV && { fontSize: tvTitleFontSize(20) }]}>
              ReelDive
            </Text>
            <Text style={[styles.tagline, isTV && { fontSize: tvBodyFontSize(13) }]}>
              Welcome to ReelDive
            </Text>
          </View>
          {renderSearchControl(styles.inputWrapperRow, {})}
        </View>
        <View style={styles.rightGroup}>
          <HeaderRight
            routeName="index"
            session={session}
            onLogout={onLogout}
            onLogin={onLogin}
            onSearchOpen={handleSearchPress}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.headerColumn, isTV && styles.headerColumnTv]}>
      <View style={styles.headerTopRow}>
        <View style={styles.branding}>
          <Text style={[styles.title, isTV && { fontSize: tvTitleFontSize(20) }]}>ReelDive</Text>
          <Text style={[styles.tagline, isTV && { fontSize: tvBodyFontSize(13) }]}>
            Welcome to ReelDive
          </Text>
        </View>
        <View style={styles.rightGroup}>
          <HeaderRight
            routeName="index"
            session={session}
            onLogout={onLogout}
            onLogin={onLogin}
            hideSearchIcon
          />
        </View>
      </View>
      <View style={styles.searchRowPortrait}>
        {renderSearchControl(styles.inputWrapperPortrait, {})}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f0f0f',
    minHeight: 56,
    zIndex: 10,
    elevation: 10,
  },
  headerRowTv: {
    backgroundColor: '#121212',
    minHeight: 72,
    paddingVertical: 16,
  },
  headerColumn: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f0f0f',
    zIndex: 10,
    elevation: 10,
  },
  headerColumnTv: {
    backgroundColor: '#121212',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 40,
  },
  searchRowPortrait: {
    marginTop: 10,
    paddingHorizontal: 5,
    width: '100%',
    minHeight: 44,
    justifyContent: 'center',
  },
  leftGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    marginRight: 12,
  },
  branding: {
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  tagline: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  fakeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    minHeight: 44,
  },
  fakeInputTvFocused: {
    borderColor: '#6366f1',
    borderWidth: 2,
  },
  searchInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapperRow: {
    flex: 1,
    marginRight: 12,
  },
  inputWrapperPortrait: {
    width: '100%',
  },
  searchIcon: {
    marginRight: 10,
  },
  placeholderText: {
    fontSize: 16,
    color: '#6b7280',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
