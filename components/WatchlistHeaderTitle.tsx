import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useSearch } from '../lib/search-context';
import { WatchlistSearchInput } from './WatchlistSearchInput';

export function WatchlistHeaderTitle() {
  const { isSearching } = useSearch();

  if (isSearching) {
    return (
      <View style={styles.searchContainer}>
        <WatchlistSearchInput />
      </View>
    );
  }

  return (
    <Text style={styles.title} numberOfLines={1}>
      My Watchlist
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
