import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MovieCard, type Movie } from './MovieCard';

interface SearchResultsOverlayProps {
  searchLoading: boolean;
  searchError: string | null;
  searchResult: Movie | null;
  onResultPress: (movie: Movie) => void;
  onDismiss: () => void;
  /** Top offset so content appears below the header (avoids covering header buttons). */
  contentTopOffset?: number;
  /** Backdrop pointer events: use 'none' initially to avoid catching tap tail, then 'auto' when fully active. */
  backdropPointerEvents?: 'auto' | 'none';
}

export function SearchResultsOverlay({
  searchLoading,
  searchError,
  searchResult,
  onResultPress,
  onDismiss,
  contentTopOffset = 20,
  backdropPointerEvents = 'auto',
}: SearchResultsOverlayProps) {
  const handleDismiss = () => {
    onDismiss();
  };

  return (
    <View style={styles.overlay}>
      <Pressable
        style={styles.backdrop}
        onPress={handleDismiss}
        pointerEvents={backdropPointerEvents}
      />
      <View style={[styles.content, { paddingTop: contentTopOffset }]}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleDismiss}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={28} color="#ffffff" />
        </TouchableOpacity>
        {searchLoading && (
          <View style={styles.resultBox}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.resultText}>Searching...</Text>
          </View>
        )}
        {searchError && !searchLoading && (
          <View style={styles.resultBox}>
            <Text style={styles.errorText}>{searchError}</Text>
          </View>
        )}
        {searchResult && !searchLoading && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search Result</Text>
            <View style={styles.resultRow}>
              <MovieCard movie={searchResult} onPress={() => onResultPress(searchResult)} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'flex-start',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 11,
    padding: 8,
  },
  resultBox: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    alignItems: 'center',
  },
  resultText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    width: 120,
  },
});
