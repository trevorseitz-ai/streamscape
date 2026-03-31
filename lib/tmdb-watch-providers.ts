export type WatchProviderEntry = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
};

export type WatchProviderCountry = {
  link?: string;
  flatrate?: WatchProviderEntry[];
  free?: WatchProviderEntry[];
  ads?: WatchProviderEntry[];
  rent?: WatchProviderEntry[];
  buy?: WatchProviderEntry[];
};

export function dedupeWatchProvidersById(
  ...lists: Array<WatchProviderEntry[] | undefined>
): WatchProviderEntry[] {
  const combined = lists.flatMap((l) => l ?? []);
  return Array.from(new Map(combined.map((item) => [item.provider_id, item])).values());
}

/** Merge flatrate, free, ads, rent, and buy for one region; dedupe by provider_id. */
export function mergeWatchProviderCountryBuckets(
  country: WatchProviderCountry | undefined
): WatchProviderEntry[] {
  if (!country) return [];
  return dedupeWatchProvidersById(
    country.flatrate,
    country.free,
    country.ads,
    country.rent,
    country.buy
  );
}

/** Merge all buckets per country into `flatrate`; clear other tier fields. */
export function normalizeWatchProvidersCountries(
  results: Record<string, WatchProviderCountry> | null
): Record<string, WatchProviderCountry> | null {
  if (!results) return null;
  return Object.fromEntries(
    Object.entries(results).map(([code, country]) => {
      const mergedStream = mergeWatchProviderCountryBuckets(country);
      return [
        code,
        {
          ...country,
          flatrate: mergedStream,
          free: undefined,
          ads: undefined,
          rent: undefined,
          buy: undefined,
        },
      ];
    })
  );
}

/** When the user has chosen enabled services, only show those providers; otherwise show all. */
export function filterWatchProvidersByEnabled(
  providers: WatchProviderEntry[],
  enabledIds: Set<number>
): WatchProviderEntry[] {
  if (enabledIds.size === 0) return providers;
  return providers.filter((p) => enabledIds.has(p.provider_id));
}
