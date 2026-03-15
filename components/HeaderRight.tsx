import React from 'react';
import { View, Pressable, Text, StyleSheet, Keyboard, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSearch } from '../lib/search-context';
import { CountrySelector } from './CountrySelector';

interface HeaderRightProps {
  routeName?: string;
  session?: { user: { id: string; email?: string } } | null;
  onLogout?: () => void;
  onLogin?: () => void;
  /** When true, only show Search + Country (no auth). Used for movie details. */
  compact?: boolean;
  /** When true, hide the search icon (e.g. when search is in a separate row). */
  hideSearchIcon?: boolean;
}

export function HeaderRight({
  routeName = '',
  session = null,
  onLogout = () => {},
  onLogin = () => {},
  compact = false,
  hideSearchIcon = false,
}: HeaderRightProps) {
  const { setIsSearching, isSearching } = useSearch();

  const showSearch =
    routeName === 'index' ||
    routeName === 'watchlist' ||
    routeName === 'movie';

  return (
    <View style={styles.headerRight}>
      <CountrySelector />
      {!compact && session ? (
        <TouchableOpacity
          style={styles.authButton}
          onPress={onLogout}
          activeOpacity={0.8}
          userInteractionEnabled
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      ) : !compact ? (
        <TouchableOpacity
          style={styles.authButton}
          onPress={onLogin}
          activeOpacity={0.8}
          userInteractionEnabled
        >
          <Ionicons name="person-circle-outline" size={20} color="#6366f1" />
          <Text style={styles.loginText}>Log In</Text>
        </TouchableOpacity>
      ) : null}
      {showSearch && !hideSearchIcon && (
        <Pressable
          style={styles.searchIcon}
          onPress={() => {
            if (isSearching) Keyboard.dismiss();
            setIsSearching(!isSearching);
          }}
          hitSlop={8}
        >
          <Ionicons name="search-outline" size={22} color="#ffffff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    gap: 12,
    zIndex: 11,
  },
  searchIcon: {
    padding: 4,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 6,
    zIndex: 999,
  },
  loginText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
