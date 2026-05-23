/**
 * Global Discover invalidation (Profile saves streaming prefs → Discover consumes on tab focus).
 * One-shot atomic flag survives background-mounted Discover (no listener pub/sub needed).
 */

let discoverNeedsRefresh = false;

export function setDiscoverNeedsRefreshFlag(): void {
  discoverNeedsRefresh = true;
}

/**
 * If `true`, caller must run total Discover cache flush then refetch. Clears immediately (no loops).
 */
export function consumeDiscoverNeedsRefreshFlag(): boolean {
  const v = discoverNeedsRefresh;
  discoverNeedsRefresh = false;
  return v;
}
