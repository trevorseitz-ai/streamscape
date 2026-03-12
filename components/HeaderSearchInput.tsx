import React, { useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSearch } from '../lib/search-context';

export function HeaderSearchInput() {
  const { query, setQuery, handleSearch, searchLoading, setIsSearching } = useSearch();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.backButton}
        onPress={() => setIsSearching(false)}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={22} color="#ffffff" />
      </Pressable>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder="Search movies..."
        placeholderTextColor="#6b7280"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={handleSearch}
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: Platform.OS === 'web' ? 280 : '100%',
    gap: 8,
  },
  backButton: {
    padding: 4,
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
    padding: 4,
  },
});
