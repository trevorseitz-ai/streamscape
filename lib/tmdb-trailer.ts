/** TMDB `/movie/{id}/videos` entry (subset used for trailer selection). */
export type TmdbVideoEntry = {
  key?: string;
  site?: string;
  type?: string;
  /** Source resolution TMDB registered for this upload (e.g. 720, 1080). */
  size?: number;
  official?: boolean;
  published_at?: string;
};

/**
 * Pick the best YouTube trailer key from TMDB video results.
 * Prefers official uploads, then highest `size`, then newest `published_at`.
 */
export function pickBestYoutubeTrailerKey(
  results: TmdbVideoEntry[] | null | undefined
): string | null {
  const trailers = (results ?? []).filter(
    (v) => v.site === 'YouTube' && v.type === 'Trailer' && typeof v.key === 'string' && v.key
  );
  if (trailers.length === 0) return null;
  if (trailers.length === 1) return trailers[0].key!;

  const ranked = trailers
    .map((v) => ({
      key: v.key!,
      official: v.official === true ? 1 : 0,
      size: typeof v.size === 'number' && v.size > 0 ? v.size : 0,
      publishedAt: v.published_at ? Date.parse(v.published_at) : 0,
    }))
    .sort((a, b) => {
      if (b.official !== a.official) return b.official - a.official;
      if (b.size !== a.size) return b.size - a.size;
      return b.publishedAt - a.publishedAt;
    });

  return ranked[0]?.key ?? null;
}
