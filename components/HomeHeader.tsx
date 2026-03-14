import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSearch } from '../lib/search-context';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { HeaderRight } from './HeaderRight';

export interface HomeHeaderProps {
  session?: { user: { id: string; email?: string } } | null;
  onLogout?: () => void;
  onLogin?: () => void;
}

export function HomeHeader(props: HomeHeaderProps) {
  const { session = null, onLogout = () => {}, onLogin = () => {} } = props;
  const { isSearching, query, setQuery, handleSearch, searchLoading } =
    useSearch();
  const { isLandscape } = useBreakpoint();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isSearching) {
      inputRef.current?.focus();
    }
  }, [isSearching]);

  const searchInput = (
    <View style={[styles.inputWrapper, isLandscape ? styles.inputWrapperRow : styles.inputWrapperPortrait]}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder="Search movies..."
        placeholderTextColor="#6b7280"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => {
          Keyboard.dismiss();
          handleSearch();
        }}
        returnKeyType="search"
        editable={!searchLoading}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {query.length > 0 ? (
        <Pressable
          style={styles.clearButton}
          onPress={() => setQuery('')}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={20} color="#6b7280" />
        </Pressable>
      ) : null}
    </View>
  );

  if (isLandscape) {
    return (
      <View style={styles.headerRow}>
        <View style={styles.leftGroup}>
          <View style={styles.branding}>
            <Text style={styles.title}>StreamScape</Text>
            <Text style={styles.tagline}>Find where to stream it</Text>
          </View>
          {isSearching && searchInput}
        </View>
        <View style={styles.rightGroup}>
          <HeaderRight
            routeName="index"
            session={session}
            onLogout={onLogout}
            onLogin={onLogin}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.headerColumn}>
      <View style={styles.headerTopRow}>
        <View style={styles.branding}>
          <Text style={styles.title}>StreamScape</Text>
          <Text style={styles.tagline}>Find where to stream it</Text>
        </View>
        <View style={styles.rightGroup}>
          <HeaderRight
            routeName="index"
            session={session}
            onLogout={onLogout}
            onLogin={onLogin}
          />
        </View>
      </View>
      {isSearching && (
        <View style={styles.searchRowPortrait}>
          {searchInput}
        </View>
      )}
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
  headerColumn: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f0f0f',
    zIndex: 10,
    elevation: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 40,
  },
  searchRowPortrait: {
    paddingVertical: 10,
    width: '100%',
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
  inputWrapper: {
    flexDirection: 'row',
    minWidth: 0,
    position: 'relative',
    alignItems: 'center',
  },
  inputWrapperRow: {
    flex: 1,
    marginRight: 12,
  },
  inputWrapperPortrait: {
    width: '100%',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingRight: 40,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    padding: 4,
  },
});
