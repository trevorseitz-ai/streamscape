# 🏛️ Streamscape Headquarters — Lobby

> **Central directory.** Open a **department office** below for focused work, or use shared references. This file stays lightweight; deep context lives in `docs/depts/` and `docs/`.

---

## 📍 Current Phase

| Area | Status |
| :--- | :--- |
| **Android TV UI** | Refining Discover/Home layouts; follow `docs/tv_layout_rules.md`. |
| **Backend** | Supabase auth, profiles, watchlists; schema in `docs/database_schema.md`. |
| **Cross-platform** | **Triple stack deployed:** **Web**, **mobile (iOS/Android)**, and **Android TV** share one Expo Router codebase. **Phase 1: Discovery & Stability** is **100% COMPLETE** on all three—Discover + hybrid data + adaptive grids; verified scale **1,206** movies / **16** providers; see [`docs/depts/product.md`](docs/depts/product.md). |

_Update this table when priorities shift._

**Milestone — Phase 1: Discovery & Stability (**100% COMPLETE** — Web / Mobile / TV):** Same **Stream Finder** default Discover ships on browser, handset, and lean-back (**`GET /api/providers`** → **16** services; **`~1,206`** mirrored titles in Supabase checkpoints). **TMDB** enriches imagery; **`lib/viewport-utils.ts`** (**`bucketViewportWidth`**, **`discoverPosterGridColumns`**) + mount guards align density without layout thrash; Profile catalog + pruning match sync. Detail: **`web.md`**, **`product.md`**, **`tv.md`**.

---

## 🚧 Active Work-in-Progress

- **Discover Phase 1 — Discovery & Stability:** ✅ **100% COMPLETE** — **Web**, **mobile**, and **TV**; **1,206** movies / **16** providers; see [`docs/depts/product.md`](docs/depts/product.md).
- **Active roadmap:** **Phase 2 — User utility & bug squashing** (placeholder umbrella; includes watchlist sync, deep linking, polish)—see Product office.
- **Completed:** Validated TV/Web architecture and automated the Waitlist-to-Auth migration pipeline.
- **Current Focus:** Ensuring D-pad navigation "Focus Bridge" works across all Home screen rows.
- **Next Step:** See **Product** office — **Phase 2** (**user utility & bug squashing**): watchlist syncing, deep linking, and cross-surface polish; TV focus bridge continues per `tv.md`.

---

## 🗺️ Platform Map (ReelDive ecosystem)

Three product surfaces; each can ship on its own URL or store listing.

| Branch | What it is |
| :--- | :--- |
| **Waitlist Portal** | **https://getreeldive.com** — signup, positioning, and handoff to the app. Independent of the main Expo app origin (see Verified Ecosystem Map below). |
| **ReelDive Web** | Browser experience: account, libraries, discovery—**shared routes** with native and TV (**`app/`**). |
| **ReelDive Mobile** | **iOS / Android** handsets: same **Expo Router** tree, **Stream Finder** Discover, **viewport-utils** adaptive grids. |
| **ReelDive TV** | **Android TV** lean-back client — Expo/React Native, D-pad focus, sidebar navigation, `docs/tv_layout_rules.md`. |

_Add concrete URLs and repos here when they are finalized._

---

## Verified Ecosystem Map

Authoritative notes on how the pieces connect in this repo and in production.

