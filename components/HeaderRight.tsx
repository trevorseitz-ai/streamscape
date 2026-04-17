import React from 'react';
import { View, Pressable, Text, StyleSheet, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSearch } from '../lib/search-context';
import { CountrySelector } from './CountrySelector';
import { tvFocusable } from '../lib/tvFocus';

interface HeaderRightProps {
  routeName?: string;
  session?: { user: { id: string; email?: string } } | null;
  onLogout?: () => void;
  onLogin?: () => void;
  /** When true, only show Search + Country (no auth). Used for movie details. */
  compact?: boolean;
  /** When true, hide the search icon (e.g. when search is in a separate row). */
  hideSearchIcon?: boolean;
  /** Called when search is opened (landscape) - use to focus input. */
  onSearchOpen?: () => void;
  /** Called when search is closed (landscape) - use to blur input. */
  onSearchClose?: () => void;
}

export function HeaderRight({
  routeName = '',
  session = null,
  onLogout = () => {},
  onLogin = () => {},
  compact = false,
  hideSearchIcon = false,
  onSearchOpen,
  onSearchClose,
}: HeaderRightProps) {
  const { setIsSearching, setSearchResult, setSearchError } = useSearch();

  const showSearch =
    routeName === 'index' ||
    routeName === 'watchlist' ||
    routeName === 'movie';

  return (
    <View style={styles.headerRight}>
      <CountrySelector />
      {!compact && session ? (
        <Pressable
          {...tvFocusable()}
          style={({ pressed }) => [styles.authButton, pressed && { opacity: 0.85 }]}
          onPress={onLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      ) : !compact ? (
        <Pressable
          {...tvFocusable()}
          style={({ pressed }) => [styles.authButton, pressed && { opacity: 0.85 }]}
          onPress={onLogin}
        >
          <Ionicons name="person-circle-outline" size={20} color="#6366f1" />
          <Text style={styles.loginText}>Log In</Text>
        </Pressable>
      ) : null}
      {showSearch && !hideSearchIcon && (
        <Pressable
          {...tvFocusable()}
          style={styles.searchIcon}
          onPress={() => {
            let willOpen = false;
            setIsSearching((prev) => {
              if (prev) {
                if (onSearchClose) onSearchClose();
                else Keyboard.dismiss();
                return false;
              }
              willOpen = true;
              setSearchResult(null);
              setSearchError(null);
              return true;
            });
            if (willOpen) onSearchOpen?.();
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
