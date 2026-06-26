# 🏛️ ReelDive Headquarters — Lobby

> **Central directory.** Open a **department office** below for focused work, or use shared references. This file stays lightweight; deep context lives in `docs/depts/` and `docs/`.
>
> **Legacy product name:** If you still see **StreamScape** somewhere, check [`HQ/streamscape-remnants-map.md`](HQ/streamscape-remnants-map.md) (intentional vs planned renames).
>
> **Session handoff (agent / dev):** [`assistant.md`](assistant.md) — what we did last session and what’s next.
>
> **Launch readiness (all departments, human-readable):** [`docs/reeldive-launch-readiness-report-june-2026.md`](docs/reeldive-launch-readiness-report-june-2026.md)

---

## 📍 Current Phase

| Area | Status |
| :--- | :--- |
| **Android TV UI** | Refining Discover/Home layouts + D-pad Focus Bridge; follow `docs/tv_layout_rules.md`. **Watched ratings** + **trailer 16:9 modal** shipped — see [`docs/depts/tv.md`](docs/depts/tv.md). |
| **Backend** | Supabase auth, profiles, watchlists, **`user_library`** (Watched shelf + ratings); schema in `docs/database_schema.md`. Migrations: **`supabase/migrations/`** only. |
| **Cross-platform** | **Triple stack deployed:** **Web**, **mobile (iOS/Android)**, and **Android TV** share one Expo Router codebase. **Phase 1: Discovery & Stability** is **100% COMPLETE**; **Phase 2** is **in progress** (ratings, parity fixes)—see [`docs/depts/product.md`](docs/depts/product.md). **Web × TV parity:** [`docs/depts/web-tv-parity.md`](docs/depts/web-tv-parity.md). **State audit:** [`reeldive_state.md`](reeldive_state.md). |

_Update this table when priorities shift._

**Milestone — Phase 1: Discovery & Stability (**100% COMPLETE** — Web / Mobile / TV):** Same **Stream Finder** default Discover ships on browser, handset, and lean-back (**`GET /api/providers`** → **16** services; **`~1,206`** mirrored titles in Supabase checkpoints). **TMDB** enriches imagery; **`lib/viewport-utils.ts`** (**`bucketViewportWidth`**, **`discoverPosterGridColumns`**) + mount guards align density without layout thrash; Profile catalog + pruning match sync. Detail: **`web.md`**, **`product.md`**, **`tv.md`**, **`docs/depts/web-tv-parity.md`**.

---

## 🚧 Active Work-in-Progress

