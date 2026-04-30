# 🚀 Product & Features Office

## Product roadmap

### Discover Phase 1: Discovery & Stability — **100% COMPLETE** (Web / Mobile / TV)

- **Scope:** Discover default landing aligned across **browser**, **native handsets**, and **Android TV**; **Stream Finder**-backed curation (synced catalog + provider availability—**16** mirrored providers); **TMDB** poster/backdrop enrichment; **adaptive viewport utils** (**`bucketViewportWidth`**, **`discoverPosterGridColumns`**) + mount guards + stable auth effect deps.
- **Outcome:** Featured / “Top”-style landings and **~1,206** mirrored titles at scale; technical detail in [Web](web.md), [TV](tv.md), and [HQ](../../HQ.md).

### Phase 2: User utility & bug squashing — **NEXT** (placeholder)

Umbrella milestone after triple-platform stability: **UX polish**, **reliability fixes**, and utilities that make daily use smoother—while keeping **Phase 1** contracts (Stream Finder order, `viewport-utils`, TV network policy) intact.

### Phase 2 workstreams (initial)

1. **Watchlist syncing** — Reliable cross-device / cross-session watchlist state and conflict-safe updates (builds on Supabase `watchlist` + shared app patterns), scoped to coexist with **all 16 supported services**.
2. **Deep linking — tap a logo, open the app** — From a provider logo or “where to watch” control, **deeplink into the native streaming app** (or store / web fallback), **covering each of the 16 mirrored providers** where platform rules and partner URLs allow.
3. **Bug squashing & UX polish** — Ongoing defects, regressions on any of the three targets, empty/error states, and performance follow-ups surfaced in QA.

### Hybrid data model — **project standard**

For all **Featured**, **Top**, and equivalent curated rails:

- **Stream Finder (→ Supabase cache):** **Primary curation** (e.g. top ~**300** titles) and **streaming availability** metadata for the default grid at **mirror scale** (e.g. **1,206** synced titles in production checkpoints). **Canonical provider list:** **`GET /api/providers`** → **`stream_finder_providers`** (**16** providers: mainstream plus niche/premium catalogs such as **AMC+, Shudder, Criterion Channel**—exact roster is whatever upstream publishes).
- **TMDB:** **Enrichment layer** — high-resolution **posters**, **backdrops**, and IDs; **TMDB Discover** when the user applies filters (year, genre, monetization, providers). TMDB is **not** the default ordering source for the unfiltered landing.

Operational implementation: [`lib/stream-finder-supabase.ts`](../../lib/stream-finder-supabase.ts) (read/cache), [`lib/services/stream-finder-sync.ts`](../../lib/services/stream-finder-sync.ts) (sync), [`lib/film-show-rapid-discover.ts`](../../lib/film-show-rapid-discover.ts) (TMDB image hydration). Departmental detail: `web.md`, `tv.md`.

### Core product features (spotlight)

| Feature | Description |
|:--------|:-------------|
| **Universal accessibility (TV / Web / Mobile)** | **Completed** — Single Expo Router codebase ships **Web**, **iOS/Android**, and **Android TV** with shared Discover/Profile/Movie flows; **Stream Finder + TMDB** hybrid stack; **`lib/viewport-utils.ts`** adaptive **3 / 4 / 6** grid; TV native **`withAndroidNetworkSecurity`** + **`tv:clean`** workflow documented in [TV](tv.md). |
| **Streaming Service Integration** | **Verified & live** — Discover and Profile use the **Stream Finder** provider catalog mirrored from **`GET /api/providers`**. **Profile → “My services”** reflects the synced roster with auto-pruning. |
| **Comprehensive Provider Coverage** | **✅ Completed (scale milestone)** — **16 active providers** mirrored from the authoritative API—including flagship streamers and niche/premium catalogs upstream ships (**AMC+, Shudder, Criterion Channel**, etc.)—surfaced consistently across **Discover** and **Profile**. |
| **Real-time streaming badges** | Curated Discover cards show **where a title streams** using provider logos from the **Stream Finder cache** (TMDB **w92**–sized logos + **generic SVG fallback** when the API omits a logo), so users see availability at a glance without opening the detail sheet first. |

### Technical Constraints

| Area | Requirement |
|:-----|:-------------|
| **Mobile web viewport** | Layout and performance targets **390px–430px** widths (phone Safari / mobile browsers). **`app/+html.tsx`** sets viewport scale; Discover uses **3 / 4 / 6** tiers from **`discoverPosterGridColumns`** after **`bucketViewportWidth`** (**≥900 → 6**, **≥600 → 4**, else **3**; see **Adaptive Discover grid** in [`web.md`](web.md)). Use **`bucketViewportWidth`** ([`shared.md`](shared.md)) — raw fractional width must not drive grid math. |
| **Default Discover landing** | **Stream Finder cache** + TMDB imagery; TMDB **`/discover`** is for **filtered** queries once the user changes year / genre / monetization — see [`web.md`](web.md#data-architecture-sync). |
| **Profile “My services”** | Saved provider IDs are **auto-pruned** to **`stream_finder_providers`** (mirrored from **`GET /api/providers`**) after each sync; the UI reflects the **full 16-provider** roster from the Stream Finder backend at this milestone — see [`web.md`](web.md#profile--my-services--auto-pruning). |

---

## TV Technical Architecture

- **Navigation:** Left-rail UI via [`components/TvSidebarTabBar.tsx`](../../components/TvSidebarTabBar.tsx).
- **Focus management:** Custom bridge in [`lib/tv-search-focus-context.tsx`](../../lib/tv-search-focus-context.tsx) plus native tags from [`hooks/useTvNativeTag.ts`](../../hooks/useTvNativeTag.ts) to steer spatial navigation.
- **TV-first components:** [`components/HomeTvMovieRow.tsx`](../../components/HomeTvMovieRow.tsx) drives horizontal media rows with window-based poster sizing math.
