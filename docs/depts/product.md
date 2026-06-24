# 🚀 Product & Features Office

**Path:** `docs/depts/product.md`

> **Launch handoff (human-readable, all departments):** [`docs/reeldive-launch-readiness-report-june-2026.md`](../reeldive-launch-readiness-report-june-2026.md) — **canonical launch report**. Sections will migrate into each department office over time; until then, start there for takeover.
>
> **Companion docs:** [`HQ.md`](../../HQ.md) · [`reeldive_state.md`](../../reeldive_state.md) · [`docs/infrastructure.md`](../infrastructure.md) · [`assistant.md`](../../assistant.md) · [`docs/depts/qa.md`](qa.md) · [`docs/depts/marketing.md`](marketing.md)

**Checkpoint (June 2026):** `web-tv-parity-6-4` @ `2aee612` — Web + Android TV engineering launch-ready; **public launch not shipped** (store, QA, GTM gaps).

---

## Launch readiness (June 2026)

> **Master report:** [`docs/reeldive-launch-readiness-report-june-2026.md`](../reeldive-launch-readiness-report-june-2026.md) — full cross-department narrative. This section is the **Product office** slice.

**Report date:** June 7, 2026 · **Public launch:** Not shipped

### Phases

**Phase 1 — Discovery & Stability — COMPLETE**

Shared six-tab app (Home, Search, Watchlist, Watched, Discover, Profile) on Web, mobile browsers, and Android TV. Default Discover from Stream Finder in Supabase. Viewport bucketing fixed mobile web thrash. Profile “My Services” prunes to 16 synced providers.

**Phase 2 — User utility & bug squashing — IN PROGRESS**

Recently shipped: **1–5 star ratings** on Watched; **16:9 trailer player** on Web and TV; movie detail parity (cast, IMDb/RT/Metacritic, provider logos); Maestro trailer test on TV emulator.

Still open: Google TV store submission; TV Focus Bridge on Home; watched data model cleanup; deep linking (16 providers); separate phone vs TV Android builds.

**Monetization — PLANNED ONLY** — spec exists, nothing built. Do not promise paid features in launch copy.

### What users can do today

| Capability | Web | Android TV | Phone* |
| :--- | :---: | :---: | :---: |
| Sign in / sign up | Yes | Yes | Yes |
| Browse Discover (~1.2k titles) | Yes | Yes | Yes |
| Filter Discover (TMDB) | Yes | Yes | Yes |
| Search / Watchlist / Watched + ratings | Yes | Yes | Yes |
| Movie detail, cast, trailers | Yes | Yes | Yes |
| “Watch on” / open streamer app | Partial | Best | Partial |
| In-app playback / Paywall | No | No | No |

\*Phone builds compile but are **not** a launch target (`android.isTV: true` today).

### Launch-critical product issue

Global “watched” toggle in [`lib/watchlist-status-context.tsx`](../../lib/watchlist-status-context.tsx) writes **`watched_history`**. Watched tab + ratings use **`user_library`**. **Fix or document a waiver before launch.**

### Product-owned launch tasks (P0)

- Merge `web-tv-parity-6-4` → `main` and tag RC  
- Resolve or waive `watched_history` / `user_library` split  
- Ship date in [`marketing.md`](marketing.md) OR explicit soft launch (no countdown)  
- Web GA decision: full app vs Coming soon — implement if needed  

### Product priority queue (next 30 days)

1. PR + merge `web-tv-parity-6-4` → `main`  
2. Watched data model decision + fix  
3. Coordinate physical TV QA + Play submission with TV/QA  
4. Web go-live decision with Marketing  

### Cross-surface readiness (summary)

| Surface | Overall |
| :--- | :--- |
| Web | 🟡 Yellow |
| Android TV | 🟡 Yellow / 🔴 store |
| Mobile handset | 🔴 Red — not a launch target |