- **Discover Phase 1 — Discovery & Stability:** ✅ **100% COMPLETE** — **Web**, **mobile**, and **TV**; **1,206** movies / **16** providers; see [`docs/depts/product.md`](docs/depts/product.md).
- **Autonomous audit pipeline:** ✅ **100% COMPLETE** — **`npm run report:qa`** ([`scripts/generate-qa-report.ts`](scripts/generate-qa-report.ts)): **`check:env-security`** + **`test:smoke-maestro`**, **`qa-audit-summary.json`**, optional **Resend** email (**`RESEND_API_KEY`**, **`REPORT_EMAIL`**). Schedule and CI notes: [`docs/depts/qa.md`](docs/depts/qa.md) (**08:00 UTC** cron **`0 8 * * *`**).
- **Active roadmap:** **Phase 2 — User utility & bug squashing** (**in progress**) — Watched **1–5 star ratings** shipped; web/TV movie-detail parity (cast, IMDb, trailers, **16:9 trailer modal**); migration consolidation. See [`docs/depts/product.md`](docs/depts/product.md).
- **Completed (June 2026):** Watched personal ratings; Stream Finder migration unification; movie-detail parity pass; **trailer 16:9 layout + Maestro E2E** on branch **`web-tv-parity-6-4`** (`a21fb63`).
- **Current Focus:** Google TV store prep + manual TV QA; D-pad **Focus Bridge** on Home rows.
- **Next Step:** See **Product** office — [Pre-launch plan (workable task list)](docs/depts/product.md#pre-launch-plan--workable-task-list-june-2026).

---

## 🗺️ Platform Map (ReelDive ecosystem)

Four delivery surfaces (**four pillars** / matrix in **`docs/depts/marketing.md`**). **Commercial launch posture:** **Web** + **Android TV** targeted **launch-ready**; **iOS** + **Android mobile** storefront timing **TBD** (same codebase may still ship handsets technically—do not treat as public launch until Product/marketing bible dates them).

Three product URLs / store identities; handset and TV listings need not debut on the same day.

**Web ↔ Android TV (what’s shared vs different):** [`docs/depts/web-tv-parity.md`](docs/depts/web-tv-parity.md).

| Branch | What it is |
| :--- | :--- |
| **Waitlist Portal** | **[getreeldive.com](https://getreeldive.com)** — signup & positioning (**source repo:** [`github.com/trevorseitz-ai/v0-reel-dive-landing-page`](https://github.com/trevorseitz-ai/v0-reel-dive-landing-page)). Independent of main Expo origin. **FAQ parity:** Draft in [`docs/marketing/FAQ.md`](docs/marketing/FAQ.md), publish copy on landing site — see **`docs/depts/marketing.md`**. |
| **ReelDive Web** | Browser: shared **`app/`** routes; **`/login`**. Pre–GA (**see `docs/depts/web.md` + `marketing.md`):** reachable URL may show **Coming soon** until an **announced** ship date documented in **`marketing.md`**; **then countdown** alongside landing + campaigns. |
| **ReelDive Mobile** | **iOS / Android** handsets: same **Expo Router** tree, **Stream Finder** Discover, **viewport-utils** adaptive grids. **App Store / Play public launch TBD** (see **`docs/depts/marketing.md`**)—do not promise dated handset ship in external copy until Product updates. |
| **ReelDive TV** | **Android TV** lean-back client — Expo/React Native, D-pad focus, **six-slot** left sidebar (`docs/tv_layout_rules.md`; **Profile** anchors the bottom slot). |

_Add concrete URLs and repos here when they are finalized._

### Navigation architecture (shared tab shell)

**Standard tab order** (horizontal on Web / handset bottom bar; mirrored top-to-bottom on TV sidebar): **Home → Search → Watchlist → Watched → Discover → Profile**.

- **Profile** is the **anchor** slot (far right / bottom)—see [`docs/depts/product.md`](docs/depts/product.md).
- **Account** is **not** a tab: Phase 1 removed the unused **`account`** route from **`app/(tabs)/`**—see [`docs/depts/web.md`](docs/depts/web.md).

**Profile screen structure** (shared Web / mobile / TV — **`app/(tabs)/profile.tsx`**): **`My Services`** block and **service search field** appear **first** in the scroll stack, then provider tiles, then supplementary footer content; **`Save Preferences`** stays **pinned to the bottom edge of the viewport** (outside the **`FlatList`**). Personal viewing statistics and **1–5 star ratings** render on **`app/(tabs)/watched.tsx`** from **`user_library`** — see **`docs/depts/tv.md`** (**Watched tab layout**). Legacy **`watched_history`** still receives the global watched toggle but is **not** the Watched tab authority.

---

## Verified Ecosystem Map

Authoritative notes on how the pieces connect in this repo and in production.

- **Waitlist (frontend):** [getreeldive.com](https://getreeldive.com); **landing source:** [`github.com/trevorseitz-ai/v0-reel-dive-landing-page`](https://github.com/trevorseitz-ai/v0-reel-dive-landing-page). FAQ **dual source:** [`docs/marketing/FAQ.md`](docs/marketing/FAQ.md) ↔ live site (**sync on change** — **`docs/depts/marketing.md`**).
- **ReelDive App (shared core):** Single **Expo Router** project: **Web**, **mobile (native)**, and **Android TV** use one **`app/`** tree—shared routes and components with **`Platform` / `isTvTarget`** guards where needed. **Cross-surface parity (Web × TV)** — [`docs/depts/web-tv-parity.md`](docs/depts/web-tv-parity.md).
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
| **iOS / native handset rules** | [docs/depts/ios-rules.md](docs/depts/ios-rules.md) | Apple platforms: orientation, Safe Area, **`isTvTarget()`**/`extra.isTV`, sessions, Store boundaries. See **[`docs/IOS_NATIVE_DEVELOPER_ONBOARDING.md`](IOS_NATIVE_DEVELOPER_ONBOARDING.md)** for full onboarding. |
| **TV App** | [docs/depts/tv.md](docs/depts/tv.md) | Android TV: D-pad focus, sidebar, lean-back layout. |
| **Shared components** | [docs/depts/shared.md](docs/depts/shared.md) | Cross-surface primitives (e.g. `MovieRow` / viewport bucketing). See also [Web ↔ TV parity](docs/depts/web-tv-parity.md). |
| **QA & Automation** | [docs/depts/qa.md](docs/depts/qa.md) | Test matrix, **`npm run report:qa`** autonomous digest (**Resend**), nightly schedule (**08:00 UTC**) — **Operational**. |
| **Launch readiness (June 2026)** | [docs/reeldive-launch-readiness-report-june-2026.md](docs/reeldive-launch-readiness-report-june-2026.md) | Master handoff report; dept slices in each office file under **Launch readiness (June 2026)**. |

---

## Engineering standards

### Core principles

1. **Stability first — viewport bucketing.** Treat **discretized width** as a first-class rule, not an optimization. Raw **`useWindowDimensions()`** on mobile Safari and mobile-web chrome causes fractional width churn; layout driven from that signal can **re-render in a loop** when combined with context identity churn (**session**, watchlists). **Always** bucket before poster/grid math via **`bucketViewportWidth`** in [`lib/viewport-utils.ts`](lib/viewport-utils.ts) (re-exported from [`components/MovieRow.tsx`](components/MovieRow.tsx)) — see [`docs/depts/shared.md`](docs/depts/shared.md) and [`docs/depts/web.md`](docs/depts/web.md#mobile-web-stability-standards).
2. **Mount guards for heavy work.** **`useRef`** one-shots (e.g. Stream Finder cache hydration on Discover) so expensive fetches do not re-run on every parent tick; use stable **`session?.user?.id`** or **`discoverAuthKey`** in dependency arrays instead of the full **`session`** object where applicable.
3. **No-empty-placeholder policy.** Screens and **tab routes** that ship **no active data and no meaningful action** dilute UX and inflate the navigator. **Remove** them from the UI **and** the route tree rather than reserving an “Account”-sized dead end (Phase 1: dropped **`app/(tabs)/account.tsx`**). Prefer **`/login`**, **`Profile`**, or real feature shells when introducing surface area again—[`docs/depts/web.md`](docs/depts/web.md).

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

1. **`lib/viewport-utils.ts`** — **`bucketViewportWidth`** (10px stability) and **`discoverPosterGridColumns`** (**3 / 4 / 6** tiers) apply to **Web** and **mobile** Discover/grid density. **Android TV** poster rails use the **fixed** **140×210** poster **image**, **5** columns, **20px** horizontal gap per [`docs/depts/tv.md`](docs/depts/tv.md) — not fluid row-width division. **TV Discover** adds a **56px** meta footer band plus a **286px** canonical vertical **`FlatList`** stride (**210 + 56 + 20**) for **`getItemLayout`** / snap — see **`docs/depts/tv.md`** / **`docs/tv_layout_rules.md`**.
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

- **Native iOS — welcome email & onboarding pack:** [docs/ios-developer-welcome-pack.md](ios-developer-welcome-pack.md)
- **Native / web operational origins:** [docs/NATIVE_OPERATIONAL_URLS.md](NATIVE_OPERATIONAL_URLS.md) — Metro vs Vercel vs third-party bases.
- **EAS template:** [eas.json](eas.json) — build/submit scaffold; run **`eas init`** to link Expo project IDs.
- **Web ↔ Android TV parity & crossover:** [docs/depts/web-tv-parity.md](docs/depts/web-tv-parity.md)
- **Public FAQ drafts (dual with getreeldive.com):** [docs/marketing/FAQ.md](docs/marketing/FAQ.md)
- **Claude prompt — pre-launch autonomous marketing (standalone paste):** [docs/REELDIVE_PRELAUNCH_CLAUDE_PROMPT.md](REELDIVE_PRELAUNCH_CLAUDE_PROMPT.md)
- **HTTP APIs & integrations (canonical list):** [docs/API-ENDPOINTS.md](docs/API-ENDPOINTS.md) — first-party `/api/*` routes, Supabase, TMDB, RapidAPI, Stream Finder, OMDb, env checklist.
- **Infrastructure map (layers, user flows, change matrix):** [docs/infrastructure.md](docs/infrastructure.md) — what to update when product or user interactions change.
- **QA & Triple-Platform test matrix:** [docs/depts/qa.md](docs/depts/qa.md)
- **TV layout rules:** [docs/tv_layout_rules.md](docs/tv_layout_rules.md)
- **User / waitlist migration:** [docs/user_migration.md](docs/user_migration.md)

---

## v1.0.0 Release Checklist

| Track | Functionality | Security | Store Assets |
| :--- | :--- | :--- | :--- |
| **Smoke / E2E** | Maestro [`testing/maestro/smoke-test.yaml`](testing/maestro/smoke-test.yaml) runs [`auth-flow.yaml`](testing/maestro/auth-flow.yaml) first (**`launchApp`** + Supabase login via **`maestro-login-*`** testIDs), then **Discover** → **`discover-smoke-poster`** → **Profile**. Run: `npm run test:smoke-maestro` with **`-e MAESTRO_TEST_USER_EMAIL=… -e MAESTRO_TEST_USER_PASSWORD=…`** (or exported env). **Trailer modal (no login):** `npm run test:trailer-maestro` with **`EXPO_PUBLIC_MAESTRO_BYPASS_AUTH=1`** in `.env` — see [`testing/maestro/trailer-tv.yaml`](testing/maestro/trailer-tv.yaml). Requires [Maestro](https://maestro.mobile.dev/) + device **`com.reeldive.app`**. Detail: [`docs/depts/qa.md`](docs/depts/qa.md). | — | — |
| **Env & secrets** | App reads keys via **`EXPO_PUBLIC_*`** / **`process.env`** (see [`.env.example`](.env.example)). | Automated scan: `npm run check:env-security` ([`scripts/check-env-security.ts`](scripts/check-env-security.ts)) — fails on suspicious literals in **`app/`**, **`lib/`**, **`components/`**, **`scripts/`**, etc. | — |
| **Android build** | **Discover**, **Profile**, auth **`/login`**, hybrid data paths per Product office. | Network policy [`plugins/withAndroidNetworkSecurity.js`](plugins/withAndroidNetworkSecurity.js); no keys in repo. | Adaptive icon + **`android.package`** **`com.reeldive.app`** in [`app.json`](app.json); TV banner `./assets/tv-banner.png`; Play listing copy / screenshots owned by Marketing. |
| **iOS build** | Parity with shared routes (handset targets). | Same secret posture as Android. | **`ios.bundleIdentifier`** **`com.reeldive.app`** in [`app.json`](app.json); App Store screenshots / metadata owned by Marketing. |
| **Web** | Hosted bundle + **`app/+html.tsx`** viewport. | CSP / env injection per hosting provider. | Favicon `./assets/favicon.png`; store not applicable. |
| **QA audit signed off** | **QA Lead / delegate** confirms the full **`docs/depts/qa.md`** matrix for the RC; optional aggregate run **`npm run report:qa`** (same gates + **`qa-audit-summary.json`** / Resend digest). | **`npm run check:env-security`** green on the RC branch; waived findings tracked with owner. | Store policy spot-check (**D‑pad** / **`adjustPan`**) on the RC Android artifact (**`softwareKeyboardLayoutMode: "pan"`** in **`app.json`**). |

Pre-release: bump **`app.json`** version / release channel; run **`npm run check:env-security`** in CI; run Maestro against a staging build whose **`applicationId`** matches **`smoke-test.yaml`**; complete **QA audit signed off** row before tagging **v1.0.0**.

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
