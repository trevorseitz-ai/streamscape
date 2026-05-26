# API endpoints (ReelDive)

This document lists **HTTP(S) APIs and first-party route handlers** the app uses, and what each is for. Values in **angle brackets** come from your environment (`.env` / hosting).

---

## 1. First-party routes (Expo Router / web)

These live under `app/api/*+api.ts`. On web, they are served at **`/api/...`** relative to the deployment origin (e.g. Vercel). Native builds typically call them via **`{devServerOrOrigin}/api/...`** when enriching from the movie screen.

| Route | Method | Purpose |
|--------|--------|---------|
| **`/api/movie`** | `GET` | Loads or refreshes a **Supabase `media`** row by id, enriches from **TMDB** (details, credits, watch providers, videos/trailer), and writes related **`media_cast_crew`** / **`media_availability`** rows. Used when the client needs a **trailer key** or full metadata for a Supabase-backed movie. |
| **`/api/search`** | `POST` | **Admin-style ingest:** given a search query, finds a film via **TMDB search**, pulls credits, upserts **`media`** + availability + cast in **Supabase**. Intended for backfill / tooling, not the main in-app search UX. |
| **`/api/discover`** | `GET` | **Discover pipeline / sync:** fetches from **TMDB**, upserts **`media`** and availability into **Supabase** for curated discover data (see handler query params in `app/api/discover+api.ts`). |
| **`/api/providers`** | `GET` | Returns **US watch provider metadata** from **TMDB** (`/watch/providers/movie`) as JSON: ids, names, logo URLs (w92). Used to align provider lists with TMDB. |
| **`/api/watchlist-reorder`** | `POST` | Persists **watchlist sort order** for a user: calls Supabase RPC **`update_watchlist_order`** or falls back to per-row **`watchlist`** updates. |

### Vercel-only serverless route

| Route | Method | Purpose |
|--------|--------|---------|
| **`/api/streaming`** | `GET` | **Proxy** for **RapidAPI Streaming Availability**: query params `tmdbId`, `type` (`movie` \| `show`), `country`. Keeps **`RAPIDAPI_KEY`** off the browser on production web. Implemented in `api/streaming.ts`. Native / TV usually call RapidAPI **directly** from `lib/streaming-rapid.ts` instead. |

`vercel.json` rewrites non-`api` paths to the SPA; **`/api/*`** is excluded from that rewrite so these handlers stay addressable on web.

---

## 2. Supabase (project URL)

**Base URL:** `EXPO_PUBLIC_SUPABASE_URL` (e.g. `https://<project-ref>.supabase.co`)

The **JavaScript client** (`lib/supabase.ts`, `lib/supabase-server.ts`) talks to standard Supabase HTTP APIs; you rarely hardcode full paths in app code.

| Area | Typical path pattern | Purpose in this app |
|------|----------------------|---------------------|
| **Auth** | `/auth/v1/*` | Email/password sign-up and sign-in, sessions, `getSession` / `onAuthStateChange`. |
| **REST (PostgREST)** | `/rest/v1/*` | Row CRUD: e.g. **`watchlist`**, **`user_library`**, **`user_profiles`**, **`media`**, and other tables used on Home, **Watched**, Watchlist, Profile, Movie detail. |
| **RPC** | `/rest/v1/rpc/*` | **`update_watchlist_order`**, Stream Finder sync helpers (e.g. **`truncate_stream_finder_cache`** in `lib/services/stream-finder-sync.ts`). |
| **Health (diagnostics)** | `/auth/v1/health` | Optional reachability check in `app/dev/network-diag.tsx`. |

**Server / scripts** use **`SUPABASE_SERVICE_ROLE_KEY`** (never ship to clients) for admin sync jobs (`lib/supabase-server.ts`, `stream-finder-sync`, migrations).

---

## 3. The Movie Database (TMDB) API v3

**Base URL:** `https://api.themoviedb.org/3`

**Auth:** `Authorization: Bearer <TMDB_API_KEY or read token>` (server routes) or `EXPO_PUBLIC_TMDB_API_KEY` (client screens). Helper: `lib/tmdbFetch.ts` (`buildTmdbUrl`).

**Image CDN (not the JSON API, but used everywhere):**

- `https://image.tmdb.org/t/p/<size>/<path>` — posters, backdrops, provider logos (sizes like `w92`, `w500`, `original`).

Representative **paths** used across the codebase:

