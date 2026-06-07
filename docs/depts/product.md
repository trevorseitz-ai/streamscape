# 🚀 Product & Features Office

## Technology stack

- Expo / Expo Router
- React Native
- React / React Native Web
- TypeScript
- Supabase
- Stream Finder
- TMDB
- Android TV

**Native iOS / handset onboarding** (secrets to request, operational URLs **`/api/*`**, repos, dashboards): **[`docs/IOS_NATIVE_DEVELOPER_ONBOARDING.md`](../IOS_NATIVE_DEVELOPER_ONBOARDING.md)** · **[`docs/NATIVE_OPERATIONAL_URLS.md`](../NATIVE_OPERATIONAL_URLS.md)** · **engineering rules**: **[`docs/depts/ios-rules.md`](ios-rules.md)** · **EAS template**: **[`eas.json`](../../eas.json)**.

## Product roadmap

### Commercial launch posture (GTM vs engineering)

Engineering ships **one Expo codebase** spanning **Web**, **TV**, **iOS/Android handsets**. **Outbound / store timing** differs: **Web** + **Android TV** are **launch-ready surfaces** at product launch per **`docs/depts/marketing.md`**. **iOS** App Store + **Android** Play handset releases are **TBD** until dated in Product + Marketing bible—do **not** promise simultaneous handset storefronts externally.

**Web ↔ Android TV (parity):** **[`docs/depts/web-tv-parity.md`](web-tv-parity.md)** — what both surfaces share, shared user state, and per-surface limitations ( grids, inputs, framing for copy).

**Pre-GA hosted web UX:** **`docs/depts/web.md`** + **`docs/depts/marketing.md`** describe **Coming soon** vs **announcement countdown** (**no date in public copy until dated in Marketing bible).** FAQs: **`docs/marketing/FAQ.md`** (dual-stewarded with **getreeldive.com**).

### Current product state (June 2026)

**Phase 1 (Discovery & Stability)** remains **complete** on Web, mobile, and Android TV. **Phase 2 (User utility & bug squashing)** is **in progress** — first concrete utilities are shipping on branch **`web-tv-parity-6-4`**.

| Surface | Status | Notes |
|---------|--------|-------|
| **Web** | **Launch-ready engineering** | Full tab shell, Stream Finder Discover, auth, watchlist, watched shelf + ratings, movie detail. Pre-GA hosting posture per **`web.md`** / **`marketing.md`**. |
| **Android TV** | **Launch-ready engineering, active polish** | Lean-back shell, fixed poster grid, D-pad focus across major tabs. Recent parity pass: cast nav safety, IMDb chip, release-TV trailer reliability, Watched ratings. **Focus Bridge** on Home rows still WIP in **`HQ.md`**. |
| **iOS / Android handset** | **Same codebase, storefront TBD** | Builds from shared tree; **`android.isTV: true`** conflates handset vs TV shell — split profiles needed before public handset launch. |
| **Google TV / Play (TV)** | **Pre-submission** | Release signing, permissions cleanup, signed AAB, store listing assets — not yet closed. |

**Shipped recently (Phase 2 kickoff):** Watched **1–5 star ratings**; web/TV movie-detail parity (cast, IMDb, trailers); Watchlist/Watched provider-logo parity; migration consolidation under **`supabase/migrations`**.

**Known gaps:** **`watched_history`** vs **`user_library`** split (ratings/stats use **`user_library`**; global watched toggle still writes **`watched_history`**); re-rate from movie detail deferred to Watched tab; handset/TV build flavors not split; CI Maestro not committed; Google TV store blockers open.

### Discover Phase 1: Discovery & Stability — **100% COMPLETE** (Web / Mobile / TV)

- **Scope:** Discover default landing aligned across **browser**, **native handsets**, and **Android TV**; **Stream Finder**-backed curation (synced catalog + provider availability—**16** mirrored providers); **TMDB** poster/backdrop enrichment; **adaptive viewport utils** (**`bucketViewportWidth`**, **`discoverPosterGridColumns`**) + mount guards + stable auth effect deps.
- **Outcome:** Featured / “Top”-style landings and **~1,206** mirrored titles at scale; technical detail in [Web](web.md), [TV](tv.md), [Web ↔ TV parity](web-tv-parity.md), and [HQ](../../HQ.md).
- **Phase 1 shell — clutter-free:** The main navigator has **six** substantive tabs only (**Home → Search → Watchlist → Watched → Discover → Profile**). Placeholder **Account** UI and **`app/(tabs)/account.tsx`** are **removed** so Phase 1 ships without empty shells; the experience is **ready for Phase 2** feature expansion without tab-bar debt.

### UX strategy — Profile as anchor

**Profile** is the **rightmost** tab on phone / web and the **bottom** slot on the TV sidebar—fixed “settings & identity” real estate. Users expect account-adjacent actions (services, preferences, sign-out where applicable) **there**, not in a separate dead-end tab. **Sign in** stays on **`/login`**; **`HQ.md`** documents the **no-empty-placeholder** policy for future routes.

### Phase 2: User utility & bug squashing — **IN PROGRESS**

Umbrella milestone after triple-platform stability: **UX polish**, **reliability fixes**, and utilities that make daily use smoother—while keeping **Phase 1** contracts (Stream Finder order, `viewport-utils`, TV network policy) intact.

