# ReelDive — Technical State Teardown

**Generated:** 2026-06-06  
**Branch checkpoint:** `web-tv-parity-6-4` @ `5d22aac`  
**Sources:** [`HQ.md`](HQ.md), [`docs/depts/product.md`](docs/depts/product.md), [`docs/depts/tv.md`](docs/depts/tv.md), [`docs/depts/web-tv-parity.md`](docs/depts/web-tv-parity.md), [`docs/database_schema.md`](docs/database_schema.md), and direct inspection of `app/`, `lib/`, `components/`, `supabase/migrations/`, and config files.  
**Purpose:** Objective inventory for product, marketing, and engineering planning. Contradicts stale or aspirational copy where the code does not support it.

---

## 1. Executive summary

| Area | Status (June 2026) |
| :--- | :--- |
| **Phase 1 — Discovery & Stability** | **Complete** on Web, mobile, and Android TV (Stream Finder mirror, hybrid TMDB enrichment, six-tab shell). |
| **Phase 2 — User utility** | **In progress.** First shipped utilities: **Watched 1–5 star ratings**, web/TV movie-detail parity (cast, IMDb, trailers), Watchlist/Watched provider-logo parity, migration consolidation. |
| **Web + Android TV (engineering)** | **Launch-ready** — lean-back shell, fixed poster grid, D-pad focus on major tabs, ratings, streaming intents. **GTM:** no public ship date in [`docs/depts/marketing.md`](docs/depts/marketing.md); web may be pre-GA per [`docs/depts/web.md`](docs/depts/web.md). |
| **Google TV / Play (TV store)** | **Pre-submission** — release signing, permissions audit, signed AAB, listing assets, on-device QA not closed. |
| **iOS / Android handset stores** | **TBD.** Same Expo tree; **`android.isTV: true`** conflates handset vs TV shell until build flavors split. |
| **QA automation** | **`npm run report:qa`** exists; **no committed GitHub Actions workflow**; Maestro requires a connected device. |

**Bottom line:** ReelDive is a **real, shippable discovery app** on **Web + Android TV** with a unified account, watchlist, **Watched shelf + personal ratings**, and **where-to-watch** cues. **Handset storefronts, Google TV submission, CI cron, and several Phase 2 workstreams remain open.** Do not market legacy README claims (FastAPI scraping, NativeWind, tvOS) — actual curation is **Stream Finder mirror + TMDB**.

---

## 2. Architecture (what actually runs)

