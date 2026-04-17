import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTvNativeTag } from '../hooks/useTvNativeTag';
import { tvAndroidNavProps } from '../lib/tvAndroidNavProps';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useWatchlistStatus } from '../lib/watchlist-status-context';
import { tvFocusable } from '../lib/tvFocus';
import { isTvTarget, shouldUseTvDpadFocus } from '../lib/isTv';
import { useTVFocusRing } from '../hooks/useTVFocus';
import { tvBodyFontSize } from '../lib/tvTypography';

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
  /** TV: clamp D-pad focus on the right edge of the grid (prevents escaping the screen). */
  tvClampFocusRight?: boolean;
}

function triggerHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function MovieCard({ movie, onPress, tvClampFocusRight = false }: MovieCardProps) {
  const router = useRouter();
  const status = useWatchlistStatus();
  const tmdbId = /^\d+$/.test(movie.id) ? Number(movie.id) : null;
  const isTV = isTvTarget();
  const tvPosterFocus = shouldUseTvDpadFocus() || isTV;
  const focusRing = useTVFocusRing();
  const { setRef: setPosterNavRef, nativeTag: posterNavTag } = useTvNativeTag();

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

  const iconSize = isTV ? 22 : 16;

  const posterInner = (
    <>
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
          <Pressable
            {...tvFocusable()}
            style={[styles.iconButton, styles.iconButtonLeft]}
            onPress={handleWatchlistPress}
          >
            <View style={styles.iconCircle}>
              <Ionicons
                name={isInWatchlist ? 'bookmark' : 'bookmark-outline'}
                size={iconSize}
                color="#ffffff"
              />
            </View>
          </Pressable>
          <Pressable
            {...tvFocusable()}
            style={[styles.iconButton, styles.iconButtonRight]}
            onPress={handleWatchedPress}
          >
            <View style={styles.iconCircle}>
              <Ionicons
                name={isWatched ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={iconSize}
                color={isWatched ? '#22c55e' : 'rgba(255,255,255,0.6)'}
              />
            </View>
          </Pressable>
        </>
      )}
      {rating !== null && (
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingStar}>★</Text>
          <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
        </View>
      )}
    </>
  );

  const titleStyle = [
    styles.title,
    isTV && { marginTop: 0, fontSize: tvBodyFontSize(14) },
  ];
  const yearStyle = [styles.year, isTV && { fontSize: tvBodyFontSize(12) }];

  if (tvPosterFocus) {
    return (
      <View style={[styles.card, isTV && styles.cardTv]}>
        <Pressable
          ref={setPosterNavRef as never}
          {...tvFocusable()}
          {...(tvClampFocusRight
            ? tvAndroidNavProps({ nextFocusRightSelf: posterNavTag })
            : {})}
          accessibilityRole="button"
          onPress={handleCardPress}
          onFocus={focusRing.onFocus}
          onBlur={focusRing.onBlur}
          style={({ pressed }) => [
            styles.posterPressable,
            focusRing.ringStyle,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.posterContainer}>{posterInner}</View>
        </Pressable>
        <Pressable onPress={handleCardPress} style={styles.titlePressableTv}>
          <Text style={titleStyle} numberOfLines={2}>
            {movie.title}
          </Text>
          {movie.release_year != null ? (
            <Text style={yearStyle}>{movie.release_year}</Text>
          ) : null}
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      {...tvFocusable()}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={handleCardPress}
    >
      <View style={styles.posterContainer}>{posterInner}</View>
      <Text style={titleStyle} numberOfLines={2}>
        {movie.title}
      </Text>
      {movie.release_year != null ? (
        <Text style={yearStyle}>{movie.release_year}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 180,
  },
  cardTv: {
    maxWidth: 9999,
  },
  titlePressableTv: {
    marginTop: 8,
  },
  posterPressable: {
    borderRadius: 8,
    overflow: 'visible',
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
