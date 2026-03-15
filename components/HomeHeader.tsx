import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Keyboard,
} from 'react-native';
import type { RefObject } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSearch } from '../lib/search-context';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { HeaderRight } from './HeaderRight';

export interface HomeHeaderProps {
  session?: { user: { id: string; email?: string } } | null;
  onLogout?: () => void;
  onLogin?: () => void;
  /** Ref for the search TextInput (used for auto-focus from parent). */
  searchInputRef?: RefObject<TextInput | null>;
  /** Called when search is opened from HeaderRight (landscape) - use to focus input. */
  onSearchOpen?: () => void;
  /** Called when search is closed from HeaderRight (landscape) - use to blur input. */
  onSearchClose?: () => void;
}

export function HomeHeader(props: HomeHeaderProps) {
  const { session = null, onLogout = () => {}, onLogin = () => {}, searchInputRef, onSearchOpen, onSearchClose } = props;
  const { isSearching, setIsSearching, query, setQuery, handleSearch, searchLoading, setSearchResult, setSearchError } =
    useSearch();
  const { isLandscape } = useBreakpoint();
  const internalInputRef = useRef<TextInput>(null);
  const inputRef = searchInputRef ?? internalInputRef;
  const dummyInputRef = useRef<TextInput>(null);

  const focusSearchInput = useCallback(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  const handleSearchIconPress = useCallback(() => {
    setSearchResult(null);
    setSearchError(null);
    // Focus BEFORE state change - input must be in DOM (hidden via opacity/height)
    dummyInputRef.current?.focus();
    inputRef.current?.focus();
    setIsSearching(true);
  }, [setSearchResult, setSearchError, setIsSearching, inputRef]);

  const handleSearchClose = useCallback(() => {
    inputRef.current?.blur();
    Keyboard.dismiss();
    setIsSearching(false);
  }, [inputRef, setIsSearching]);

  if (isLandscape) {
    return (
      <View style={styles.headerRow}>
        <View style={styles.leftGroup}>
          <View style={styles.branding}>
            <Text style={styles.title}>StreamScape</Text>
            <Text style={styles.tagline}>Find where to stream it</Text>
          </View>
          <View style={[styles.inputWrapper, styles.inputWrapperRow, isSearching ? styles.searchInputVisible : styles.searchInputHidden]}>
            <TextInput
              key="search-input-field"
              ref={inputRef}
              style={styles.input}
              placeholder="Search movies..."
              placeholderTextColor="#6b7280"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => { Keyboard.dismiss(); handleSearch(); }}
              returnKeyType="search"
              editable={!searchLoading}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={false}
            />
            {query.length > 0 ? (
              <Pressable style={styles.clearButton} onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color="#6b7280" />
              </Pressable>
            ) : null}
          </View>
        </View>
        <View style={styles.rightGroup}>
          <HeaderRight
            routeName="index"
            session={session}
            onLogout={onLogout}
            onLogin={onLogin}
            onSearchOpen={onSearchOpen ?? focusSearchInput}
            onSearchClose={onSearchClose ?? handleSearchClose}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.headerColumn}>
      {/* Dummy input for Safari: focus this first on tap, then real input. Must stay in DOM. */}
      <TextInput
        ref={dummyInputRef}
        style={styles.dummyInput}
        editable
      />
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
            hideSearchIcon
          />
        </View>
      </View>
      <View style={styles.searchRowPortrait}>
        {!isSearching && (
          <Pressable
            style={styles.searchIconRow}
            onPress={handleSearchIconPress}
            hitSlop={8}
          >
            <Ionicons name="search-outline" size={22} color="#ffffff" />
          </Pressable>
        )}
        <View style={[styles.inputWrapper, styles.inputWrapperPortrait, isSearching ? styles.searchInputVisible : styles.searchInputHidden]}>
          <Pressable
            style={styles.collapseButton}
            onPress={handleSearchClose}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color="#9ca3af" />
          </Pressable>
          <TextInput
            key="search-input-field"
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
            editable={isSearching ? !searchLoading : true}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={false}
          />
          {query.length > 0 ? (
            <Pressable style={styles.clearButton} onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </Pressable>
          ) : null}
        </View>
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
    marginTop: 10,
    paddingHorizontal: 5,
    width: '100%',
    minHeight: 44,
    justifyContent: 'center',
  },
  searchIconRow: {
    padding: 4,
    alignSelf: 'flex-start',
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
  collapseButton: {
    marginRight: 8,
    padding: 4,
    justifyContent: 'center',
  },
  dummyInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 1,
    zIndex: -1,
  },
  searchInputHidden: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  searchInputVisible: {
    opacity: 1,
    pointerEvents: 'auto',
  },
});
