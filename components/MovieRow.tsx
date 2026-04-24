import { useMemo, type ReactNode } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { MovieCard, type Movie } from './MovieCard';
import { isTvTarget } from '../lib/isTv';
import { tvTitleFontSize } from '../lib/tvTypography';

/** Phone / non-TV horizontal rows: inset per side (20 + 20 = 40 total). */
export const MOVIE_POSTER_EDGE_INSET = 20;
export const MOVIE_POSTER_GAP = 20;

/** TV: generous side margins so five posters read at a standard width. */
export const TV_MOVIE_SIDE_PADDING = 80;
export const TV_MOVIE_POSTER_GAP = 24;

/** Posters per horizontal row (extras scroll). */
export const MOVIES_PER_HORIZONTAL_ROW = 10;
const PHONE_GRID_GAP = 10;
/** Matches Home ScrollView phone padding (MAIN_HORIZONTAL_PADDING). */
const PHONE_HORIZONTAL_INSET = 20;

export type MoviePosterLayoutVariant = 'tv' | 'phone';

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Five tiles across with four gaps. TV uses 80px side padding and 24px gap;
 * phone uses 20px inset and 20px gap.
 */
export function getMoviePosterLayout(
  screenWidth: number,
  variant: MoviePosterLayoutVariant = 'phone'
) {
  if (variant === 'tv') {
    const SIDE_PADDING = TV_MOVIE_SIDE_PADDING;
    const GAP = TV_MOVIE_POSTER_GAP;
    const POSTER_WIDTH =
      (screenWidth - SIDE_PADDING * 2 - GAP * 4) / 5;
    return {
      posterWidth: POSTER_WIDTH,
      posterHeight: POSTER_WIDTH * 1.5,
      gap: GAP,
      sidePadding: SIDE_PADDING,
    };
  }
  const SIDE_PADDING = MOVIE_POSTER_EDGE_INSET;
  const GAP = MOVIE_POSTER_GAP;
  const POSTER_WIDTH =
    (screenWidth - SIDE_PADDING * 2 - GAP * 4) / 5;
  return {
    posterWidth: POSTER_WIDTH,
    posterHeight: POSTER_WIDTH * 1.5,
    gap: GAP,
    sidePadding: SIDE_PADDING,
  };
}

export type MovieRowPhoneLayout = 'grid' | 'horizontal';

export type MoviePosterRowProps = {
  movies: Movie[];
  onMoviePress?: (movie: Movie) => void;
  renderMovieFooter?: (movie: Movie) => ReactNode;
  /**
   * When true (default), FlatList content applies side padding to match layout math.
   * Set false when the parent already applied the same inset (e.g. Discover vertical list).
   */
  includeListHorizontalPadding?: boolean;
  /** TV Android: `nextFocusLeft` to the current tab’s sidebar slot (left edge of the row). */
  tvSidebarLeftNavTag?: number | null;
  /** When this horizontal band is the last in its section, D-pad down can loop to this target. */
  tvIsLastSubRow?: boolean;
  tvRowDownLoopNavTag?: number | null;
};

/**
 * One horizontal row of posters (TV + Discover phone). Uses 5-wide math and TV focus on MovieCard.
 */
export function MoviePosterRow({
  movies,
  onMoviePress,
  renderMovieFooter,
  includeListHorizontalPadding = true,
  tvSidebarLeftNavTag = null,
  tvIsLastSubRow = false,
  tvRowDownLoopNavTag = null,
}: MoviePosterRowProps) {
  const { width } = useWindowDimensions();
  const isTV = isTvTarget();
  const variant: MoviePosterLayoutVariant = isTV ? 'tv' : 'phone';
  const layout = useMemo(
    () => getMoviePosterLayout(width, variant),
    [width, variant]
  );

  const listPadding =
    includeListHorizontalPadding !== false ? layout.sidePadding : 0;

  const tvNf = isTV && Platform.OS === 'android' ? ({ focusable: false, collapsable: false } as const) : {};

  return (
    <View style={styles.posterRowOuter} {...tvNf}>
      <FlatList
        {...(isTV && Platform.OS === 'android' ? { focusable: false } : {})}
        horizontal
        data={movies}
        keyExtractor={(m) => m.id}
        showsHorizontalScrollIndicator={false}
        removeClippedSubviews={false}
        style={styles.posterRowFlatList}
        contentContainerStyle={[
          styles.posterRowContent,
          {
            paddingHorizontal: listPadding,
            gap: layout.gap,
          },
        ]}
        renderItem={({ item: movie, index }) => {
          const isRightEdge =
            isTV &&
            (index % 5 === 4 || index === movies.length - 1);
          const isLeftCol = index % 5 === 0;
          return (
            <View
              style={{ width: layout.posterWidth, flexShrink: 0 }}
              {...tvNf}
            >
              <MovieCard
                movie={movie}
                onPress={() => onMoviePress?.(movie)}
                tvClampFocusRight={isRightEdge}
                tvNextFocusLeft={
                  isTV && Platform.OS === 'android' && isLeftCol
                    ? tvSidebarLeftNavTag
                    : null
                }
                tvNextFocusDown={
                  isTV && Platform.OS === 'android' && tvIsLastSubRow
                    ? tvRowDownLoopNavTag
                    : null
                }
                posterWidth={layout.posterWidth}
                posterHeight={layout.posterHeight}
              />
              {renderMovieFooter?.(movie)}
            </View>
          );
        }}
      />
    </View>
  );
}

