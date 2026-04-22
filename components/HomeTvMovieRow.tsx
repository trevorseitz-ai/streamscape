import { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { type Movie } from './MovieCard';
import { tvFocusable } from '../lib/tvFocus';
import { tvTitleFontSize, tvBodyFontSize } from '../lib/tvTypography';
import { useTvSearchFocusBridge } from '../lib/tv-search-focus-context';

/** Minimal inset from the physical bezel (left & right). */
export const EDGE_PADDING = 6;
/** Same as `EDGE_PADDING`; Home empty/loading horizontal text inset in `index.tsx`. */
export const TV_HOME_HORIZONTAL_EDGE_INSET = EDGE_PADDING;

const GAP = 20;
const ROW_CHUNK = 10;
const FOCUS_VERTICAL_PAD = 20;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

type PosterCellProps = {
  movie: Movie;
  posterWidth: number;
  posterHeight: number;
  onMoviePress?: (movie: Movie) => void;
};

function HomeTvPosterCell({
  movie,
  posterWidth,
  posterHeight,
  onMoviePress,
}: PosterCellProps) {
  const router = useRouter();
  const [isFocused, setIsFocused] = useState(false);
  const { setTvContentHasFocus } = useTvSearchFocusBridge();

  return (
    <View
      style={[styles.posterCellColumn, { width: posterWidth }]}
      collapsable={false}
    >
      <Pressable
        {...tvFocusable()}
        focusable={true}
        onFocus={() => {
          setIsFocused(true);
          setTvContentHasFocus(true);
        }}
        onBlur={() => setIsFocused(false)}
        onPress={() => {
          onMoviePress?.(movie);
          router.push(`/movie/${movie.id}`);
        }}
        style={[
          {
            width: posterWidth,
            height: posterHeight,
            overflow: 'visible' as const,
          },
          isFocused && {
            borderWidth: 3,
            borderColor: '#ffffff',
            transform: [{ scale: 1.05 }],
          },
        ]}
      >
        {movie.poster_url ? (
          <Image
            source={{ uri: movie.poster_url }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.posterPlaceholder, { width: '100%', height: '100%' }]}>
            <Text style={styles.placeholderMark}>?</Text>
          </View>
        )}
      </Pressable>
      <Text
        style={[styles.title, { fontSize: tvBodyFontSize(14) }]}
        numberOfLines={2}
      >
        {movie.title}
      </Text>
      {movie.release_year != null ? (
        <Text style={[styles.year, { fontSize: tvBodyFontSize(12) }]}>
          {movie.release_year}
        </Text>
      ) : null}
    </View>
  );
}

type HomeTvPosterRowProps = {
  movies: Movie[];
  posterWidth: number;
  posterHeight: number;
  onMoviePress?: (movie: Movie) => void;
};

function HomeTvPosterRow({
  movies,
  posterWidth,
  posterHeight,
  onMoviePress,
}: HomeTvPosterRowProps) {
  return (
    <FlatList
      horizontal
      data={movies}
      keyExtractor={(m) => m.id}
      showsHorizontalScrollIndicator={false}
      removeClippedSubviews={false}
      style={styles.rowFlatList}
      contentContainerStyle={[
        styles.rowListContent,
        { paddingVertical: FOCUS_VERTICAL_PAD, gap: GAP },
      ]}
      renderItem={({ item }) => (
        <HomeTvPosterCell
          movie={item}
          posterWidth={posterWidth}
          posterHeight={posterHeight}
          onMoviePress={onMoviePress}
        />
      )}
    />
  );
}

export type HomeTvMovieRowProps = {
  title?: string;
  movies: Movie[];
  onMoviePress?: (movie: Movie) => void;
};

/**
 * Home screen TV-only horizontal rows: 5 posters in usable width, focus-safe vertical padding.
 */
export function HomeTvMovieRow({ title, movies, onMoviePress }: HomeTvMovieRowProps) {
  const { width } = useWindowDimensions();
  const { posterWidth, posterHeight } = useMemo(() => {
    const USABLE_WIDTH = width - EDGE_PADDING * 2;
    const POSTER_WIDTH = (USABLE_WIDTH - GAP * 4) / 5;
    const POSTER_HEIGHT = POSTER_WIDTH * 1.5;
    return {
      posterWidth: POSTER_WIDTH,
      posterHeight: POSTER_HEIGHT,
    };
  }, [width]);

  const chunks = useMemo(() => chunkArray(movies, ROW_CHUNK), [movies]);

  return (
    <View style={styles.section}>
      {chunks.map((chunk, i) => (
        <View key={`home-tv-row-${i}`} style={styles.rowBlock}>
          {title != null && title !== '' && i === 0 ? (
            <View style={styles.sectionTitleWrap}>
              <Text style={[styles.sectionTitle, { fontSize: tvTitleFontSize(20) }]}>
                {title}
              </Text>
            </View>
          ) : null}
          <View style={styles.listClip}>
            <HomeTvPosterRow
              movies={chunk}
              posterWidth={posterWidth}
              posterHeight={posterHeight}
              onMoviePress={onMoviePress}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
  },
  /** Title + FlatList: `EDGE_PADDING` L/R (12px total off width); separates row stacks */
  rowBlock: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    paddingLeft: EDGE_PADDING,
    paddingRight: EDGE_PADDING,
    marginBottom: 40,
    overflow: 'visible',
  },
  sectionTitleWrap: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#ffffff',
  },
  /** Keeps exactly `usableWidth` for five tiles + gaps; overflow visible for scale focus */
  listClip: {
    width: '100%',
    alignSelf: 'stretch',
    overflow: 'visible',
  },
  rowFlatList: {
    width: '100%',
    overflow: 'visible',
    // TEMPORARY: diagnostic — FlatList viewport vs rowBlock
    backgroundColor: 'rgba(255, 0, 0, 0.3)',
  },
  rowListContent: {
    alignItems: 'flex-start',
  },
  posterCellColumn: {
    flexShrink: 0,
    overflow: 'visible',
  },
  posterPlaceholder: {
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderMark: {
    fontSize: 32,
    color: '#6b7280',
  },
  title: {
    marginTop: 8,
    fontWeight: '600',
    color: '#ffffff',
  },
  year: {
    marginTop: 2,
    color: '#9ca3af',
  },
});
