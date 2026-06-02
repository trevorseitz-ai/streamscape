/**
 * Legacy entrypoint — TV horizontal rails use [`TvMovieGridRow`](./TvMovieGridRow.tsx).
 * Chunked rows match `TV_MOVIE_GRID_COLUMNS` (5) with locked 140×210 posters per `docs/depts/tv.md`.
 */
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import type { Movie } from './MovieCard';
import {
  TvMovieGridRow,
  TV_MOVIE_GRID_COLUMNS,
} from './TvMovieGridRow';

export { EDGE_PADDING, TV_HOME_HORIZONTAL_EDGE_INSET } from './TvMovieGridRow';

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export type HomeTvMovieRowProps = {
  title?: string;
  movies: Movie[];
  onMoviePress?: (movie: Movie) => void;
};

/** @deprecated Prefer `TvMovieGridRow` with explicit Android `tvFocus` props on TV. */
export function HomeTvMovieRow({ title, movies, onMoviePress }: HomeTvMovieRowProps) {
  const router = useRouter();
  const chunks = useMemo(() => chunkArray(movies, TV_MOVIE_GRID_COLUMNS), [movies]);

  return (
    <>
      {chunks.map((chunk, i) => (
        <TvMovieGridRow
          key={`legacy-home-tv-row-${i}`}
          title={i === 0 ? title : undefined}
          movies={chunk}
          showTitleMeta
          marginBottom={i < chunks.length - 1 ? 40 : 0}
          onPress={(m) => {
            onMoviePress?.(m as Movie);
            router.push(`/movie/${m.id}`);
          }}
        />
      ))}
    </>
  );
}
