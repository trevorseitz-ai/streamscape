import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
  type ComponentRef,
} from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  findNodeHandle,
  InteractionManager,
} from 'react-native';
import { Image } from 'expo-image';
import { tvFocusable } from '../lib/tvFocus';
import { tvAndroidNavProps } from '../lib/tvAndroidNavProps';
import { tvTitleFontSize, tvBodyFontSize } from '../lib/tvTypography';
import { useTvSearchFocusBridge } from '../lib/tv-search-focus-context';

/**
 * Poster rails for Discover/Home — opens **`/movie/[id]`**, not streaming apps.
 * Service launches use **`WatchOnButton`** + **`lib/streaming-universal-links`** (**`launchStreamingService`**).
 */

/** Locked TV poster rail — see `docs/depts/tv.md`. */
export const TV_MOVIE_GRID_POSTER_WIDTH = 140;
export const TV_MOVIE_GRID_POSTER_HEIGHT = 210;
/** Horizontal inset inside the focus Pressable so the cyan border clears the 140px poster edges. */
export const TV_MOVIE_GRID_FOCUS_HALO_PADDING_H = 4;
/** Native focus host width: poster + symmetric halo gutter (`TV_MOVIE_GRID_FOCUS_HALO_PADDING_H` × 2). */
export const TV_MOVIE_GRID_FOCUS_CELL_WIDTH =
  TV_MOVIE_GRID_POSTER_WIDTH + TV_MOVIE_GRID_FOCUS_HALO_PADDING_H * 2;
export const TV_MOVIE_GRID_COLUMNS = 5;
export const TV_MOVIE_GRID_GAP = 20;
export const TV_MOVIE_GRID_LIST_VERTICAL_PAD = 20;

/** Minimal inset — legacy export path (`HomeTvMovieRow.tsx`). */
export const EDGE_PADDING = 6;
export const TV_HOME_HORIZONTAL_EDGE_INSET = EDGE_PADDING;

/** Minimal item shape — satisfies Discover rows and Home `Movie`. */
export type TvMovieGridRowItem = {
  id: string;
  title: string;
  poster_url: string | null;
  release_year?: number | null;
};

export type TvMovieGridRowTvFocusProps = {
  movieRowIndex: number;
  nextRowEntryTag: number | null;
  lastRowLastCellWallTag: number | null;
  setRowEntryRef: (rowIdx: number) => (node: ComponentRef<typeof Pressable> | null) => void;
  setRowExitRef: (rowIdx: number) => (node: ComponentRef<typeof Pressable> | null) => void;
  isLastMovieRow: boolean;
  wrapNavVersion: number;
  sidebarLeftNavTag?: number | null;
  mainContentEntryNavTag?: number | null;
  /** Home: row 0 — D-pad up returns to hero entry. Omit on Discover. */
  heroNavTag?: number | null;
};

export type TvMovieGridRowProps = {
  movies: TvMovieGridRowItem[];
  title?: string;
  onPress: (movie: TvMovieGridRowItem) => void;
  showTitleMeta?: boolean;
  renderMovieFooter?: (movie: TvMovieGridRowItem) => ReactNode;
  tvFocus?: TvMovieGridRowTvFocusProps;
  onFirstPosterNativeTag?: (tag: number | null) => void;
  notifyTvContentFocus?: boolean;
  marginBottom?: number;
  /** Tighter top inset (e.g. Home trending) — avoids extra vertical shift vs legacy rows. */
  reduceTopSpacing?: boolean;
  /** Overrides default **`TV_MOVIE_GRID_LIST_VERTICAL_PAD`** on the horizontal list (e.g. Discover denser rails). */
  listVerticalPad?: number;
};

const ELECTRIC_CYAN = '#00F5FF';
const TV_FOCUS_BORDER_WIDTH = 3;

/**
 * Android TV focus-scroll diagnostics: red = cell wrapper, green = poster shell, blue = meta/footer.
 * Opt-in only — set **`EXPO_PUBLIC_TV_FOCUS_DIAGNOSTICS=1`** to enable (kept off in
 * normal dev builds so the Discover grid doesn't show debug borders).
 */