Dept detail: [Web](web.md#launch-readiness-june-2026) · [TV](tv.md#launch-readiness-june-2026) · [Mobile](ios-rules.md#launch-readiness-june-2026) · [QA](qa.md#launch-readiness-june-2026) · [Marketing](marketing.md#launch-readiness-june-2026)

---

## Product snapshot (condensed)

| Phase | Status |
| :--- | :--- |
| **Phase 1 — Discovery & Stability** | ✅ Complete |
| **Phase 2 — User utility & bug squashing** | 🟡 In progress |
| **Public launch (Web + Android TV)** | 🔴 Not shipped |

**Launch surfaces:** Web + Android TV (engineering-ready). Handset stores **TBD**. No public ship date in [`marketing.md`](marketing.md).

**Top blockers:** Play store submission · physical TV QA · merge `web-tv-parity-6-4` → `main` · marketing screenshots · `watched_history` / `user_library` split.

**Readiness (summary):** Web 🟡 · Android TV 🟡/🔴 (store) · Mobile handset 🔴 (not a launch target).

Cross-department detail: [Web](web.md#launch-readiness-june-2026) · [TV](tv.md#launch-readiness-june-2026) · [QA](qa.md#launch-readiness-june-2026) · [Marketing](marketing.md#launch-readiness-june-2026) · Master report: [`docs/reeldive-launch-readiness-report-june-2026.md`](../reeldive-launch-readiness-report-june-2026.md).

---

## Technology stack

- Expo / Expo Router · React Native · React Native Web · TypeScript · Supabase · Stream Finder · TMDB · Android TV

**Onboarding:** [`docs/IOS_NATIVE_DEVELOPER_ONBOARDING.md`](../IOS_NATIVE_DEVELOPER_ONBOARDING.md) · [`docs/NATIVE_OPERATIONAL_URLS.md`](../NATIVE_OPERATIONAL_URLS.md) · [`docs/depts/ios-rules.md`](ios-rules.md) · [`eas.json`](../../eas.json)

---

## Product roadmap (reference)

### Commercial launch posture (GTM vs engineering)

Engineering ships **one Expo codebase** spanning **Web**, **TV**, **iOS/Android handsets**. **Outbound / store timing** differs: **Web** + **Android TV** are **launch-ready surfaces** at product launch per **`docs/depts/marketing.md`**. **iOS** App Store + **Android** Play handset releases are **TBD**.

**Web ↔ Android TV (parity):** **[`docs/depts/web-tv-parity.md`](web-tv-parity.md)**

### Discover Phase 1 — **100% COMPLETE**

Stream Finder default Discover, **~1,206** titles, **16** providers, TMDB enrichment, six-tab shell, viewport bucketing — Web, mobile, TV.

### Phase 2 — **IN PROGRESS**

Delivered: Watched **1–5 star ratings**; movie-detail parity (cast, IMDb, trailers, **16:9 player**); provider-logo parity; migration consolidation.

Active workstreams: watchlist sync semantics, deep linking (16 providers), watched data cleanup, Google TV submission, Focus Bridge, handset build split, bug squashing.

---

## Monetization & paywall — **PLANNED (not built)**

| Rule | Detail |
| :--- | :--- |
| **Paywall scope** | Features TBD (ratings, watchlist depth, filters, export, etc.) |
| **Launch trial** | 1 calendar month full access after signup |
| **Post-trial** | Real free tier limits |
| **Data retention** | 2 weeks grace if no upgrade; deletion policy TBD |

Open decisions: feature gates, billing provider, copy, TV/web parity on gates. Track in [`assistant.md`](../../assistant.md).

Engineering touchpoints when built: [`docs/infrastructure.md`](../infrastructure.md).

---

## Hybrid data model — **project standard**

- **Stream Finder → Supabase:** Primary curation + availability (**16** providers, **~1,206** titles at last sync).
- **TMDB:** Enrichment (posters, backdrops, filtered discover). **Not** default ordering for unfiltered landing.

Implementation: [`lib/stream-finder-supabase.ts`](../../lib/stream-finder-supabase.ts), [`lib/services/stream-finder-sync.ts`](../../lib/services/stream-finder-sync.ts), [`lib/film-show-rapid-discover.ts`](../../lib/film-show-rapid-discover.ts).

---

## Core product features (spotlight)

| Feature | Status |
|:--------|:--------|
| **Universal accessibility (TV / Web / Mobile)** | ✅ Single codebase, Stream Finder + TMDB hybrid |
| **Watched personal ratings** | ✅ Shipped June 2026 — `user_library.personal_rating` |
| **Streaming Service Integration** | ✅ 16 providers via Stream Finder mirror |
| **Real-time streaming badges** | ✅ Discover cards show provider logos from cache |
| **16:9 trailer modal** | ✅ Shipped June 2026 — [`lib/trailerLayout.ts`](../../lib/trailerLayout.ts) |

---

## Technical constraints

| Area | Requirement |
|:-----|:-------------|
| **Mobile web viewport** | **390px–430px**; use **`bucketViewportWidth`** before grid math |
| **Default Discover** | Stream Finder cache; TMDB Discover only when filtered |
| **Profile “My services”** | Auto-prune to **`stream_finder_providers`** after sync |
| **Android TV grid** | Fixed **140×210**, **5** columns, **20px** gap — [`docs/depts/tv.md`](tv.md) |

---

## TV technical architecture (pointer)

Navigation: [`components/TvSidebarTabBar.tsx`](../../components/TvSidebarTabBar.tsx) · Focus: [`lib/tv-search-focus-context.tsx`](../../lib/tv-search-focus-context.tsx) · Layout law: [`docs/tv_layout_rules.md`](../tv_layout_rules.md)

---

*Last updated: 2026-06-07 — full launch narrative: [`reeldive-launch-readiness-report-june-2026.md`](../reeldive-launch-readiness-report-june-2026.md). Regenerate both after store submission, `main` merge, or major Phase 2 milestone.*
