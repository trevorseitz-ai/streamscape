import { View, Text, Image, Pressable, StyleSheet } from 'react-native';

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

export function MovieCard({ movie, onPress }: MovieCardProps) {
  const rating =
    movie.vote_average != null
      ? Math.round(movie.vote_average * 10) / 10
      : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
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
    top: 6,
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
