# 🚀 Product & Features Office

**Path:** `docs/depts/product.md`

> **Launch handoff (human-readable, all departments):** [`docs/reeldive-launch-readiness-report-june-2026.md`](../reeldive-launch-readiness-report-june-2026.md) — **canonical launch report**. Sections will migrate into each department office over time; until then, start there for takeover.
>
> **Companion docs:** [`HQ.md`](../../HQ.md) · [`reeldive_state.md`](../../reeldive_state.md) · [`docs/infrastructure.md`](../infrastructure.md) · [`assistant.md`](../../assistant.md) · [`docs/depts/qa.md`](qa.md) · [`docs/depts/marketing.md`](marketing.md)

**Checkpoint (June 2026):** `web-tv-parity-6-4` @ `cfb2dd7` — Web + Android TV engineering launch-ready; **public launch not shipped** (store, QA, GTM gaps).

---

## Launch readiness (June 2026)

> **Master report:** [`docs/reeldive-launch-readiness-report-june-2026.md`](../reeldive-launch-readiness-report-june-2026.md) — full cross-department narrative. This section is the **Product office** slice.

**Report date:** June 7, 2026 · **Public launch:** Not shipped

### Phases

**Phase 1 — Discovery & Stability — COMPLETE**

Shared six-tab app (Home, Search, Watchlist, Watched, Discover, Profile) on Web, mobile browsers, and Android TV. Default Discover from Stream Finder in Supabase. Viewport bucketing fixed mobile web thrash. Profile “My Services” prunes to 16 synced providers.

**Phase 2 — User utility & bug squashing — IN PROGRESS**

Recently shipped: **1–5 star ratings** on Watched; **16:9 trailer player** on Web and TV; movie detail parity (cast, IMDb/RT/Metacritic, provider logos); **TV Search focus bridge** (sidebar → suggestions / result poster); **movie detail action row** (Watchlist + Watched on row 1, **Discover More** full-width row 2); **signed-out TV Home → `/login`**; **`expo-dev-client`** for physical TV Metro; Maestro trailer test on TV emulator.

Still open: Google TV store submission; watched data model cleanup; deep linking (16 providers); separate phone vs TV Android builds.

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

