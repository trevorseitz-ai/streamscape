import React, { useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSearch } from '../lib/search-context';

export function WatchlistSearchInput() {
  const {
    query,
    setQuery,
    handleSearch,
    searchLoading,
    setIsSearching,
  } = useSearch();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCancel = () => {
    Keyboard.dismiss();
    setIsSearching(false);
  };

  const handleSearchGlobal = () => {
    Keyboard.dismiss();
    handleSearch();
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.backButton} onPress={handleCancel} hitSlop={8}>
        <Ionicons name="arrow-back" size={22} color="#ffffff" />
      </Pressable>
      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Filter by title..."
          placeholderTextColor="#6b7280"
          value={query}
          onChangeText={setQuery}
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
      <Pressable
        style={[styles.searchGlobalButton, searchLoading && styles.searchGlobalDisabled]}
        onPress={handleSearchGlobal}
        disabled={searchLoading}
      >
        <Ionicons name="globe-outline" size={18} color="#6366f1" />
        <Text style={styles.searchGlobalText}>Search Global</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: Platform.OS === 'web' ? 320 : '100%',
    gap: 8,
  },
  backButton: {
    padding: 4,
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
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
  searchGlobalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  searchGlobalDisabled: {
    opacity: 0.6,
  },
  searchGlobalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
  },
});
