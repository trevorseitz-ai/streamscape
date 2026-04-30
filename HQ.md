# 🏛️ Streamscape Headquarters — Lobby

> **Central directory.** Open a **department office** below for focused work, or use shared references. This file stays lightweight; deep context lives in `docs/depts/` and `docs/`.

---

## 📍 Current Phase

| Area | Status |
| :--- | :--- |
| **Android TV UI** | Refining Discover/Home layouts; follow `docs/tv_layout_rules.md`. |
| **Backend** | Supabase auth, profiles, watchlists; schema in `docs/database_schema.md`. |
| **Cross-platform** | **Web / TV / native parity** on Discover curated feed and hybrid pipeline. **Phase 1: Discovery & Stability** — **COMPLETE** (Stream Finder curation + mobile stability baseline; see [`docs/depts/product.md`](docs/depts/product.md)). |

_Update this table when priorities shift._

**Milestone — Phase 1: Discovery & Stability (COMPLETE):** Default Discover is fed from the **Stream Finder** cache (`stream_finder_movies` + provider availability); **TMDB** enriches imagery; **`bucketViewportWidth`** + mount guards lock in mobile-web stability; Profile provider grid and pruning match the synced catalog — detailed in **`web.md`**, **`product.md`**, **`tv.md`**.

---

## 🚧 Active Work-in-Progress

- **Discover Phase 1 — Discovery & Stability:** ✅ **COMPLETE** — see [`docs/depts/product.md`](docs/depts/product.md).
- **Completed:** Validated TV/Web architecture and automated the Waitlist-to-Auth migration pipeline.
- **Current Focus:** Ensuring D-pad navigation "Focus Bridge" works across all Home screen rows.
- **Next Step:** See **Product** office — *watchlist syncing* and *deep linking* (streaming logos → native apps) are the headline follow-ons; TV focus bridge and provider filtering remain in flight where noted in `tv.md` / `web.md`.

---

## 🗺️ Platform Map (ReelDive ecosystem)

Three product surfaces; each can ship on its own URL or store listing.

| Branch | What it is |
| :--- | :--- |
| **Waitlist Portal** | **https://getreeldive.com** — signup, positioning, and handoff to the app. Independent of the main Expo app origin (see Verified Ecosystem Map below). |
| **ReelDive Web** | Browser-based **management** experience: account, libraries, discovery, and admin-style workflows on desktop/tablet. |
| **ReelDive TV** | **Android TV** lean-back client — Expo/React Native, D-pad focus, sidebar navigation, `docs/tv_layout_rules.md`. |

_Add concrete URLs and repos here when they are finalized._

---

## Verified Ecosystem Map

Authoritative notes on how the pieces connect in this repo and in production.

- **Waitlist (frontend):** External portal at [getreeldive.com](https://getreeldive.com). No direct database write access to the waitlist from the main app; the app links out to that site.
- **ReelDive App (shared core):** Single **Expo Router** project: **Web** and **TV** are served from one `app/` directory (shared routes and components; platform guards where needed).
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

1. **Stability first — viewport bucketing.** Treat **discretized width** as a first-class rule, not an optimization. Raw **`useWindowDimensions()`** on mobile Safari and mobile-web chrome causes fractional width churn; layout driven from that signal can **re-render in a loop** when combined with context identity churn (**session**, watchlists). **Always** bucket before poster/grid math via **`bucketViewportWidth`** ([`components/MovieRow.tsx`](components/MovieRow.tsx)) — see [`docs/depts/shared.md`](docs/depts/shared.md) and [`docs/depts/web.md`](docs/depts/web.md#mobile-web-stability-standards).
2. **Mount guards for heavy work.** **`useRef`** one-shots (e.g. Stream Finder cache hydration on Discover) so expensive fetches do not re-run on every parent tick; use stable **`session?.user?.id`** or **`discoverAuthKey`** in dependency arrays instead of the full **`session`** object where applicable.

### Golden Rule — Stability first (detail)

**Use viewport bucketing and mount guards.**

High-jitter viewports (**mobile Safari**, mobile browsers with chrome inset) emit frequent **`useWindowDimensions()`** deltas. Driving layout math from raw width retriggers cascading re-renders and can spiral into infinite update loops—especially when combined with contexts that churn object identity (**session**, watchlists).

- **Discretize width:** Prefer **`bucketViewportWidth`** from [`components/MovieRow.tsx`](components/MovieRow.tsx) (10px buckets) before poster/grid math — see [`docs/depts/shared.md`](docs/depts/shared.md) and [`docs/depts/web.md`](docs/depts/web.md#mobile-web-stability-standards).
- **Guard heavy async hydration:** **`useRef`** one-shot flags (e.g. Stream Finder default list fetch on Discover) ensure expensive work fires **once per mount**, regardless of upstream context churn; pair with stable **`session?.user?.id`** (or **`discoverAuthKey`**) in effect dependencies instead of the full **`session`** object where applicable.

### Hybrid data pillar (mandate)

| Layer | Role |
| :--- | :--- |
| **Stream Finder API → Supabase cache** | **Primary curation** for the default Discover experience (e.g. top ~300 titles) and **streaming availability** / provider catalog (`stream_finder_movies`, `movie_availability`, `stream_finder_providers`). Sync: `npm run sync:stream-finder` / [`lib/services/stream-finder-sync.ts`](lib/services/stream-finder-sync.ts). |
| **TMDB** | **Enrichment only** for the curated list — high-resolution **posters and backdrops** (and TMDB Discover when the user applies **filters**: year, genre, monetization, providers). Do not replace Stream Finder ordering for the **unfiltered** default landing. |

Implementation choke points: [`lib/stream-finder-supabase.ts`](lib/stream-finder-supabase.ts) (read path), [`lib/film-show-rapid-discover.ts`](lib/film-show-rapid-discover.ts) (TMDB image enrichment for hybrid rows).

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
- **Last successful run:** 2026-04-30T01:16:19.483Z — **272** movies written to Supabase (`stream_finder_movies`).
- **Active Services:** 8 unique providers in Master Provider List (`stream_finder_providers`).
<!-- /STREAM_FINDER_SYNC -->