function tvMovieGridFocusDiagnosticsEnabled(): boolean {
  return process.env.EXPO_PUBLIC_TV_FOCUS_DIAGNOSTICS === '1';
}

function TvPosterCell({
  movie,
  colIndex,
  rowLen,
  onPress,
  showTitleMeta,
  footer,
  tvFocus,
  onFirstPosterNativeTag,
  notifyTvContentFocus,
}: {
  movie: TvMovieGridRowItem;
  colIndex: number;
  rowLen: number;
  onPress: () => void;
  showTitleMeta: boolean;
  footer: ReactNode | null;
  tvFocus?: TvMovieGridRowTvFocusProps;
  onFirstPosterNativeTag?: (tag: number | null) => void;
  notifyTvContentFocus: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [posterLoadFailed, setPosterLoadFailed] = useState(false);
  const [localTag, setLocalTag] = useState<number | null>(null);
  const { setTvContentHasFocus } = useTvSearchFocusBridge();

  /** Avoid pressableRef identity churn when parent passes a new `tvFocus` object each render. */
  const tvFocusRef = useRef(tvFocus);
  tvFocusRef.current = tvFocus;

  const onFirstPosterCbRef = useRef(onFirstPosterNativeTag);
  onFirstPosterCbRef.current = onFirstPosterNativeTag;

  /** Suppress duplicate parent updates for the same native tag (breaks update-depth loops). */
  const lastReportedFirstPosterTagRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    setPosterLoadFailed(false);
  }, [movie.id, movie.poster_url]);

  useEffect(() => {
    if (tvFocus?.movieRowIndex === 0 && colIndex === 0) {
      lastReportedFirstPosterTagRef.current = undefined;
    }
  }, [movie.id, tvFocus?.movieRowIndex, colIndex]);

  useEffect(() => {
    if (tvFocus?.movieRowIndex !== 0 || colIndex !== 0) return;
    const cb = onFirstPosterCbRef.current;
    if (cb == null) return;
    if (lastReportedFirstPosterTagRef.current === localTag) return;
    lastReportedFirstPosterTagRef.current = localTag;

    const handle = InteractionManager.runAfterInteractions(() => {
      cb(localTag);
    });
    return () => handle.cancel?.();
  }, [tvFocus?.movieRowIndex, colIndex, localTag]);

  const showPlaceholder = !movie.poster_url || posterLoadFailed;
  const useNav = Platform.OS === 'android' && tvFocus != null;
  const isLastInRow = colIndex === rowLen - 1;
  const isFirstInRow = colIndex === 0;

  const leftToSidebar =
    isFirstInRow ? (tvFocus?.sidebarLeftNavTag ?? localTag) : null;
  const rightCarriage =
    isLastInRow && tvFocus && !tvFocus.isLastMovieRow
      ? (tvFocus.nextRowEntryTag ?? localTag)
      : null;
  const rightWallSelf =
    isLastInRow && tvFocus && tvFocus.isLastMovieRow
      ? (tvFocus.lastRowLastCellWallTag ?? localTag)
      : null;

  const pressableRef = useCallback(
    (node: ComponentRef<typeof Pressable> | null) => {
      const tf = tvFocusRef.current;
      const nextTag =
        Platform.OS === 'android' && node ? findNodeHandle(node) : null;
      setLocalTag((prev) => (prev === nextTag ? prev : nextTag));

      if (tf) {
        if (isFirstInRow) tf.setRowEntryRef(tf.movieRowIndex)(node);
        if (isLastInRow) tf.setRowExitRef(tf.movieRowIndex)(node);
      }
    },
    [isFirstInRow, isLastInRow]
  );

  const diag = tvMovieGridFocusDiagnosticsEnabled();
  const diagWrap = diag ? styles.diagnosticCellWrap : undefined;
  const diagPoster = diag ? styles.diagnosticPosterShell : undefined;
  const diagMeta = diag ? styles.diagnosticMetaFooter : undefined;

  const pressableColumnStyle = useMemo(
    () => [
      styles.posterPressableColumn,
      ...(isFocused ? [styles.posterPressableFocused] : []),
    ],
    [isFocused]
  );

  const cellWrapStyle = useMemo(
    () => [
      styles.posterCellWrap,
      diagWrap,
      styles.posterCellWrapLocked,
    ],
    [diagWrap]
  );

  return (
    <View style={cellWrapStyle} collapsable={false}>
      <Pressable
        ref={pressableRef}
        collapsable={false}
        {...tvFocusable()}
        focusable={true}
        {...(useNav
          ? tvAndroidNavProps({
              ...(isFirstInRow && leftToSidebar != null
                ? { nextFocusLeft: leftToSidebar }
                : {}),
              ...(isLastInRow &&
              tvFocus &&
              !tvFocus.isLastMovieRow &&
              rightCarriage != null
                ? { nextFocusRight: rightCarriage }
                : {}),
              ...(isLastInRow &&
              tvFocus &&
              tvFocus.isLastMovieRow &&
              rightWallSelf != null
                ? { nextFocusRightSelf: rightWallSelf }
                : {}),
              ...(tvFocus?.isLastMovieRow &&
              tvFocus.mainContentEntryNavTag != null
                ? { nextFocusDown: tvFocus.mainContentEntryNavTag }
                : {}),
              ...(tvFocus?.movieRowIndex === 0 &&
              tvFocus.heroNavTag != null
                ? { nextFocusUp: tvFocus.heroNavTag }
                : {}),
            })
          : {})}
        onFocus={() => {
          setIsFocused(true);
          if (notifyTvContentFocus) {
            InteractionManager.runAfterInteractions(() => {
              setTvContentHasFocus(true);
            });
          }
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
        onPress={onPress}
        android_ripple={null}
        style={pressableColumnStyle}
      >
        <View
          style={[styles.posterImageShell, diagPoster]}
          collapsable={false}
          focusable={false}
        >
          {!showPlaceholder ? (
            <Image
              source={{ uri: movie.poster_url as string }}
              style={styles.posterImageFill}
              contentFit="cover"
              cachePolicy="disk"
              priority="high"
              recyclingKey={movie.id}
              transition={null}
              onError={() => setPosterLoadFailed(true)}
            />
          ) : (
            <View focusable={false} style={[styles.placeholder, styles.posterImageFill]}>
              <Text style={styles.placeholderTitle} numberOfLines={3}>
                {movie.title}
              </Text>
            </View>
          )}
        </View>
        {showTitleMeta ? (
          <View style={[styles.metaFooterBand, diagMeta]} focusable={false} collapsable={false}>
            <Text
              style={[styles.metaTitle, { fontSize: tvBodyFontSize(14) }]}
              numberOfLines={2}
            >
              {movie.title}
            </Text>
            {movie.release_year != null ? (
              <Text style={[styles.metaYear, { fontSize: tvBodyFontSize(12) }]}>
                {movie.release_year}
              </Text>
            ) : null}
          </View>
        ) : null}
        {footer != null ? (
          <View style={[styles.metaFooterBand, diagMeta]} focusable={false} collapsable={false}>
            {footer}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export function TvMovieGridRow({
  movies,
  title,
  onPress,
  showTitleMeta = false,
  renderMovieFooter,
  tvFocus,
  onFirstPosterNativeTag,
  notifyTvContentFocus = false,
  marginBottom = 12,
  reduceTopSpacing = false,
  listVerticalPad,
}: TvMovieGridRowProps) {
  const rowLen = movies.length;

  const vPad = listVerticalPad ?? TV_MOVIE_GRID_LIST_VERTICAL_PAD;

  const rowContentStyle = useMemo(
    () =>
      reduceTopSpacing
        ? {
            paddingTop: 4,
            paddingBottom: vPad,
            gap: TV_MOVIE_GRID_GAP,
          }
        : {
            paddingVertical: vPad,
            gap: TV_MOVIE_GRID_GAP,
          },
    [reduceTopSpacing, vPad]
  );

  return (
    <View style={[styles.rowWrap, reduceTopSpacing && styles.rowWrapReduceTop, { marginBottom }]}>
      {title != null && title !== '' ? (
        <View
          style={[styles.sectionTitleWrap, reduceTopSpacing && styles.sectionTitleWrapTight]}
        >
          <Text style={[styles.sectionTitle, { fontSize: tvTitleFontSize(22) }]}>{title}</Text>
        </View>
      ) : null}
      <FlatList
        horizontal
        data={movies}
        keyExtractor={(m) => m.id}
        showsHorizontalScrollIndicator={false}
        removeClippedSubviews={false}
        style={styles.rowFlatList}
        contentContainerStyle={rowContentStyle}
        extraData={tvFocus?.wrapNavVersion}
        renderItem={({ item, index: colIndex }) => (
          <TvPosterCell
            movie={item}
            colIndex={colIndex}
            rowLen={rowLen}
            onPress={() => onPress(item)}
            showTitleMeta={showTitleMeta}
            footer={renderMovieFooter?.(item) ?? null}
            tvFocus={tvFocus}
            onFirstPosterNativeTag={onFirstPosterNativeTag}
            notifyTvContentFocus={notifyTvContentFocus}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    overflow: 'visible',
  },
  rowWrapReduceTop: {
    marginTop: 0,
    paddingTop: 0,
  },
  sectionTitleWrap: {
    marginBottom: 12,
  },
  sectionTitleWrapTight: {
    marginBottom: 6,
    marginTop: 0,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#ffffff',
  },
  rowFlatList: {
    width: '100%',
    overflow: 'visible',
  },
  posterCellWrap: {
    overflow: 'visible',
  },
  /** Hard-lock native footprint so narrow title text cannot shrink the focusable Pressable. */
  posterCellWrapLocked: {
    width: TV_MOVIE_GRID_FOCUS_CELL_WIDTH,
    minWidth: TV_MOVIE_GRID_FOCUS_CELL_WIDTH,
    maxWidth: TV_MOVIE_GRID_FOCUS_CELL_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  /** Outer TV cell — diagnostic tint shows native wrapper bounds vs focus target. */
  diagnosticCellWrap: {
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
  },
  /** Focus target spans poster + meta/footer so Android measures full row for scroll. */
  posterPressableColumn: {
    width: TV_MOVIE_GRID_FOCUS_CELL_WIDTH,
    minWidth: TV_MOVIE_GRID_FOCUS_CELL_WIDTH,
    maxWidth: TV_MOVIE_GRID_FOCUS_CELL_WIDTH,
    paddingHorizontal: TV_MOVIE_GRID_FOCUS_HALO_PADDING_H,
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'flex-start',
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: 'transparent',
    overflow: 'visible',
    borderRadius: 8,
    borderWidth: TV_FOCUS_BORDER_WIDTH,
    borderColor: 'transparent',
  },
  /** Title/footer band fills the locked Pressable width (no intrinsic shrink from Text). */
  metaFooterBand: {
    width: '100%',
    alignSelf: 'stretch',
  },
  diagnosticPosterShell: {
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
  },
  diagnosticMetaFooter: {
    backgroundColor: 'rgba(0, 0, 255, 0.2)',
  },
  posterImageShell: {
    width: TV_MOVIE_GRID_POSTER_WIDTH,
    height: TV_MOVIE_GRID_POSTER_HEIGHT,
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'center',
    overflow: 'hidden',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  posterPressableFocused: {
    borderColor: ELECTRIC_CYAN,
  },
  posterImageFill: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
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
  metaTitle: {
    width: '100%',
    marginTop: 8,
    fontWeight: '600',
    color: '#ffffff',
  },
  metaYear: {
    width: '100%',
    marginTop: 2,
    color: '#9ca3af',
  },
});
