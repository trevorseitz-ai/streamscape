import React, { useEffect, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSearch } from '../lib/search-context';
import { useMovie } from '../lib/movie-context';

export function MovieHeaderTitle() {
  const { isSearching, query, setQuery, handleSearch, searchLoading, setIsSearching } =
    useSearch();
  const { title } = useMovie();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isSearching) {
      inputRef.current?.focus();
    }
  }, [isSearching]);

  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>
        {title ?? 'Movie'}
      </Text>
      {isSearching && (
        <View style={styles.inputWrapper}>
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 12,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
    position: 'relative',
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
