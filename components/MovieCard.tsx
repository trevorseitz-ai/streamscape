import { useState, useEffect } from 'react';
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
import { useTvSearchFocusBridge } from '../lib/tv-search-focus-context';

export interface Movie {
  id: string;
  title: string;
  poster_url: string | null;
  release_year?: number | null;
  vote_average?: number | null;
  /** TMDB w45 provider logos (Stream Finder cache) — full URLs. */
  provider_logo_urls?: string[] | null;
}

interface MovieCardProps {
  movie: Movie;
  onPress?: () => void;
  /** TV: clamp D-pad focus on the right edge of the grid (prevents escaping the screen). */
  tvClampFocusRight?: boolean;
  /** TV Android: poster `Pressable` native tag for parent focus bridges (e.g. hero `nextFocusDown`). */
  onTvPosterNavTag?: (tag: number | null) => void;
  /**
   * TV Android: `nextFocusUp` for this poster (e.g. first cell → hero “View Details”).
   * Applied with `tvAndroidNavProps`; omit on non-Android.
   */
  tvNextFocusUp?: number | null;
  /**
   * TV Android: go left to the active sidebar slot (e.g. first column of a grid/row).
   * Use `nextFocusLeft` in `tvAndroidNavProps`.
   */
  tvNextFocusLeft?: number | null;
  /**
   * TV Android: bottom row / floor — e.g. loop `nextFocusDown` back to the hero’s entry tag.
   */
  tvNextFocusDown?: number | null;
  /** When set (e.g. Discover grid), fixes poster size to an exact pixel layout (2:3 via height). */
  posterWidth?: number;
  posterHeight?: number;
}

/** ReelDive TV: Electric Cyan (art.md) */
const ELECTRIC_CYAN = '#00F5FF';
const TV_FOCUS_BORDER_WIDTH = 3;

/** Poster tile typography — see `/tv.md` (`TV_TITLE_FONT`, `TV_YEAR_FONT`). */
const TV_TILE_TITLE_PX = 13;
const TV_TILE_YEAR_PX = 11;

function triggerHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function MovieCard({
  movie,
  onPress,
  tvClampFocusRight = false,
  onTvPosterNavTag,
  tvNextFocusUp,
  tvNextFocusLeft,
  tvNextFocusDown,
  posterWidth: fixedPosterWidth,
  posterHeight: fixedPosterHeight,
}: MovieCardProps) {
  const router = useRouter();
  const status = useWatchlistStatus();
  const isTV = isTvTarget();
  const tvPosterFocus = shouldUseTvDpadFocus() || isTV;
  const tmdbId = /^\d+$/.test(String(movie.id)) ? Number(movie.id) : null;
  const [isFocused, setIsFocused] = useState(false);
  const { setTvContentHasFocus } = useTvSearchFocusBridge();
  const { setRef: setPosterNavRef, nativeTag: posterNavTag } = useTvNativeTag();
  const [posterLoadFailed, setPosterLoadFailed] = useState(false);

  useEffect(() => {
    setPosterLoadFailed(false);
  }, [movie?.id, movie?.poster_url]);

  useEffect(() => {
    onTvPosterNavTag?.(posterNavTag);
  }, [onTvPosterNavTag, posterNavTag]);

  useEffect(() => {
    return () => {
      onTvPosterNavTag?.(null);
    };
  }, [onTvPosterNavTag]);

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

  const hasFixedPosterSize =
    fixedPosterWidth != null &&
    fixedPosterHeight != null &&
    fixedPosterWidth > 0 &&
    fixedPosterHeight > 0;

  /**
   * Fixed poster: outer shell stays `overflow: 'visible'` so the TV focus ring on `Pressable`
   * isn’t clipped; image crops inside `posterClipInner`.
   */
  const posterContainerStyle =
    hasFixedPosterSize && fixedPosterWidth != null && fixedPosterHeight != null
      ? [
          styles.posterShellFixedOuter,
          { width: fixedPosterWidth, height: fixedPosterHeight },
        ]
      : styles.posterContainer;

  const cardWidthStyle = hasFixedPosterSize
    ? { width: fixedPosterWidth, maxWidth: fixedPosterWidth }
    : null;

  const showPosterPlaceholder = !movie.poster_url || posterLoadFailed;

  const posterRaster = !showPosterPlaceholder ? (
    <Image
      source={{ uri: movie.poster_url as string }}
      style={{ width: '100%', height: '100%' }}
      resizeMode="cover"
      onError={() => setPosterLoadFailed(true)}
    />
  ) : (
    <View style={styles.posterPlaceholder}>
      <Text style={styles.placeholderTitle} numberOfLines={3}>
        {movie.title}
      </Text>
    </View>
  );

  const posterInner = (
    <>
      {hasFixedPosterSize && fixedPosterWidth != null && fixedPosterHeight != null ? (
        <View style={styles.posterClipInner}>{posterRaster}</View>
      ) : (
        posterRaster
      )}
      {hasSession && tmdbId != null && !isTV && (
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
      {movie.provider_logo_urls && movie.provider_logo_urls.length > 0 ? (
        <View style={styles.providerLogoRow} pointerEvents="none">
          {movie.provider_logo_urls.slice(0, 6).map((uri, i) => (
            <Image
              key={`${uri}-${i}`}
              source={{ uri }}
              style={styles.providerLogoThumb}
              resizeMode="contain"
            />
          ))}
        </View>
      ) : null}
    </>
  );

  const titleStyle = [
    styles.title,
    isTV && { marginTop: 0, fontSize: TV_TILE_TITLE_PX },
  ];
  const yearStyle = [styles.year, isTV && { fontSize: TV_TILE_YEAR_PX }];

  /** Home/TV grids: prevent flex parents from stretching fixed poster tiles. */
  const tvCardFlexLock =
    isTV && tvPosterFocus
      ? hasFixedPosterSize &&
          fixedPosterWidth != null &&
          fixedPosterHeight != null
        ? {
            width: fixedPosterWidth,
            maxWidth: fixedPosterWidth,
            minWidth: fixedPosterWidth,
            flexGrow: 0,
            flexShrink: 0,
            alignSelf: 'flex-start',
          }
        : { flexGrow: 0, flexShrink: 0 }
      : null;

  const hasTvAndroidNavProps =
    Platform.OS === 'android' &&
    (tvClampFocusRight ||
      tvNextFocusUp != null ||
      tvNextFocusLeft != null ||
      tvNextFocusDown != null);

  if (tvPosterFocus) {
    return (
      <Pressable
        ref={setPosterNavRef as never}
        focusable
        {...tvFocusable()}
        {...(hasTvAndroidNavProps
          ? tvAndroidNavProps({
              ...(tvClampFocusRight ? { nextFocusRightSelf: posterNavTag } : {}),
              ...(tvNextFocusUp != null ? { nextFocusUp: tvNextFocusUp } : {}),
              ...(tvNextFocusLeft != null ? { nextFocusLeft: tvNextFocusLeft } : {}),
              ...(tvNextFocusDown != null ? { nextFocusDown: tvNextFocusDown } : {}),
            })
          : tvClampFocusRight
            ? tvAndroidNavProps({ nextFocusRightSelf: posterNavTag })
            : {})}
        accessibilityRole="button"
        onPress={handleCardPress}
        onFocus={() => {
          setIsFocused(true);
          setTvContentHasFocus(true);
          if (__DEV__) {
            console.log(`[D-PAD FOCUS] Landed on: ${movie.title || 'Unknown'}`);
          }
        }}
        onBlur={() => {
          setIsFocused(false);
          if (__DEV__) {
            console.log(`[D-PAD BLUR] Left: ${movie.title || 'Unknown'}`);
          }
        }}
        android_ripple={null}
        style={[
          styles.card,
          isTV && styles.cardTv,
          cardWidthStyle,
          tvCardFlexLock,
          { position: 'relative', overflow: 'visible' },
          styles.posterPressable,
          isFocused && styles.posterFocusedTv,
        ]}
      >
        <View
          style={posterContainerStyle}
          focusable={isTV && Platform.OS === 'android' ? false : undefined}
        >
          {posterInner}
        </View>
        <View
          style={styles.titleBlockTv}
          focusable={isTV && Platform.OS === 'android' ? false : undefined}
        >
          <Text style={titleStyle} numberOfLines={2}>
            {movie.title}
          </Text>
          {movie.release_year != null ? (
            <Text style={yearStyle}>{movie.release_year}</Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      {...tvFocusable()}
      style={({ pressed }) => [styles.card, cardWidthStyle, pressed && styles.cardPressed]}
      onPress={handleCardPress}
    >
      <View style={posterContainerStyle}>{posterInner}</View>
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
    overflow: 'visible',
  },
  cardTv: {
    maxWidth: 9999,
    overflow: 'visible',
  },
  titleBlockTv: {
    marginTop: 8,
  },
  /** Idle: same border width as focused so scale/focus do not reflow the grid. */
  posterPressable: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    overflow: 'visible',
    borderWidth: TV_FOCUS_BORDER_WIDTH,
    borderColor: 'transparent',
  },
  posterFocusedTv: {
    borderColor: ELECTRIC_CYAN,
    borderWidth: TV_FOCUS_BORDER_WIDTH,
    transform: [{ scale: 1.05 }],
    overflow: 'visible',
    zIndex: 2,
    elevation: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
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
  /** Fixed tile: outer box — focus ring draws outside; no clipping here. */
  posterShellFixedOuter: {
    position: 'relative',
    borderRadius: 8,
    backgroundColor: '#1f1f1f',
    overflow: 'visible',
  },
  /** Clips raster only (inside outer shell). */
  posterClipInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    overflow: 'hidden',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#080C10',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  placeholderTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e5e7eb',
    textAlign: 'center',
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
  providerLogoRow: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 40,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  providerLogoThumb: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
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

export { MovieCard as TVMovieCard };