export type MovieRowProps = {
  title?: string;
  movies: Movie[];
  onMoviePress?: (movie: Movie) => void;
  renderMovieFooter?: (movie: Movie) => ReactNode;
  /** Phone: Home uses wrap grid; Discover uses horizontal rows. TV always uses 5-wide rows. */
  phoneLayout?: MovieRowPhoneLayout;
  /**
   * TV: when true (default), list content applies TV side padding (80) so rows match padded scroll content.
   * Set false when the parent already applied the same inset (e.g. Discover results FlatList).
   */
  wrapWithHorizontalInset?: boolean;
  /** TV Android: passed to horizontal `MoviePosterRow`s (left rail + optional down loop). */
  tvSidebarLeftNavTag?: number | null;
  tvRowDownLoopNavTag?: number | null;
};

/**
 * Section title + movie grid/rows. TV: 5-wide poster math, horizontal rows (chunked).
 * Phone: optional wrap grid (Home) or horizontal rows (Discover).
 */
export function MovieRow({
  title,
  movies,
  onMoviePress,
  renderMovieFooter,
  phoneLayout = 'grid',
  wrapWithHorizontalInset = true,
  tvSidebarLeftNavTag = null,
  tvRowDownLoopNavTag = null,
}: MovieRowProps) {
  const { width } = useWindowDimensions();
  const isTV = isTvTarget();

  const listPad = wrapWithHorizontalInset !== false;

  const sectionTvNf = isTV && Platform.OS === 'android' ? { focusable: false, collapsable: false } as const : {};

  if (isTV) {
    const chunks = chunkArray(movies, MOVIES_PER_HORIZONTAL_ROW);
    return (
      <View style={styles.sectionTvOuter} {...sectionTvNf}>
        {title ? (
          <View
            style={
              listPad
                ? styles.sectionTitleTvInset
                : styles.sectionTitleTvFlush
            }
            {...sectionTvNf}
          >
            <Text style={[styles.sectionTitle, { fontSize: tvTitleFontSize(20) }]}>
              {title}
            </Text>
          </View>
        ) : null}
        {chunks.map((chunk, i) => (
          <MoviePosterRow
            key={`tv-row-${i}`}
            movies={chunk}
            onMoviePress={onMoviePress}
            renderMovieFooter={renderMovieFooter}
            includeListHorizontalPadding={listPad}
            tvSidebarLeftNavTag={tvSidebarLeftNavTag}
            tvIsLastSubRow={i === chunks.length - 1}
            tvRowDownLoopNavTag={tvRowDownLoopNavTag}
          />
        ))}
      </View>
    );
  }

  if (phoneLayout === 'horizontal') {
    const chunks = chunkArray(movies, MOVIES_PER_HORIZONTAL_ROW);
    return (
      <View style={styles.sectionPhone}>
        {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
        {chunks.map((chunk, i) => (
          <MoviePosterRow
            key={`ph-row-${i}`}
            movies={chunk}
            onMoviePress={onMoviePress}
            renderMovieFooter={renderMovieFooter}
            includeListHorizontalPadding={listPad}
            tvSidebarLeftNavTag={isTV ? tvSidebarLeftNavTag : null}
            tvIsLastSubRow={isTV && i === chunks.length - 1}
            tvRowDownLoopNavTag={isTV ? tvRowDownLoopNavTag : null}
          />
        ))}
      </View>
    );
  }

  const columnCount = width >= 430 ? 3 : 2;
  const contentWidth = width - PHONE_HORIZONTAL_INSET * 2;
  const cardWidth =
    (contentWidth - PHONE_GRID_GAP * (columnCount - 1)) / columnCount;

  return (
    <View style={styles.sectionPhone}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={[styles.phoneGrid, { gap: PHONE_GRID_GAP }]}>
        {movies.map((movie) => (
          <View key={movie.id} style={{ width: cardWidth }}>
            <MovieCard
              movie={movie}
              onPress={() => onMoviePress?.(movie)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTvOuter: {
    width: '100%',
  },
  /** Home TV: align section title with poster row inset (80). */
  sectionTitleTvInset: {
    paddingHorizontal: TV_MOVIE_SIDE_PADDING,
    marginBottom: 16,
  },
  /** Parent already applied TV side padding (title only needs full width). */
  sectionTitleTvFlush: {
    width: '100%',
    marginBottom: 16,
  },
  sectionPhone: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  phoneGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  posterRowOuter: {
    marginBottom: 8,
    alignSelf: 'stretch',
  },
  posterRowFlatList: {
    alignSelf: 'stretch',
    width: '100%',
  },
  posterRowContent: {
    alignItems: 'flex-start',
  },
});