| Layer | Implementation |
| :--- | :--- |
| **Client** | **Expo SDK ~55**, **Expo Router** (`app/`), **React Native 0.83**, **TypeScript**. Surface branching via **`Platform`**, **`isTvTarget()`**, **`shouldUseTvDpadFocus()`**. |
| **Auth & user data** | **Supabase Auth** + PostgREST. [`lib/supabase.ts`](lib/supabase.ts) — **Web: localStorage**; **native/TV: AsyncStorage**. |
| **Default Discover curation** | **Stream Finder → Supabase mirror** ([`lib/stream-finder-supabase.ts`](lib/stream-finder-supabase.ts)). Checkpoint: **~1,206** titles, **16** providers (HQ: 2026-04-30). Sync: **`npm run sync:stream-finder`**. |
| **Imagery & filtered discover** | **TMDB** client-side. Filtered discover uses TMDB Discover when filters active in [`app/(tabs)/discover.tsx`](app/(tabs)/discover.tsx). |
| **Streaming availability (per title)** | **RapidAPI Streaming Availability** ([`lib/streaming-rapid.ts`](lib/streaming-rapid.ts)); web may proxy via Vercel [`api/streaming.ts`](api/streaming.ts). |
| **Ratings (external)** | **OMDb** via [`lib/ratings.ts`](lib/ratings.ts) + cached columns on **`media`**; **IMDb chip** on movie detail when data exists. |
| **Ratings (personal)** | **`user_library.personal_rating`** (1–5 stars); UI in [`components/StarRating.tsx`](components/StarRating.tsx). |
| **First-party HTTP routes** | **`app/api/*+api.ts`** — primarily **web/Vercel**; release-TV movie detail uses **direct TMDB** for trailers when server origin unreachable. |
| **Migrations** | Single directory: **`supabase/migrations/`** (legacy `database/migrations` consolidated June 2026). |
| **Hosting** | **Web:** Vercel. **Waitlist:** [getreeldive.com](https://getreeldive.com) (separate repo). |

---

## 3. Platform support matrix

| Platform | Supported? | Maturity | Notes |
| :--- | :---: | :--- | :--- |
| **Web** | Yes | **Highest** | Responsive grids ([`lib/viewport-utils.ts`](lib/viewport-utils.ts)), pointer/keyboard UX, `/api/*` on deploy origin. |
| **Android TV** | Yes (primary lean-back) | **High, active polish** | Fixed **140×210** grid, **5** cols, **286px** Discover stride, D-pad focus. **Focus Bridge** on Home rows still WIP. |
| **Android handset** | Partial | Medium | Same manifest as TV unless flavors split; may get TV sidebar via **`isTvTarget()`**. |
| **iOS / iPad** | Partial | Medium-low | Landscape locked globally; no tvOS target. |
| **tvOS (Apple TV hardware)** | No | Not targeted | “Apple TV” in code = **Apple TV+ streaming service** on Android TV. |

---

## 4. Navigation & screens

**Tab order:** Home → Search → Watchlist → Watched → Discover → Profile.  
**Removed:** `app/(tabs)/account.tsx` — auth via **`/login`**, settings on Profile.

| Route | Functional? | Notes (June 2026) |
| :--- | :---: | :--- |
| **`app/(tabs)/discover.tsx`** | Yes | Core product. Stream Finder paging + TMDB + filters. |
| **`app/(tabs)/watchlist.tsx`** | Yes | CRUD, up/down reorder, brand-grouped cached provider logos. Legacy **`RatingModal`** on mark-watched (watchlist flow). |
| **`app/(tabs)/watched.tsx`** | Yes | **`user_library`** list + **`WatchedHistoryStatsHeader`** (stats from **`user_library`**, 1–5 scale). **`RatingPickerModal`** on rows. Split TV focus: main cell + rate cell. |
| **`app/(tabs)/profile.tsx`** | Yes | My services, provider tiles, save to **`profiles`**. Stats live on **Watched**, not Profile. |
| **`app/movie/[id].tsx`** | Yes | Detail, trailer (direct TMDB on release-TV), cast (inert without TMDB id), RT/Metacritic/**IMDb** chips, **Watch on** via **`WatchOnButton`**, **Add to Watched** → rating modal. |
| **`app/person/[id].tsx`** | Yes | TMDB person filmography (numeric id only). |
| **`app/tv-landing.tsx`** | Yes (TV) | Unauthenticated TV entry; login-first flow. |

---

## 5. Features — functional inventory

### 5.1 Fully implemented

- Email/password auth (Supabase).
- Discover default feed (Stream Finder mirror) + filters → TMDB Discover.
- Profile → My services (16-provider catalog, auto-prune on sync).
- Watchlist add/remove/reorder; brand-grouped provider logos (14-day TTL cache).
- **Watched shelf** (`user_library`): list, **1–5 star ratings**, stats header, rate on **Add to Watched** from movie detail.
- Movie detail: metadata, trailer, recommendations, streaming availability, **IMDb/RT/Metacritic** when cached.
- Cast/crew: navigates when TMDB id exists; **inert** otherwise (no error dead-end).
- Android TV native streamer launch ([`WatchOnButton`](components/WatchOnButton.tsx), intent matrix) — success varies by OEM/installed apps.
- Web streaming handoff (HTTPS / universal links) — discovery only, no in-app catalog playback.

### 5.2 Partially implemented / env-gated

- **OMDb fetch** — requires **`EXPO_PUBLIC_OMDB_API_KEY`**; IMDb/RT/Metacritic **display** on movie detail when **`media`** cache populated; full requirements doc partially superseded — see [`OMDb_RATINGS_REQUIREMENTS.md`](OMDb_RATINGS_REQUIREMENTS.md).
- **RapidAPI Film & Show top-list** — exists but **Discover default uses Stream Finder**, not this path.
- **iOS streamer deep links** — HTTPS fallback; less native than Android TV matrix.
- **First-party `/api/*` routes** — tooling/backfill; not primary native UX path.

### 5.3 Known gaps / Phase 2 queue

| Gap | Detail |
| :--- | :--- |
| **`watched_history` vs `user_library` split** | Watched tab, ratings, stats → **`user_library`**. Global watched toggle in [`lib/watchlist-status-context.tsx`](lib/watchlist-status-context.tsx) still writes **`watched_history`** only. |
| **Re-rate from movie detail** | Prompt on **add** only; re-edit on **Watched** tab (by design v1). |
| **Cross-device watchlist sync** | Optimistic per-client reorder; no conflict semantics. |
| **Deep linking (all 16 providers, all platforms)** | Android TV furthest; iOS/web incomplete. |
| **TV Focus Bridge (Home rows)** | Partial; HQ WIP. |
| **Handset vs TV build split** | `android.isTV: true` affects all native builds. |
| **Google TV store submission** | Open blockers. |
| **CI / Maestro in repo** | Script exists; no committed workflow. |

---

## 6. Watched & ratings data model (authoritative)

| Concern | Source of truth | UI entry points |
| :--- | :--- | :--- |
| **Watched list** | **`user_library`** (+ join **`media`**) | Watched tab; movie detail **Add to Watched** |
| **Personal rating (1–5)** | **`user_library.personal_rating`** | Watched row rate cell; rating modal on add-to-Watched |
| **Viewing stats** | **`user_library`** (aggregated in **`WatchedHistoryStatsHeader`**) | Watched tab header |
| **Legacy watched toggle** | **`watched_history`** (insert/delete from context) | Watchlist / global toggle — **not** wired to ratings or Watched list |

Migration: **`supabase/migrations/20260605161700_user_library_personal_rating.sql`** (applied remote + local).

---

## 7. Android TV focus — status

**Implemented:** Sidebar rail, Discover grid stride, movie detail provider ladder, Watchlist/Watched list focus rings, Watched split-row pattern, **`RatingPickerModal`** D-pad stars, search ↔ content bridge ([`lib/tv-search-focus-context.tsx`](lib/tv-search-focus-context.tsx)).

**Still WIP:** **Focus Bridge** across all **Home** horizontal rows (HQ active focus).

**Risk:** Behavior varies by **`Platform.isTV`**, **`expo.extra.isTV`**, **`EXPO_PUBLIC_TV_FOCUS=1`**, emulator vs physical TV.

---

## 8. Data & backend

**Schema doc:** [`docs/database_schema.md`](docs/database_schema.md) — **`user_library.personal_rating`** documented; **`watched_history`** retained for legacy toggle path.

**Active tables (client):** `watchlist`, `user_library`, `watched_history`, `media`, `profiles`, `stream_finder_movies`, `movie_availability`, `stream_finder_providers`, `streaming_cache`, `tmdb_watch_provider_cache`, etc.

**Edge functions:** `supabase/functions/resend-inbound/` — stub (PIN to logs only; not production-complete).

---

## 9. QA, CI, automation

| Item | State |
| :--- | :--- |
| **`npm run check:env-security`** | Works |
| **`npm run test:smoke-maestro`** | Requires device + credentials |
| **`npm run report:qa`** | Local/operator; optional Resend email |
| **GitHub Actions** | **None committed** (`.github/` absent) |

---

## 10. Config footguns

1. **`android.isTV: true`** → TV shell on handset builds until flavors split.
2. **Global landscape lock** — affects iPhone portrait positioning.
3. **`README.md` stale** — use **`README_DEV.md`**, **`HQ.md`**, **`reeldive_state.md`** (this file).
4. **No committed `ios/` / `android/`** — prebuild; TV plugin changes need **`npm run tv:clean`**.

---

## 11. Marketing-safe claims (June 2026)

**Safe (Web + Android TV screenshots):**

- Dark-mode **discovery** with unified account.
- **Where to watch** for mirrored catalog (~1,206 titles / 16 services at last sync).
- **Watchlist** and **Watched shelf** with **personal 1–5 star ratings**.
- Android TV lean-back with D-pad navigation (focus polish ongoing on Home).
- Profile **My services** preferences.

**Do not claim until verified:**

- Handset App Store / Play launch (TBD).
- tvOS app.
- In-app playback of third-party catalogs.
- Fully autonomous nightly QA CI.
- Public ship date / countdown.

---

## 12. Next engineering priorities

Aligned with [`docs/depts/product.md`](docs/depts/product.md) **What's next**:

1. **Google TV store submission**
2. **Manual TV QA** (ratings, add-flow, cast, release-TV trailers)
3. **Watched data model cleanup** — align global toggle with **`user_library`**
4. **TV Focus Bridge (Home)**
5. **Handset build split**
6. **Phase 2 deep linking** (iOS universal links)
7. **Watchlist cross-device sync semantics**

---

*Regenerate this file after major merges, store submission, or Phase 2 milestones.*
