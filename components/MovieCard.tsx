import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useWatchlistStatus } from '../lib/watchlist-status-context';

export interface Movie {
  id: string;
  title: string;
  poster_url: string | null;
  release_year?: number | null;
  vote_average?: number | null;
}

interface MovieCardProps {
  movie: Movie;
  onPress?: () => void;
}

function triggerHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function MovieCard({ movie, onPress }: MovieCardProps) {
  const router = useRouter();
  const status = useWatchlistStatus();
  const tmdbId = /^\d+$/.test(movie.id) ? Number(movie.id) : null;

  const handleCardPress = () => {
    onPress?.();
    router.push(`/movie/${movie.id}`);
  };
  const isInWatchlist = tmdbId != null && (status?.watchlistTmdbIds?.has(tmdbId) ?? false);
  const isWatched = tmdbId != null && (status?.watchedTmdbIds?.has(tmdbId) ?? false);
  const hasSession = !!status?.session;

  const rating =
    movie.vote_average != null
      ? Math.round(movie.vote_average * 10) / 10
      : null;

  const handleWatchlistPress = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (!hasSession || tmdbId == null) return;
    triggerHaptic();
    status.toggleWatchlist(tmdbId, movie.title, movie.poster_url);
  };

  const handleWatchedPress = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (!hasSession || tmdbId == null) return;
    triggerHaptic();
    status.toggleWatched(tmdbId, movie.title, movie.poster_url);
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={handleCardPress}
    >
      <View style={styles.posterContainer}>
        {movie.poster_url ? (
          <Image
            source={{ uri: movie.poster_url }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Text style={styles.placeholderText}>?</Text>
          </View>
        )}
        {hasSession && tmdbId != null && (
          <>
            <TouchableOpacity
              style={[styles.iconButton, styles.iconButtonLeft]}
              onPress={handleWatchlistPress}
              activeOpacity={0.8}
            >
              <View style={styles.iconCircle}>
                <Ionicons
                  name={isInWatchlist ? 'bookmark' : 'bookmark-outline'}
                  size={16}
                  color="#ffffff"
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, styles.iconButtonRight]}
              onPress={handleWatchedPress}
              activeOpacity={0.8}
            >
              <View style={styles.iconCircle}>
                <Ionicons
                  name={isWatched ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={16}
                  color={isWatched ? '#22c55e' : 'rgba(255,255,255,0.6)'}
                />
              </View>
            </TouchableOpacity>
          </>
        )}
        {rating !== null && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingStar}>★</Text>
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {movie.title}
      </Text>
      {movie.release_year != null ? (
        <Text style={styles.year}>{movie.release_year}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 180,
  },
  cardPressed: {
    opacity: 0.85,
  },
  posterContainer: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1f1f1f',
    position: 'relative',
  },
  iconButton: {
    position: 'absolute',
    top: 5,
    zIndex: 2,
  },
  iconButtonLeft: {
    left: 5,
  },
  iconButtonRight: {
    right: 5,
  },
  iconCircle: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    padding: 4,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 32,
    color: '#6b7280',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 2,
  },
  ratingStar: {
    fontSize: 10,
    color: '#facc15',
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 8,
  },
  year: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
});
