/**
 * Bayesian shrinkage for "Top Rated" ordering.
 *
 * TMDB's vote_average is a plain mean, so a film with 14 votes averaging 9.9
 * outranks one with 30,000 votes averaging 8.7. Sorting by it — even with a
 * vote_count floor — puts concert films and niche documentaries with small
 * devoted audiences above everything people actually recognise.
 *
 * The standard fix is to pull each average toward the global mean in
 * proportion to how little evidence supports it:
 *
 *     score = (v / (v + m)) * R + (m / (v + m)) * C
 *
 *   R = the film's own average
 *   v = number of votes behind it
 *   C = the prior: the mean rating across all films
 *   m = the strength of that prior, in votes
 *
 * A film needs roughly m votes before its own average carries more weight
 * than the prior. Below that it is dragged toward average, which is the
 * honest reading of a thin sample.
 *
 * C measured from a 303-title TMDB sample spanning 10 to ~30,000 votes.
 * m is a product choice: higher demands more evidence before a title can
 * reach the top of a list.
 */
export const TMDB_PRIOR_MEAN = 7.16;
export const TMDB_PRIOR_STRENGTH = 500;

export function bayesianScore(
  voteAverage: number | null | undefined,
  voteCount: number | null | undefined,
  prior = TMDB_PRIOR_MEAN,
  strength = TMDB_PRIOR_STRENGTH,
): number {
  const R = typeof voteAverage === 'number' ? voteAverage : 0;
  const v = typeof voteCount === 'number' && voteCount > 0 ? voteCount : 0;
  if (v === 0) return prior;
  return (v / (v + strength)) * R + (strength / (v + strength)) * prior;
}

/** Sorts a list of TMDB-shaped rows best-first by shrunk score. */
export function rankByBayesian<T extends { vote_average?: number | null; vote_count?: number | null }>(
  rows: T[],
): T[] {
  return [...rows].sort(
    (a, b) =>
      bayesianScore(b.vote_average, b.vote_count) -
      bayesianScore(a.vote_average, a.vote_count),
  );
}
