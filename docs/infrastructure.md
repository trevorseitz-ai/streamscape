# ReelDive infrastructure map

**Path:** `docs/infrastructure.md`  
**Purpose:** Show **what the system is made of**, **what each user action touches**, and **what you must update** when the product changes — by layer, not by file grep.

**Related:** [`docs/API-ENDPOINTS.md`](API-ENDPOINTS.md) · [`docs/NATIVE_OPERATIONAL_URLS.md`](NATIVE_OPERATIONAL_URLS.md) · [`docs/database_schema.md`](database_schema.md) · [`docs/depts/product.md`](depts/product.md) · [`reeldive_state.md`](../reeldive_state.md)

---

## 1. System layers (top to bottom)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SURFACES (user sees)                                                    │
│  Web (Vercel) · Android TV · iOS/Android handset · getreeldive.com       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│  CLIENT (one Expo Router app — app/, components/, lib/)                  │
│  Platform guards: Platform.OS · isTvTarget() · shouldUseTvDpadFocus()   │
└─────────────────────────────────────────────────────────────────────────┘
          │                    │                      │
          ▼                    ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐
│ Supabase        │  │ First-party     │  │ Third-party APIs (client or   │
│ Auth + Postgres │  │ /api/* (web     │  │ server)                       │
│ + RLS           │  │ deploy only)    │  │ TMDB · RapidAPI · OMDb ·      │
│                 │  │ + Vercel        │  │ Stream Finder (sync scripts)  │
│                 │  │ streaming proxy │  │                               │
└─────────────────┘  └─────────────────┘  └─────────────────────────────┘
          ▲
          │  npm run sync:stream-finder (operator; service role key)
┌─────────────────┐
│ Stream Finder   │  ← authoritative catalog + availability upstream
│ external API    │
└─────────────────┘
```

### Layer cheat sheet

| Layer | Where it lives | Who changes it | Typical deploy |
| :--- | :--- | :--- | :--- |
| **Marketing / waitlist** | [getreeldive.com](https://getreeldive.com) (separate repo) | Marketing | Landing host |
| **Web app** | This repo → `npx expo export -p web` → **Vercel** | Engineering | Git push → Vercel |
| **Native apps** | This repo → **EAS / Gradle / Xcode** prebuild | Engineering | Store submission / sideload |
| **Supabase** | Hosted project (Auth + Postgres + RLS) | Engineering + SQL migrations | `supabase db push` / dashboard |
| **Stream Finder mirror** | Supabase tables (`stream_finder_*`, `movie_availability`) | Operator sync script | `npm run sync:stream-finder` |
| **Third-party APIs** | TMDB, RapidAPI, OMDb, Stream Finder | External; keys in `.env` | Key rotation in env + redeploy |

---

## 2. Secrets & environment tiers

| Tier | Prefix / location | Ships in client? | Used for |
| :--- | :--- | :---: | :--- |
| **Client bundle** | `EXPO_PUBLIC_*` in `.env` | **Yes** (Web, iOS, Android, TV) | Supabase anon, TMDB, RapidAPI, OMDb |
| **Vercel / server** | `TMDB_API_KEY`, `RAPIDAPI_KEY` (no `EXPO_PUBLIC_`) | **No** | `app/api/*`, `api/streaming.ts` on web deploy |
| **Operator / CI only** | `SUPABASE_SERVICE_ROLE_KEY`, `STREAM_FINDER_KEY` | **Never** | Sync scripts, audits, migrations |
| **QA / email** | `RESEND_*`, `MAESTRO_TEST_USER_*` | **No** | `npm run report:qa`, Maestro |

**Rule:** If a new feature needs a **private** key, do **not** add `EXPO_PUBLIC_` — use a server route (web) or Supabase Edge Function, or accept native direct calls only where keys are already client-exposed.

Full checklist: [`.env.example`](../.env.example) · [`docs/API-ENDPOINTS.md`](API-ENDPOINTS.md).

---

## 3. Data stores & authority

| Data | Authoritative source | App read path | App write path |
| :--- | :--- | :--- | :--- |
| **Curated Discover catalog** | Stream Finder → **`stream_finder_movies`** | `lib/stream-finder-supabase.ts` | Sync script only |
| **Provider roster (16 services)** | Stream Finder → **`stream_finder_providers`** | Discover, Profile, pruning | Sync script only |
| **Per-title availability (mirror)** | Stream Finder → **`movie_availability`** | Discover badges, list logos | Sync script only |
| **Title metadata (canonical row)** | **`media`** (hydrated TMDB + ingest) | Movie detail, joins | `/api/movie`, `/api/search`, client TMDB |
| **User identity** | Supabase **`auth.users`** | Session everywhere | `/login`, `/signup` |
| **Profile preferences** | **`profiles`** (enabled services, etc.) | Profile, Discover filter | Profile save |
| **Watchlist** | **`watchlist`** + **`media`** | Watchlist tab, contexts | Client Supabase CRUD |
| **Watched shelf + ratings** | **`user_library.personal_rating`** | Watched tab, stats, movie detail shelf | Client Supabase INSERT/UPDATE/DELETE |
| **Legacy watched toggle** | **`watched_history`** | Context status only | `lib/watchlist-status-context.tsx` |
| **External scores (IMDb/RT/MC)** | **`media`** OMDb columns | Movie detail chips | `lib/ratings.ts` + cache upsert |
| **Live streaming links (per session)** | RapidAPI Streaming Availability | Movie detail **Watch on** | Fetch at runtime; web may use `/api/streaming` proxy |

**Schema doc:** [`docs/database_schema.md`](database_schema.md)  
**Migrations:** `supabase/migrations/` only — apply with Supabase CLI / MCP; update schema doc when columns change.

---

## 4. User interactions → systems touched

Use this when planning a feature: “If the user does X, what breaks if I only change Y?”

### 4.1 Anonymous visitor

| User action | Client | Backend / APIs | Update checklist |
| :--- | :--- | :--- | :--- |
| Open app (web) | `app/index.tsx`, hosting | Vercel SPA rewrite | Redeploy web; marketing “Coming soon” may be **hosting-layer** |
| Open app (TV, logged out) | `app/tv-landing.tsx`, `/login` | Supabase optional | TV: `npm run tv:clean` if native manifest/plugins change |
| Browse public marketing site | **Separate repo** (getreeldive.com) | None in this app | Update landing repo + [`docs/marketing/FAQ.md`](marketing/FAQ.md) |

### 4.2 Authentication

| User action | Client | Backend / APIs | Update checklist |
| :--- | :--- | :--- | :--- |
| Sign up / log in | `app/login.tsx`, `app/signup.tsx`, `lib/supabase.ts` | Supabase Auth | Auth settings in dashboard; RLS unchanged unless new tables |
| Session persists | Web: localStorage; native: AsyncStorage | Supabase refresh | Test all surfaces after auth rule changes |
| Log out | Profile / session handlers | Supabase | Clear local state patterns in contexts |

### 4.3 Browse & discover

| User action | Client | Backend / APIs | Update checklist |
| :--- | :--- | :--- | :--- |
| Default Discover grid | `app/(tabs)/discover.tsx`, `lib/stream-finder-supabase.ts` | **`stream_finder_movies`** mirror | Run **`npm run sync:stream-finder`** after upstream catalog changes; do **not** hand-edit mirror as source of truth |
| Apply filters (year, genre, providers) | Same + TMDB Discover | TMDB API | Client env `EXPO_PUBLIC_TMDB_API_KEY`; TV grid rules in [`docs/depts/tv.md`](depts/tv.md) |
| Home rails / hero | `app/(tabs)/index.tsx`, `HomeTvMovieRow` | TMDB trending + mirror | TV layout: fixed poster grid; web: `viewport-utils` |
| Open movie from grid | Router → `app/movie/[id].tsx` | TMDB id and/or Supabase `media.id` | Ensure route params match both id types |

### 4.4 Search

| User action | Client | Backend / APIs | Update checklist |
| :--- | :--- | :--- | :--- |
| Search movies | `app/(tabs)/search.tsx` | TMDB `/search/movie` | Client TMDB key; TV focus bridge for search field |
| Admin ingest (not user UX) | — | `POST /api/search` | Vercel env + server TMDB key |

### 4.5 Movie & person detail

| User action | Client | Backend / APIs | Update checklist |
| :--- | :--- | :--- | :--- |
| View metadata, cast, trailer | `app/movie/[id].tsx` | TMDB; Supabase `media`; **`/api/movie`** fallback on web; [`lib/tmdb-trailer.ts`](../../lib/tmdb-trailer.ts) | Release TV: prefer **direct TMDB** for trailers when Vercel unreachable; pick **official** + max **`size`** |
| **Watch trailer (16:9 modal)** | `TrailerPlayer`, [`lib/trailerLayout.ts`](../../lib/trailerLayout.ts) | YouTube iframe (adaptive quality) | Modal centered pillarbox; **`computeTrailerPlayerLayout`**; Maestro: **`test:trailer-maestro`** |
| View IMDb / RT / Metacritic | Same | OMDb → `media` cache | `EXPO_PUBLIC_OMDB_API_KEY`; migration on `media` if new columns |
| Tap cast (navigate) | Cast cards | TMDB person id required | Supabase UUID cast → inert (no nav) |
| Recommendations rail | Same | TMDB recommendations | Client TMDB |
| **Watch on** / open streamer | `WatchOnButton`, `lib/linking-utils.ts` | RapidAPI availability; Android intents | [`docs/depts/tv.md`](depts/tv.md) package matrix + `withAndroidStreamingPackageQueries`; web HTTPS |
| **Add to Watched** + rate | Movie detail + `StarRating` | **`user_library`** INSERT + UPDATE rating | Migration + RLS if new columns; modal UX web + TV |
| Person page | `app/person/[id].tsx` | TMDB person API | Numeric TMDB id only |

### 4.6 Watchlist

| User action | Client | Backend / APIs | Update checklist |
| :--- | :--- | :--- | :--- |
| Add / remove | `watchlist.tsx`, `watchlist-status-context` | **`watchlist`** | RLS policies; optimistic UI |
| Reorder (up/down) | Watchlist tab | **`watchlist.order_index`** / RPC | Optional: `/api/watchlist-reorder` on web |
| Provider logos on rows | Cached branding libs | TMDB providers + cache TTL | `lib/` provider cache; 14-day TTL pattern |
| Mark watched (legacy toggle) | Context | **`watched_history`** | **Split-brain:** does not update Watched tab — cleanup queued |

### 4.7 Watched shelf & ratings

| User action | Client | Backend / APIs | Update checklist |
| :--- | :--- | :--- | :--- |
| View list + stats | `app/(tabs)/watched.tsx`, `WatchedHistoryStats` | **`user_library`** + `media` | Stats scale 1–5; query embeds |
| Rate / edit rating | `StarRating`, row rate cell | **`user_library.personal_rating`** UPDATE | RLS UPDATE policy; TV split-row focus |
| Remove from Watched | Movie detail or future UI | DELETE **`user_library`** | Cascade rules on `media_id` FK |

### 4.8 Profile

| User action | Client | Backend / APIs | Update checklist |
| :--- | :--- | :--- | :--- |
| Toggle My Services | `app/(tabs)/profile.tsx` | **`profiles`**, **`stream_finder_providers`** | After sync, pruning removes dead provider ids |
| Save preferences | Profile save bar | Supabase UPDATE | TV: save bar pinned outside scroll list |

---

## 5. Product update types → what to change

When Product asks for a change, use this matrix to see **all layers** that may need work.

| Update type | Client (`app/`, `components/`) | Supabase | Migrations / RLS | Sync / scripts | APIs & env | TV-specific | Web deploy | Stores / marketing |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **New UI on existing screen** | ● | ○ | ○ | — | ○ | ● if TV layout | ● if web-only CSS | ○ |
| **New tab / route** | ● | ○ | ○ | — | — | ● sidebar slot | ● | ○ screenshots |
| **New user data field** | ● | ● | ● | — | — | ○ | — | — |
| **New list / collection** | ● | ● | ● | — | — | ● focus pattern | — | — |
| **Change Discover default catalog** | ○ | ● (mirror) | — | ● **`sync:stream-finder`** | ○ Stream Finder | ○ | — | ○ copy if count changes |
| **Add streaming provider** | ● logos, intents | ● mirror | — | ● sync + audit | ○ RapidAPI | ● `<queries>`, matrix in `tv.md` | — | ○ store listing |
| **New external API** | ● lib wrapper | ○ cache table? | ○ | ○ | ● keys + docs | ○ | ● server route? | — |
| **Auth rule change** | ● | ● policies | ● | — | — | — | — | — |
| **Movie detail enrichment** | ● `[id].tsx` | ● `media` | ○ | ○ | ● TMDB/OMDb | ● focus ladder | ○ `/api/movie` | — |
| **Handoff to native streamer app** | ● WatchOnButton | — | — | — | ● RapidAPI | ● intents | ○ HTTPS | — |
| **Pre-GA web gate / countdown** | ○ | — | — | — | — | — | ● hosting/marketing | ● [`marketing.md`](depts/marketing.md) |
| **Android TV release** | ● | ○ | ○ | — | ○ | ● **`tv:clean`**, QA | — | ● Play Console |
| **iOS / handset release** | ● | ○ | ○ | — | ○ | ○ split **`isTV`** flavor | — | ● App Store Connect |

**Legend:** ● = usually required · ○ = sometimes · — = rarely

---

## 6. Deployment & rebuild triggers

| Change | Web (Vercel) | Android TV | iOS / handset | Supabase | Operator |
| :--- | :--- | :--- | :--- | :--- | :--- |
| JS/TS UI only | Redeploy | Reload Metro / new build | New build | — | — |
| `EXPO_PUBLIC_*` env | Redeploy + env in Vercel | Rebuild app | Rebuild app | — | — |
| `app.config.ts` plugin | Redeploy | **`npm run tv:clean`** | Prebuild + rebuild | — | — |
| SQL migration | — | — | — | **`supabase db push`** | — |
| Stream Finder upstream data | — | — | — | Tables updated by sync | **`npm run sync:stream-finder`** |
| RLS / policy only | — | — | — | Dashboard or migration | — |
| Marketing FAQ / positioning | — | — | — | — | Landing repo + `FAQ.md` |

**Web build:** `vercel.json` → `npx expo export -p web` → `dist/`  
**TV native:** `npm run tv:clean` after network security, streaming `<queries>`, or TV manifest changes — see [`docs/depts/tv.md`](depts/tv.md).

---

## 7. Cross-surface parity quick reference

| Concern | Shared? | Where surfaces diverge |
| :--- | :--- | :--- |
| Routes & auth | Yes | TV landing vs web index |
| Discover data | Yes | Grid math: web responsive vs TV fixed 140×210 |
| Watchlist / Watched | Yes | TV D-pad focus; split cells on Watched |
| Profile | Yes | TV pinned save bar |
| `/api/*` routes | **Web-biased** | Native uses direct TMDB/Supabase/RapidAPI |
| Streaming launch | Partial | Android TV intents vs web HTTPS vs iOS fallback |

Detail: [`docs/depts/web-tv-parity.md`](depts/web-tv-parity.md).

---

## 8. Documentation map (when you change infrastructure)

| You changed… | Update these docs |
| :--- | :--- |
| New table / column | `supabase/migrations/`, `docs/database_schema.md`, possibly `reeldive_state.md` |
| New env var | `.env.example`, `docs/API-ENDPOINTS.md` |
| New `/api` route | `app/api/`, `docs/API-ENDPOINTS.md`, `docs/NATIVE_OPERATIONAL_URLS.md` |
| TV layout / focus | `docs/depts/tv.md`, `docs/tv_layout_rules.md` |
| Product milestone | `docs/depts/product.md`, `reeldive_state.md`, `assistant.md` (session log) |
| User-facing promise | `docs/depts/marketing.md`, `docs/marketing/FAQ.md` |
| Android streaming packages | `plugins/withAndroidStreamingPackageQueries.js`, `lib/linking-utils.ts`, `docs/depts/tv.md` |

---

## 9. Known structural gaps (planning)

These affect **what to update** when touching “watched” behavior:

1. **`watched_history` vs `user_library`** — Watched tab uses **`user_library`**; global toggle still writes **`watched_history`**. Unifying requires context + migration plan — see [`docs/depts/product.md`](depts/product.md).
2. **`android.isTV: true`** — Handset builds may share TV shell until EAS flavors split.
3. **No CI workflow in repo** — QA is operator-driven (`npm run report:qa`).

---

## 10. Planned: monetization & paywall (not built)

**Product spec:** [`docs/depts/product.md`](depts/product.md) — **Monetization & paywall**.

When implemented, expect changes across:

| Layer | Likely work |
| :--- | :--- |
| **Supabase** | Subscription / entitlement columns on **`profiles`** or dedicated table; trial start/end timestamps; **`data_retention_until`** or soft-delete flags on user-owned rows (`watchlist`, **`user_library`**, etc.). |
| **RLS / gates** | Policies or client checks that block paywalled writes/reads after trial unless entitled. |
| **Client** | Paywall UI, trial banners, locked states on gated features; store purchase flows (web + mobile + TV store rules differ). |
| **Jobs** | Cron / Edge Function: after trial expiry → 2-week hold → purge or anonymize if still not subscribed. |
| **Marketing / legal** | Trial terms, grace-period copy, deletion notice — [`docs/depts/marketing.md`](depts/marketing.md). |

**Track build tasks:** [`assistant.md`](../assistant.md) cross-session backlog.

---

*Last updated: 2026-06-06. Refresh when deployment topology, authority tables, or major product surfaces change.*