Global “watched” toggle in [`lib/watchlist-status-context.tsx`](../../lib/watchlist-status-context.tsx) writes **`watched_history`**. Watched tab + ratings use **`user_library`**. **Fix or document a waiver before launch.** → Task **A3** in [Pre-launch plan](#pre-launch-plan--workable-task-list-june-2026).

### Cross-surface readiness (summary)

| Surface | Overall |
| :--- | :--- |
| Web | 🟡 Yellow |
| Android TV | 🟡 Yellow / 🔴 store |
| Mobile handset | 🔴 Red — not a launch target |

Dept detail: [Web](web.md#launch-readiness-june-2026) · [TV](tv.md#launch-readiness-june-2026) · [Mobile](ios-rules.md#launch-readiness-june-2026) · [QA](qa.md#launch-readiness-june-2026) · [Marketing](marketing.md#launch-readiness-june-2026)

---

## Pre-launch plan — workable task list (June 2026)

**Launch target surfaces:** Web + Android TV (Google Play). Handset stores **out of scope** for v1.0.

**How to read this list**

| Owner | Meaning |
| :--- | :--- |
| **🤖 AI** | Agent can execute end-to-end in-repo (code, docs, scripts, PRs) given normal repo access. |
| **👤 Human** | Requires a person: accounts, credentials, physical devices, legal/business judgment, or founder sign-off. |
| **🔀 Hybrid** | AI does prep/implementation; human must decide, approve, provide secrets, or perform irreplaceable steps. |

Track status in your issue tracker (`[ ]` / `[x]`). **P0** blocks launch; **P1** should ship or be explicitly waived in writing.

---

### A. Product decisions (do first — unblocks everything else)

| # | Task | P | Owner | AI can do (if 🤖/🔀) | Hybrid / human note |
| :-: | :--- | :-: | :---: | :--- | :--- |
| A1 | **Choose launch mode:** full public GA vs soft launch vs Web “Coming soon” + TV only | P0 | 🔀 | Draft options doc with tradeoffs from [`web.md`](web.md) + [`marketing.md`](marketing.md). | **Human** picks one mode. **AI** implements Web gate (A12) and updates `marketing.md` ship-date line after decision. |
| A2 | **Set or defer ship date** in [`marketing.md`](marketing.md) (no countdown until dated) | P0 | 🔀 | Insert approved date/season language; enable countdown hooks only if human approves movie-ticket cadence. | **Human** approves date or “soft launch / no date.” |
| A3 | **Watched data model:** fix `watched_history` vs `user_library` split **or** sign written waiver | P0 | 🔀 | Implement fix in [`lib/watchlist-status-context.tsx`](../../lib/watchlist-status-context.tsx) + docs; or draft waiver ADR for human signature. | **Human** chooses fix vs waiver. **AI** executes chosen path. |
| A4 | **Focus Bridge (Home + Search):** ship fix **or** sign waiver for v1.0 | P1 | ✅ | Shipped **`cfb2dd7`**: Home hero/trending + Search suggestions/result poster via **`mainContentEntryNativeTag`**; sidebar **`nextFocusRight`** on Search tab. | **Human:** physical TV sign-off on Search + Home (QA matrix). |
| A5 | **Defer explicitly:** paywall, handset stores, tvOS, full deep-link matrix | P2 | 👤 | Document deferrals in launch known-issues one-pager. | Product call — not launch blockers if documented. |

---

### B. Engineering & codebase

| # | Task | P | Owner | AI can do (if 🤖/🔀) | Hybrid / human note |
| :-: | :--- | :-: | :---: | :--- | :--- |
| B1 | Open PR: `web-tv-parity-6-4` → `main` | P0 | 🔀 | Open PR, write summary, fix merge conflicts, run `check:env-security`. | **Human** reviews and merges (or approves AI merge per team policy). |
| B2 | Tag **release candidate** on `main` after merge | P0 | 🤖 | Create annotated tag + `CHANGELOG` snippet for Phase 2. | Needs git write + human may want to name the tag. |
| B3 | Fix **`watched_history` / `user_library`** (if A3 = fix) | P0 | 🤖 | Route global watched toggle through `user_library`; add migration if needed; update [`docs/database_schema.md`](../database_schema.md). | Depends on A3 decision. |
| B4 | **TV Focus Bridge** on Home + Search rows (if A4 = fix) | P1 | ✅ | Shipped — see [`app/(tabs)/search.tsx`](../../app/(tabs)/search.tsx), [`app/(tabs)/index.tsx`](../../app/(tabs)/index.tsx), [`TvSidebarTabBar.tsx`](../../components/TvSidebarTabBar.tsx). | Verify on physical device (QA section). |
| B5 | Wire **`discover-smoke-poster`** testID on Discover for Maestro smoke | P1 | 🤖 | Add testID to Discover poster cell matching smoke flow. | — |
| B6 | **GitHub Actions:** `check:env-security` on every PR | P1 | 🤖 | Add `.github/workflows/env-security.yml`. | **Human** enables Actions on repo if disabled. |
| B7 | Optional: nightly `report:qa` workflow | P2 | 🔀 | Add workflow YAML per [`qa.md`](qa.md); document secrets. | **Human** adds `MAESTRO_TEST_USER_*`, emulator/device, Resend keys in GitHub Secrets. |
| B8 | **Release network hardening:** disable cleartext in production Android build | P1 | 🤖 | Split dev vs release in [`withAndroidNetworkSecurity.js`](../../plugins/withAndroidNetworkSecurity.js) (Metro dev only). | **Human** validates release AAB still reaches Supabase/TMDB on TV. |
| B9 | Add **Privacy policy** (+ optional Terms) link in app UI (Profile or login footer) | P1 | 🔀 | Add link row pointing to approved URL constant/env. | **Human** supplies final URL (C2). |
| B10 | Implement **Web Coming soon / GA gate** (if A1 requires) | P0 | 🔀 | Shell route, env flag, or middleware per [`web.md`](web.md) contract. | **Human** decides copy and flip date (A1/A2). |
| B11 | Handset vs TV **EAS build split** (prevent accidental phone TV-UI ship) | P1 | 🤖 | Add `production-tv` profile in [`eas.json`](../../eas.json); document `EXPO_PUBLIC_TV=1` / `android.isTV` per profile. | **Human** runs `eas init` once if project not linked. |
| B12 | Optional: set `leanback` `required="true"` in TV plugin for TV-only APK | P2 | 🤖 | One-line change in [`withAndroidTvLauncher.js`](../../plugins/withAndroidTvLauncher.js). | **Human** confirms TV-only distribution intent. |

---

### C. Backend, data & ops

| # | Task | P | Owner | AI can do (if 🤖/🔀) | Hybrid / human note |
| :-: | :--- | :-: | :---: | :--- | :--- |
| C1 | Confirm all **Supabase migrations** applied through `20260605161700` on prod | P0 | 🔀 | List migrations; run `supabase db push` or MCP migration apply if credentials provided. | **Human** confirms prod project; AI must not push without explicit approval. |
| C2 | **Pre-launch Stream Finder sync** + verify ~1,206 titles / 16 providers | P0 | 🔀 | Run `npm run sync:stream-finder` with `STREAM_FINDER_KEY` + service role; log counts to HQ block. | **Human** provides service-role key locally or in CI; approves prod write. |
| C3 | **Production Supabase** keys: rotate if needed; anon key in EAS/Vercel only | P0 | 🔀 | Update `.env.example` docs; configure EAS env via `eas.json` / docs. | **Human** rotates keys in Supabase Dashboard; pastes into EAS/Vercel secrets. |
| C4 | **Vercel production** deploy: env vars, pinned deployment URL | P0 | 🔀 | Verify `EXPO_PUBLIC_*` + server keys documented in [`NATIVE_OPERATIONAL_URLS.md`](../NATIVE_OPERATIONAL_URLS.md). | **Human** sets Vercel project env and triggers prod deploy. |
| C5 | **OMDb** production key + optional rating backfill | P1 | 🔀 | Wire key usage; script backfill for `media` cache if key provided. | **Human** obtains OMDb API key. |
| C6 | Verify **RLS** + auth flows against prod Supabase | P0 | 🔀 | Run scripted smoke queries; document expected policies. | **Human** spot-checks account creation in prod. |

---

### D. Build, signing & Android TV artifact

| # | Task | P | Owner | AI can do (if 🤖/🔀) | Hybrid / human note |
| :-: | :--- | :-: | :---: | :--- | :--- |
| D1 | **`eas init`** — link Expo project to EAS | P0 | 🔀 | Prepare `eas.json` profiles (`production`, `production-tv`); document commands. | **Human** runs `eas init` / logs into Expo account once. |
| D2 | Configure **Android signing** (EAS credentials or Play App Signing) | P0 | 👤 | Document keystore upload steps. | **Human** creates keystore or accepts Play App Signing; EAS credential setup requires account holder. |
| D3 | Set **EAS secrets** for release build (`EXPO_PUBLIC_SUPABASE_*`, TMDB, RapidAPI) | P0 | 🔀 | List required vars from [`.env.example`](../../.env.example); validate with `check:env-security`. | **Human** pastes secrets into EAS (never commit). |
| D4 | **`eas build --platform android --profile production-tv`** (or Gradle release AAB) | P0 | 🔀 | Trigger build if EAS token in CI; or run `npm run tv:clean` + Gradle with human’s signing config. | **Human** approves build cost; provides credentials; downloads AAB. |
| D5 | Verify **generated manifest** after prebuild (leanback, banner, LEANBACK_LAUNCHER) | P0 | 🤖 | Run prebuild; grep `AndroidManifest.xml`; fix plugin if missing. | — |
| D6 | **Sideload release AAB** on physical Google TV (smoke before Play upload) | P0 | 👤 | Provide install checklist. | **Human** with device + USB/adb or Play internal track. |
| D7 | Upload AAB to **Play Console** (internal testing track first) | P0 | 👤 | Draft step-by-step from current artifact metadata. | **Human** in Play Console UI. |

---

### E. Google Play Console & legal (Android TV)

| # | Task | P | Owner | AI can do (if 🤖/🔀) | Hybrid / human note |
| :-: | :--- | :-: | :---: | :--- | :--- |
| E1 | **Google Play Developer account** enrolled ($25, org details) | P0 | 👤 | — | **Human** only. |
| E2 | Create app listing — **Android TV** category / Leanback app | P0 | 👤 | Draft field-by-field guide (package `com.reeldive.app`). | **Human** in Play Console. |
| E3 | **Short + full description** (store copy) | P0 | 🔀 | Draft from [`marketing.md`](marketing.md) + Sentinel rules; forbidden-words lint. | **Human** founder approval before paste into Play. |
| E4 | **TV screenshots** (1280×720, min 2) — Discover, movie detail, Watched | P0 | 🔀 | Resize/crop/rename if human provides raw captures; document shot list per TV layout rules. | **Human** captures on emulator or physical TV (AI cannot approve “Hollywood premium” aesthetic). |
| E5 | **Content rating** questionnaire (IARC) | P0 | 🔀 | Draft answers from app behavior (no playback, auth, UGC = ratings only). | **Human** submits in Play Console; legal review if unsure. |
| E6 | **Data safety** form | P0 | 🔀 | Draft declarations from [`database_schema.md`](../database_schema.md) (email, user ids, watchlist, no sale of data). | **Human** submits and attests accuracy. |
| E7 | **Privacy policy URL** live and linked in Play listing | P0 | 🔀 | Draft policy markdown from FAQ + data practices; add link in app (B9). | **Human**/legal publishes to getreeldive.com or legal site; **Human** attests compliance. |
| E8 | **Terms of service** (recommended for accounts) | P1 | 🔀 | Draft ToS markdown. | **Human**/legal publishes and approves. |
| E9 | Target **Google TV** device catalog / exclude phones if TV-only | P1 | 👤 | Document recommended Play device filters. | **Human** sets in Console. |

---

### F. QA & validation (launch gate)

| # | Task | P | Owner | AI can do (if 🤖/🔀) | Hybrid / human note |
| :-: | :--- | :-: | :---: | :--- | :--- |
| F1 | Green **`npm run check:env-security`** on RC branch | P0 | 🤖 | Run and fix any findings. | — |
| F2 | Green **`npm run simulate:trailer-tv`** on RC | P0 | 🤖 | Run simulation; fix layout regressions. | — |
| F3 | **Maestro trailer** on release or dev RC build | P0 | 🔀 | Run `test:trailer-maestro`; fix testIDs/flows. | Release build needs auth path or human test user (no dev bypass in prod). |
| F4 | **Maestro smoke** on release APK with real credentials | P0 | 🔀 | Fix smoke flow + testID (B5); run `test:smoke-maestro`. | **Human** provides `MAESTRO_TEST_USER_*`; emulator/device required. |
| F5 | **Physical Android TV QA** — full matrix in [`qa.md`](qa.md) + [TV launch section](tv.md#launch-readiness-june-2026) | P0 | 👤 | Generate printable checklist from docs. | **Human** on Sony/TCL/Google TV: D-pad, login, Discover, watchlist, watched ratings, trailer 16:9, top-5 streamer intents. |
| F6 | **Web manual QA** — Chrome/Safari desktop + mobile widths | P0 | 🔀 | Document step-by-step script. | **Human** executes; **AI** files bugs/fixes from report. |
| F7 | **`npm run report:qa`** → `qa-audit-summary.json` PASS on RC | P0 | 🔀 | Run aggregator; fix failing gates. | Needs device + credentials for smoke (F4). |
| F8 | Sign **QA matrix** / known-issues waiver doc for RC | P0 | 🔀 | AI drafts waiver from open items (A4, OEM intents). | **Human** QA lead signs off. |

---

### G. Marketing & GTM

| # | Task | P | Owner | AI can do (if 🤖/🔀) | Hybrid / human note |
| :-: | :--- | :-: | :---: | :--- | :--- |
| G1 | Answer **prelaunch plan §A.6** clarifying questions (UTM, ESP, analytics, handles, press, legal) | P0 | 🔀 | Draft decision memo with options from [`reeldive-prelaunch-marketing-action-plan.md`](../marketing/reeldive-prelaunch-marketing-action-plan.md). | **Human** decides each answer. |
| G2 | **FAQ parity:** [`docs/marketing/FAQ.md`](../marketing/FAQ.md) ↔ getreeldive.com | P0 | 🔀 | Diff live site vs repo FAQ; open PR on main repo + instructions/PR for landing repo. | **Human** merges landing repo; approves customer-visible copy. |
| G3 | **Marketing ops sheet** (W1-01): digest, waitlist, traffic tabs | P1 | 🔀 | Generate Sheet template structure + column defs. | **Human** creates Google Sheet and owns access. |
| G4 | **Channel inventory** — claim/document social handles (W1-02) | P1 | 👤 | Draft bio copy per brand voice. | **Human** claims accounts. |
| G5 | Draft **Play Store + web** listing copy pack | P0 | 🔀 | Short/full description, feature bullets, keywords — Sentinel lint. | **Human** founder approval (E3). |
| G6 | **`assets/marketing/`** — organize approved screenshots + banner exports | P0 | 🔀 | Create folder; README for dimensions; optimize PNGs if source files provided. | **Human** supplies captures (E4). |
| G7 | **Waitlist / launch email** (if emailing list at GA) | P1 | 🔀 | Draft email body + UTM links per convention once G1 decides ESP. | **Human** configures ESP; approves send. |
| G8 | **Sentinel checklist** on all outbound copy | P0 | 🔀 | Run lint against forbidden words + playback/chatbot/handset claims. | **Human** founder sign-off recorded. |
| G9 | Execute **marketing W1–W2** tickets (audit landing analytics, founder POV draft internal) | P1 | 🔀 | POV essay draft, FAQ-parity audit file, analytics confirmation template. | **Human** approves anything external. |

---

### H. Launch proof pack & go-live

| # | Task | P | Owner | AI can do (if 🤖/🔀) | Hybrid / human note |
| :-: | :--- | :-: | :---: | :--- | :--- |
| H1 | Assemble **Launch Readiness folder** (Drive/Notion/GitHub Release) | P0 | 🔀 | Generate index markdown listing all proof artifacts from master report. | **Human** owns folder location. |
| H2 | **RC changelog** + git tag artifact | P0 | 🤖 | Write changelog from git log since last release. | — |
| H3 | Pin **production URLs** (Web Vercel, getreeldive.com, Play listing) in `HQ.md` | P0 | 🔀 | Update HQ platform map when URLs exist. | **Human** confirms URLs live. |
| H4 | **Known issues / waivers** one-pager | P0 | 🤖 | Compile from A3, A4, OEM intent gaps. | **Human** signs. |
| H5 | Flip **Web** to GA (or keep Coming soon per A1) | P0 | 🔀 | Deploy + env flag. | **Human** go/no-go. |
| H6 | Promote Play release **internal → production** (staged rollout) | P0 | 👤 | Rollout percentage checklist. | **Human** in Play Console after F5 pass. |
| H7 | Post-launch: update all launch docs + `assistant.md` handoff | P1 | 🤖 | Sync product, HQ, launch report dates/status. | **Human** confirms public announcement timing (A2). |

---

### Summary — ownership counts (P0 + P1 launch scope)

| Owner | Approx. tasks | Role |
| :--- | :---: | :--- |
| **🤖 AI** | 15 | Code, CI, docs drafts, automation, in-repo verification |
| **👤 Human** | 12 | Accounts, Play Console, physical QA, legal attestation, founder approval |
| **🔀 Hybrid** | 35 | AI prepares; human decides, secrets, device, or sign-off |

---

### Recommended execution order (workable sequence)

1. **Decisions (A1–A3)** — launch mode, ship date, watched-data fix vs waiver  
2. **Merge & RC (B1–B2, F1–F2)** — `main` + security/trailer sim green  
3. **Backend (C1–C4)** — migrations, sync, prod env  
4. **Build pipeline (D1–D5, B11, D3)** — EAS, signing, secrets, AAB  
5. **Legal/listing drafts (E3, E5–E8, G5, B9)** — parallel while build runs  
6. **Screenshots (E4, G6)** — human capture; AI organize  
7. **QA (D6, F3–F8)** — sideload → physical TV + smoke on release  
8. **Play upload (D7, E1–E2, E5–E7)** — internal track  
9. **Marketing (G2, G8, A2)** — FAQ parity, Sentinel, date copy  
10. **Go-live (H5–H7, A1)** — Web flip + Play production rollout  

**Out of scope for v1.0 launch** (P2 — do not block): paywall, handset App Store/Play, tvOS, full 16-provider deep links, nightly Resend QA email, re-rate from movie detail.

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

Active workstreams: watchlist sync semantics, deep linking (16 providers), watched data cleanup, Google TV submission, physical TV QA sign-off, handset build split, bug squashing.

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

*Last updated: 2026-06-07 — pre-launch task list: [Pre-launch plan](#pre-launch-plan--workable-task-list-june-2026). Full narrative: [`reeldive-launch-readiness-report-june-2026.md`](../reeldive-launch-readiness-report-june-2026.md). Regenerate after store submission, `main` merge, or major Phase 2 milestone.*