| Path | Used for |
|------|----------|
| **`GET /discover/movie`** | Discover grid: filters (genre, year, region, watch providers, monetization). `app/(tabs)/discover.tsx`. |
| **`GET /search/movie`** | Search-ingest API; movie lookup by query. `app/api/search+api.ts`. |
| **`GET /movie/{id}`** | Movie detail (also vote average on Watched tab rows). Various screens + APIs. |
| **`GET /movie/{id}/credits`** | Cast/crew for movie detail / ingest. |
| **`GET /movie/{id}/watch/providers`** | Where to watch badges (watchlist, Watched tab list, movie detail snapshots). |
| **`GET /movie/{id}/recommendations`** | Recommendation rail on movie detail (`app/movie/[id].tsx`). |
| **`GET /videos`** (append to movie append) | Trailer YouTube key; movie API routes. |
| **`GET /watch/providers/movie`** | US provider catalog for `/api/providers`. |
| **`GET /person/{id}`**, **`GET /person/{id}/movie_credits`** | Person detail screen (`app/person/[id].tsx`). |

---

## 4. RapidAPI

### 4a. Streaming Availability API

| Item | Value |
|------|--------|
| **Host** | `streaming-availability.p.rapidapi.com` |
| **Example path** | `GET https://streaming-availability.p.rapidapi.com/shows/{movie|show}/{tmdbNumericId}?country=...&output_language=en` |
| **Headers** | `x-rapidapi-key`, `x-rapidapi-host` |
| **Purpose** | Per-title **streaming options** (service names, links, `videoLink`, optional catalog ids). Consumed via `lib/streaming-rapid.ts` → `lib/streaming.ts` (and mirrored by **`/api/streaming`** on Vercel web). |

### 4b. Film & Show (Ratings / hub — RapidAPI product)

| Item | Value |
|------|--------|
| **Host** | `EXPO_PUBLIC_RAPIDAPI_FILMSHOW_HOST` (your subscribed API host, e.g. `film-show-ratings.p.rapidapi.com`) |
| **Path** | Defaults to **`/top-100-items`** unless overridden by `EXPO_PUBLIC_RAPIDAPI_FILMSHOW_TOP_PATH` |
| **Headers** | `X-RapidAPI-Key`, `X-RapidAPI-Host` |
| **Purpose** | **Discover “top list”** source rows; optionally **enriched** with TMDB posters for the first 20 rows (`enrichWithTmdbImages` in `lib/film-show-rapid-discover.ts`). |

---

## 5. Stream Finder (external catalog service)

Default base in code: **`https://stream-finder--trevorseitzai.replit.app`**

Configurable via **`STREAM_FINDER_MOVIES_URL`** / related env vars in `lib/services/stream-finder-sync.ts`.

| Path | Purpose |
|------|---------|
| **`GET /api/movies`** (paginated) | Full movie + availability sync into Supabase (`stream_finder_movies`, `movie_availability`, etc.). |
| **`GET /api/providers`** | Authoritative provider catalog for Stream Finder sync / audits. |
| **`GET /api/status`** | Operator/audit payload (used by `scripts/audit-providers.ts`). |

Authenticated calls use **`STREAM_FINDER_KEY`** where required (see scripts and sync module).

---

## 6. OMDb API

| Item | Value |
|------|--------|
| **Base** | `https://www.omdbapi.com/` |
| **Typical query** | `?i=<imdbId>&apikey=<key>` |
| **Env** | `EXPO_PUBLIC_OMDB_API_KEY` |
| **Purpose** | **IMDb / Rotten Tomatoes / Metacritic** display scores when an IMDb id is known (`lib/ratings.ts` → `getOmdbScores`). |

---

## 7. Scripts & tooling-only HTTP

These are **not** used by the production app bundle in normal flows:

| Endpoint | Purpose |
|----------|---------|
| **`POST https://api.resend.com/emails`** | `scripts/generate-qa-report.ts` — outbound email for QA reports (requires Resend API key in that script’s environment). |

---

## 8. Development & diagnostics

| Target | Purpose |
|--------|---------|
| **Metro bundler** (`http://<lan>:8081/` etc.) | `app/dev/network-diag.tsx` probes dev server reachability. |
| **Supabase `auth/v1/health`** | Same screen: quick Supabase connectivity with anon key. |

---

## Quick env checklist

| Variable(s) | Relates to |
|-------------|------------|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | Server scripts, API routes, Stream Finder sync |
| `TMDB_API_KEY` | Server `app/api/*` routes |
| `EXPO_PUBLIC_TMDB_API_KEY` | Client TMDB fetch (Discover, Library, Watchlist, Person, Movie detail rails) |
| `EXPO_PUBLIC_RAPIDAPI_KEY` / `RAPIDAPI_KEY` | Streaming Availability |
| `EXPO_PUBLIC_RAPIDAPI_FILMSHOW_HOST`, optional `EXPO_PUBLIC_RAPIDAPI_FILMSHOW_TOP_PATH` | Film & Show RapidAPI list |
| `EXPO_PUBLIC_OMDB_API_KEY` | OMDb ratings |
| `STREAM_FINDER_KEY`, `STREAM_FINDER_MOVIES_URL` | Stream Finder sync / audits |

---

*Generated from codebase survey; update this file when you add routes or third-party integrations.*
