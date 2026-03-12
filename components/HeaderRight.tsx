import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSearch } from '../lib/search-context';
import { CountrySelector } from './CountrySelector';

interface HeaderRightProps {
  routeName: string;
  session: { user: { id: string; email?: string } } | null;
  onLogout: () => void;
  onLogin: () => void;
}

export function HeaderRight({
  routeName,
  session,
  onLogout,
  onLogin,
}: HeaderRightProps) {
  const { setIsSearching } = useSearch();

  return (
    <View style={styles.headerRight}>
      {routeName === 'index' && (
        <Pressable
          style={styles.searchIcon}
          onPress={() => setIsSearching(true)}
          hitSlop={8}
        >
          <Ionicons name="search-outline" size={22} color="#ffffff" />
        </Pressable>
      )}
      <CountrySelector />
      {session ? (
        <Pressable style={styles.headerButton} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.headerButton} onPress={onLogin}>
          <Ionicons name="person-circle-outline" size={20} color="#6366f1" />
          <Text style={styles.loginText}>Sign In</Text>
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
