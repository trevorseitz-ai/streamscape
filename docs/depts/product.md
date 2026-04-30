# 🚀 Product & Features Office

## Product roadmap

### Discover Phase 1: Discovery & Stability — **COMPLETED**

- **Scope:** Discover default landing aligned across **Web, TV, and native**; **Stream Finder**-backed curation (synced catalog + provider availability); **TMDB** poster/backdrop enrichment; **mobile-web stability** (**viewport bucketing**, mount guards, stable auth effect deps).
- **Outcome:** Featured / “Top”-style landings no longer drift by surface; technical detail lives in [Web](web.md), [TV](tv.md), and [HQ](../../HQ.md).

### Hybrid data model — **project standard**

For all **Featured**, **Top**, and equivalent curated rails:

- **Stream Finder (→ Supabase cache):** **Primary curation** (e.g. top ~**300** titles) and **streaming availability** metadata for the default grid. Authoritative list membership and provider logos for the synced experience.
- **TMDB:** **Enrichment layer** — high-resolution **posters**, **backdrops**, and IDs; **TMDB Discover** when the user applies filters (year, genre, monetization, providers). TMDB is **not** the default ordering source for the unfiltered landing.

Operational implementation: [`lib/stream-finder-supabase.ts`](../../lib/stream-finder-supabase.ts) (read/cache), [`lib/services/stream-finder-sync.ts`](../../lib/services/stream-finder-sync.ts) (sync), [`lib/film-show-rapid-discover.ts`](../../lib/film-show-rapid-discover.ts) (TMDB image hydration). Departmental detail: `web.md`, `tv.md`.

### Core product features (spotlight)

| Feature | Description |
|:--------|:-------------|
| **Real-time streaming badges** | Curated Discover cards show **where a title streams** using provider logos from the **Stream Finder cache** (TMDB **w92**–sized logos + fallbacks), so users see availability at a glance without opening the detail sheet first. |

### Next priorities (roadmap)

1. **Watchlist syncing** — Reliable cross-device / cross-session watchlist state and conflict-safe updates (builds on Supabase `watchlist` + shared app patterns).
2. **Deep linking — tap a logo, open the app** — From a provider logo or “where to watch” control, **deeplink into the native streaming app** (or store / web fallback) where platform rules and partner URLs allow.

### Technical Constraints

| Area | Requirement |
|:-----|:-------------|
| **Mobile web viewport** | Layout and performance targets **390px–430px** widths (phone Safari / mobile browsers). **`app/+html.tsx`** sets viewport scale; Discover uses dense **3-column** grid **≤768px** (see breakpoints in [`web.md`](web.md#grid-breakpoints-discover-non-tv)). Use **`bucketViewportWidth`** ([`shared.md`](shared.md)) — raw fractional width must not drive grid math. |
| **Default Discover landing** | **Stream Finder cache** + TMDB imagery; TMDB **`/discover`** is for **filtered** queries once the user changes year / genre / monetization — see [`web.md`](web.md#data-architecture-sync). |
| **Profile “My services”** | Saved provider IDs are **auto-pruned** to **`stream_finder_providers`** after each sync so user choices never reference stale catalogs — see [`web.md`](web.md#profile--my-services--auto-pruning). |

---

## TV Technical Architecture

- **Navigation:** Left-rail UI via [`components/TvSidebarTabBar.tsx`](../../components/TvSidebarTabBar.tsx).
- **Focus management:** Custom bridge in [`lib/tv-search-focus-context.tsx`](../../lib/tv-search-focus-context.tsx) plus native tags from [`hooks/useTvNativeTag.ts`](../../hooks/useTvNativeTag.ts) to steer spatial navigation.
- **TV-first components:** [`components/HomeTvMovieRow.tsx`](../../components/HomeTvMovieRow.tsx) drives horizontal media rows with window-based poster sizing math.
