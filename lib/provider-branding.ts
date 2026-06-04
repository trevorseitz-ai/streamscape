import type { CachedProvider } from './watch-provider-cache';

/**
 * TMDB models each brand/tier as a separate watch provider (e.g. Amazon Prime
 * Video, Amazon Video [rent/buy], Amazon Prime Video with Ads). This module
 * collapses those siblings down to a single brand so the Watchlist shows one
 * icon per service, and reports the underlying member ids so the UI can
 * highlight brands the user is subscribed to (any tier counts).
 */

/** Satellite / legacy provider ids folded onto a canonical brand id. */
const PROVIDER_ID_ALIASES: Record<number, number> = {
  10: 9, // Amazon Video (rent/buy) -> Amazon Prime Video
  2100: 9, // Amazon Prime Video with Ads -> Amazon Prime Video
  2: 350, // Apple TV (rent/buy) -> Apple TV
  1796: 8, // Netflix Standard with Ads -> Netflix
  384: 1899, // HBO Max -> Max
  24: 1899, // legacy Max -> Max
  1770: 531, // Paramount+ with Showtime -> Paramount+
  387: 386, // Peacock Premium Plus -> Peacock Premium
};

/** Name fragments → canonical brand id (catches tier variants sharing a name). */
const BRAND_NAME_NEEDLES: { needle: string; id: number }[] = [
  { needle: 'netflix', id: 8 },
  { needle: 'amazon prime', id: 9 },
  { needle: 'prime video', id: 9 },
  { needle: 'amazon video', id: 9 },
  { needle: 'hulu', id: 15 },
  { needle: 'disney', id: 337 },
  { needle: 'hbo max', id: 1899 },
  { needle: 'max', id: 1899 },
  { needle: 'paramount', id: 531 },
  { needle: 'peacock', id: 386 },
  { needle: 'apple tv', id: 350 },
  { needle: 'crunchyroll', id: 283 },
  { needle: 'amc', id: 526 },
  { needle: 'shudder', id: 99 },
  { needle: 'criterion', id: 258 },
  { needle: 'mubi', id: 11 },
  { needle: 'discovery', id: 520 },
  { needle: 'fubo', id: 257 },
  { needle: 'tubi', id: 222 },
  { needle: 'pluto', id: 300 },
  { needle: 'starz', id: 43 },
];

/** Strip tier/format qualifiers so untracked siblings still collapse by name. */
function normalizeBrandName(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /\b(with ads|standard with ads|ads|premium plus|premium|plus|free|channel|amazon|apple|uhd|4k|hd)\b/g,
      ' '
    )
    .replace(/\+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

interface BrandResolution {
  key: string;
  /** Canonical TMDB brand id when recognized, else null. */
  brandId: number | null;
}

function resolveBrand(provider: CachedProvider): BrandResolution {
  const hay = (provider.provider_name ?? '').toLowerCase();
  for (const { needle, id } of BRAND_NAME_NEEDLES) {
    if (hay.includes(needle)) return { key: `id:${id}`, brandId: id };
  }
  const canonical = PROVIDER_ID_ALIASES[provider.provider_id] ?? provider.provider_id;
  const norm = normalizeBrandName(provider.provider_name ?? '');
  if (norm) return { key: `name:${norm}`, brandId: canonical };
  return { key: `id:${canonical}`, brandId: canonical };
}

export interface BrandedProvider {
  /** Stable de-dupe key for this brand (React key). */
  brandKey: string;
  /** Canonical TMDB brand id when recognized, else null. */
  brandId: number | null;
  /** Logo of the representative (brand) entry. */
  logo_path: string | null;
  /** All TMDB provider ids that fold into this brand (any tier). */
  memberIds: number[];
}

/**
 * Collapse a title's TMDB providers to one entry per brand. Picks the brand
 * entry's logo (preferring the canonical id, else the shortest name, which is
 * typically the base brand rather than a "… with Ads" variant).
 */
export function groupProvidersByBrand(
  providers: CachedProvider[]
): BrandedProvider[] {
  const groups = new Map<
    string,
    { brandId: number | null; members: CachedProvider[] }
  >();

  for (const p of providers) {
    const { key, brandId } = resolveBrand(p);
    const existing = groups.get(key);
    if (existing) {
      existing.members.push(p);
      if (existing.brandId == null && brandId != null) existing.brandId = brandId;
    } else {
      groups.set(key, { brandId, members: [p] });
    }
  }

  const out: BrandedProvider[] = [];
  for (const [brandKey, { brandId, members }] of groups) {
    const withLogo = members.filter((m) => m.logo_path);
    const pool = withLogo.length > 0 ? withLogo : members;
    const representative =
      (brandId != null && pool.find((m) => m.provider_id === brandId)) ||
      [...pool].sort(
        (a, b) => (a.provider_name?.length ?? 0) - (b.provider_name?.length ?? 0)
      )[0] ||
      members[0];
    out.push({
      brandKey,
      brandId,
      logo_path: representative?.logo_path ?? null,
      memberIds: members.map((m) => m.provider_id),
    });
  }

  return out;
}

/** True when the user subscribes to any tier of this brand. */
export function isBrandEnabled(
  brand: BrandedProvider,
  enabledIds: Set<number>
): boolean {
  if (brand.brandId != null && enabledIds.has(brand.brandId)) return true;
  return brand.memberIds.some((id) => enabledIds.has(id));
}
