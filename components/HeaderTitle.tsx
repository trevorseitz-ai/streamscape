import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useSearch } from '../lib/search-context';
import { HeaderSearchInput } from './HeaderSearchInput';

export function HeaderTitle() {
  const { isSearching } = useSearch();

  if (isSearching) {
    return (
      <View style={styles.searchContainer}>
        <HeaderSearchInput />
      </View>
    );
  }

  return (
    <Text style={styles.title} numberOfLines={1}>
      StreamScape
    </Text>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
});