- **Waitlist (frontend):** External portal at [getreeldive.com](https://getreeldive.com). No direct database write access to the waitlist from the main app; the app links out to that site.
- **ReelDive App (shared core):** Single **Expo Router** project: **Web**, **mobile (native)**, and **Android TV** use one **`app/`** tree—shared routes and components with **`Platform` / `isTvTarget`** guards where needed.
- **Authentication:** Centralized on **Supabase**. **Web** persists the session with **localStorage**; **TV / native** use **AsyncStorage** (via `lib/supabase.ts`).

---

## 🏢 Department Offices

Work in **one office at a time** so context stays clean. In Cursor, `@` the office file you’re in.

| Office | File | Focus |
| :--- | :--- | :--- |
| **Marketing & Brand** | [docs/depts/marketing.md](docs/depts/marketing.md) | Copy, positioning, acquisition, store listings, email. |
| **Product & Features** | [docs/depts/product.md](docs/depts/product.md) | Roadmap, specs, UX flows, prioritization. |
| **3D Design & Creative** | [docs/depts/creative.md](docs/depts/creative.md) | Blender, STL, visual/3D asset pipeline. |
| **Web App** | [docs/depts/web.md](docs/depts/web.md) | ReelDive Web: React/Expo web, responsive UI, browser UX. |
| **TV App** | [docs/depts/tv.md](docs/depts/tv.md) | Android TV: D-pad focus, sidebar, lean-back layout. |
| **Shared components** | [docs/depts/shared.md](docs/depts/shared.md) | Cross-surface primitives (e.g. `MovieRow` / viewport bucketing). |

---

## Engineering standards

### Core principles

1. **Stability first — viewport bucketing.** Treat **discretized width** as a first-class rule, not an optimization. Raw **`useWindowDimensions()`** on mobile Safari and mobile-web chrome causes fractional width churn; layout driven from that signal can **re-render in a loop** when combined with context identity churn (**session**, watchlists). **Always** bucket before poster/grid math via **`bucketViewportWidth`** in [`lib/viewport-utils.ts`](lib/viewport-utils.ts) (re-exported from [`components/MovieRow.tsx`](components/MovieRow.tsx)) — see [`docs/depts/shared.md`](docs/depts/shared.md) and [`docs/depts/web.md`](docs/depts/web.md#mobile-web-stability-standards).
2. **Mount guards for heavy work.** **`useRef`** one-shots (e.g. Stream Finder cache hydration on Discover) so expensive fetches do not re-run on every parent tick; use stable **`session?.user?.id`** or **`discoverAuthKey`** in dependency arrays instead of the full **`session`** object where applicable.

### Golden Rule — Stability first (detail)

**Use viewport bucketing and mount guards.**

High-jitter viewports (**mobile Safari**, mobile browsers with chrome inset) emit frequent **`useWindowDimensions()`** deltas. Driving layout math from raw width retriggers cascading re-renders and can spiral into infinite update loops—especially when combined with contexts that churn object identity (**session**, watchlists).

- **Discretize width:** Prefer **`bucketViewportWidth`** from [`lib/viewport-utils.ts`](lib/viewport-utils.ts) (10px buckets; re-exported from [`MovieRow`](components/MovieRow.tsx)) before poster/grid math — see [`docs/depts/shared.md`](docs/depts/shared.md) and [`docs/depts/web.md`](docs/depts/web.md#mobile-web-stability-standards).
- **Guard heavy async hydration:** **`useRef`** one-shot flags (e.g. Stream Finder default list fetch on Discover) ensure expensive work fires **once per mount**, regardless of upstream context churn; pair with stable **`session?.user?.id`** (or **`discoverAuthKey`**) in effect dependencies instead of the full **`session`** object where applicable.

### Hybrid data pillar (mandate)

| Layer | Role |
| :--- | :--- |
| **Stream Finder API → Supabase cache** | **Primary curation** for the default Discover experience and **streaming availability** / provider catalog (`stream_finder_movies`, `movie_availability`, `stream_finder_providers`). **Verified deployment scale:** **~1,206** titles and **16** providers in production mirror checkpoints. **`GET /api/providers`** is the **authoritative** roster; sync: `npm run sync:stream-finder` / [`lib/services/stream-finder-sync.ts`](lib/services/stream-finder-sync.ts). |
| **TMDB** | **Enrichment only** for the curated list — high-resolution **posters and backdrops** (and TMDB Discover when the user applies **filters**: year, genre, monetization, providers). Do not replace Stream Finder ordering for the **unfiltered** default landing. |

### Triple-Platform Adaptive Strategy

1. **`lib/viewport-utils.ts`** — Single source for **`bucketViewportWidth`** (10px stability) and **`discoverPosterGridColumns`** (**3 / 4 / 6** tiers). **Web**, **mobile**, and **Android TV Discover** share the same density rules: TV applies them to **usable row width** (after sidebar/padding); phone and browser use **bucketed screen width**. Prevents billboard-sized posters on 65" panels while keeping phone layouts dense.
2. **Native Android security (TV stability)** — Config plugin **`plugins/withAndroidNetworkSecurity.js`** (wired via [`app.config.ts`](app.config.ts)) sets **`android:usesCleartextTraffic`** and **`network_security_config`** (cleartext for Metro dev, HTTPS for Supabase in `.env`). After plugin or `.env` changes, native TV builds use **`npm run tv:clean`**. Detail: [`docs/depts/tv.md`](docs/depts/tv.md).

### Implementation choke points

Hybrid read path and TMDB enrichment: [`lib/stream-finder-supabase.ts`](lib/stream-finder-supabase.ts), [`lib/film-show-rapid-discover.ts`](lib/film-show-rapid-discover.ts).

#### Data Integrity Protocol — source of truth

**Data Integrity Protocol:** ReelDive serves as a **real-time mirror** of the Stream Finder API—metadata, counts, and availability in the app trace to what the upstream service exposes plus the latest sync write. **If expectations diverge**, the correction belongs at the **API source** (refresh cycle, ingestion, roster). ReelDive’s local database **re-aligns automatically** on the **next scheduled (or manual) sync** (**`npm run sync:stream-finder`**); do not treat hand-editing Supabase alone as fixing upstream truth.

---

## 🗄️ Data & Schema

- **Live database layout (auto-generated):** [docs/database_schema.md](docs/database_schema.md)  
  _Regenerate with `node scripts/sync-schema.js` when the RPC is set up._

---

## 📐 Shared engineering docs

- **TV layout rules:** [docs/tv_layout_rules.md](docs/tv_layout_rules.md)
- **User / waitlist migration:** [docs/user_migration.md](docs/user_migration.md)

---

## 🔗 Command center (external)

_(Replace placeholders with real URLs.)_

- **Supabase:** [Dashboard]
- **Deploy (Vercel / Expo):** [Hosting]
- **Design assets:** [Figma / Drive]

<!-- STREAM_FINDER_SYNC -->
### Stream Finder cache sync
- **Last successful run:** 2026-04-30T13:44:29.534Z — **1206** movies written to Supabase (`stream_finder_movies`).
- **Active Services:** **16** unique providers mirrored from authoritative **`GET /api/providers`** into `stream_finder_providers` (catalog includes flagship streamers plus niche / premium outlets—e.g. **AMC+, Shudder, Criterion Channel**—per upstream roster).
<!-- /STREAM_FINDER_SYNC -->