**Delivered so far:** Watched **1–5 star ratings**, web/TV movie-detail parity (cast, IMDb, trailers), Watchlist/Watched provider-logo parity, migration consolidation.

### Phase 2 workstreams (active + queued)

1. **Watchlist syncing** — Reliable cross-device / cross-session watchlist state and conflict-safe updates (builds on Supabase `watchlist` + shared app patterns), scoped to coexist with **all 16 supported services**.
2. **Deep linking — tap a logo, open the app** — From a provider logo or “where to watch” control, **deeplink into the native streaming app** (or store / web fallback), **covering each of the 16 mirrored providers** where platform rules and partner URLs allow. **Android TV furthest along**; iOS/web incomplete.
3. **Watched data model cleanup** — Decide whether **`watched_history`** merges into **`user_library`** or stays analytics-only; align the global watched toggle with the Watched tab source of truth.
4. **Google TV store submission** — Release signing, permissions audit, signed AAB, store listing assets, on-device QA pass.
5. **TV Focus Bridge (Home rows)** — Close D-pad handoff across all Home horizontal rails per **`HQ.md`** WIP.
6. **Handset build split** — Separate Expo/EAS profiles so **`isTvTarget()`** is false on phone/tablet builds.
7. **Bug squashing & UX polish** — Ongoing defects, regressions on any of the three targets, empty/error states, and performance follow-ups surfaced in QA.

### Hybrid data model — **project standard**

For all **Featured**, **Top**, and equivalent curated rails:

- **Stream Finder (→ Supabase cache):** **Primary curation** (e.g. top ~**300** titles) and **streaming availability** metadata for the default grid at **mirror scale** (e.g. **1,206** synced titles in production checkpoints). **Canonical provider list:** **`GET /api/providers`** → **`stream_finder_providers`** (**16** providers: mainstream plus niche/premium catalogs such as **AMC+, Shudder, Criterion Channel**—exact roster is whatever upstream publishes).
- **TMDB:** **Enrichment layer** — high-resolution **posters**, **backdrops**, and IDs; **TMDB Discover** when the user applies filters (year, genre, monetization, providers). TMDB is **not** the default ordering source for the unfiltered landing.

Operational implementation: [`lib/stream-finder-supabase.ts`](../../lib/stream-finder-supabase.ts) (read/cache), [`lib/services/stream-finder-sync.ts`](../../lib/services/stream-finder-sync.ts) (sync), [`lib/film-show-rapid-discover.ts`](../../lib/film-show-rapid-discover.ts) (TMDB image hydration). Departmental detail: `web.md`, `tv.md`.

### Core product features (spotlight)

| Feature | Description |
|:--------|:-------------|
| **Universal accessibility (TV / Web / Mobile)** | **Completed** — Single Expo Router codebase ships **Web**, **iOS/Android**, and **Android TV** with shared Discover/Profile/Movie flows; **Stream Finder + TMDB** hybrid stack; **`lib/viewport-utils.ts`** adaptive **3 / 4 / 6** grid; TV native **`withAndroidNetworkSecurity`** + **`tv:clean`** workflow documented in [TV](tv.md). **Web × TV parity sheet:** **[`web-tv-parity.md`](web-tv-parity.md)**. |
| **Watched personal ratings** | **✅ Shipped (June 2026)** — 1–5 star ratings on **`user_library`**; picker on **Watched** tab rows and on **Add to Watched** from movie detail; stats header on 1–5 scale. Cross-platform modal (Web click/hover, TV D-pad). Detail: [TV — Watched tab](tv.md#watched-tab-layout-apptabswatchedtsx). |
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

- **Navigation:** Left-rail UI via [`components/TvSidebarTabBar.tsx`](../../components/TvSidebarTabBar.tsx) — **six** slots (**`TV_SIDEBAR_SLOTS`**), same order as handset/Web tabs with **Profile** at the **bottom** anchor; no separate **Account** slot (auth via **`/login`** + **Profile**)—see **Left rail slots** in [TV](tv.md).
- **Focus management:** Custom bridge in [`lib/tv-search-focus-context.tsx`](../../lib/tv-search-focus-context.tsx) plus native tags from [`hooks/useTvNativeTag.ts`](../../hooks/useTvNativeTag.ts) to steer spatial navigation.
- **TV-first components:** [`components/HomeTvMovieRow.tsx`](../../components/HomeTvMovieRow.tsx) drives horizontal media rows with window-based poster sizing math.

---

## What’s next (priority order — June 2026)

Use this as the working queue until **`HQ.md`** priorities are updated.

| Priority | Item | Owner hint |
|:--------:|------|------------|
| **1** | **Google TV store submission** — signed AAB, permissions, listing assets, on-device smoke | Product + TV |
| **2** | **Manual TV QA pass** — Watched ratings, movie detail add-flow, cast nav, trailers on release build | QA / TV |
| **3** | **Watched data model cleanup** — align global watched toggle with **`user_library`** | Product + backend |
| **4** | **TV Focus Bridge (Home)** — finish cross-row D-pad on Home rails | TV |
| **5** | **Handset build split** — separate TV vs phone Expo profiles | Engineering |
| **6** | **Phase 2 deep linking** — extend Android TV intent matrix to iOS universal links | Product + TV |
| **7** | **Watchlist cross-device sync semantics** — conflict-safe ordering | Product + backend |

**Not planned for immediate v1:** inline re-rate control on movie detail action row (re-edit stays on Watched tab unless user feedback demands it).
