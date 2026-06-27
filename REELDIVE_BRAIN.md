# ReelDive — long-term memory

## Database schema

**Canonical content table:** The primary table for movies and TV titles is **`media`**, not `movies`. Rows distinguish kind via **`media.type`** (`'movie'` \| `'tv'`). Related data uses foreign keys into `media` (for example `watchlist.media_id`, `media_availability.media_id`, `media_cast_crew.media_id`).

**Supporting tables (see `docs/database_schema.md` and `supabase/migrations/`):** `people`, `platforms`, `media_availability`, `media_cast_crew`, `user_profiles`, `watchlist`, **`user_library`** (Watched shelf + **`personal_rating`**), `watched_history` (legacy toggle path — not Watched tab authority).

**Migrations:** Single directory **`supabase/migrations/`** (consolidated June 2026).

## Features

### Streaming logos (watch providers)

Provider logos on Watchlist, Watched, and movie detail use **brand-grouped, cached** availability data (14-day TTL) with enabled-service dimming. Movie detail **Watch on** strip uses **`WatchOnButton`** + RapidAPI / Android TV intent matrix.

### Watched shelf & personal ratings (June 2026)

- **`user_library`** — Watched list source of truth.
- **`user_library.personal_rating`** — optional 1–5 stars; migration **`20260605161700_user_library_personal_rating.sql`**.
- UI: [`components/StarRating.tsx`](components/StarRating.tsx) — rate from Watched rows or **Add to Watched** on movie detail.
- Stats: [`components/WatchedHistoryStats.tsx`](components/WatchedHistoryStats.tsx) reads **`user_library`**, 1–5 scale.

**Known gap:** Global watched toggle in **`lib/watchlist-status-context.tsx`** still writes **`watched_history`** only — cleanup queued.

## Finished Features

### OMDb Ratings Integration

RT, Metacritic, and **IMDb** chips on Movie Details (`app/movie/[id].tsx`, `lib/ratings.ts`, `OMDb_RATINGS_REQUIREMENTS.md`, migration `20250101001000_media_omdb_ratings.sql`).

- TTL caching on **`media`** for external scores.
- `imdb_id` as anchor for OMDb fetches.

### Streaming Deep Links

RapidAPI Streaming Availability + **`WatchOnButton`** / Android TV intent matrix (`lib/linking-utils.ts`, `lib/streaming-android-tv-intent.ts`). **16-provider** milestone documented in [`docs/depts/tv.md`](docs/depts/tv.md).

### Android TV lean-back (Phase 1 complete)

- D-pad focus across major tabs; fixed **140×210** poster grid.
- Six-slot sidebar (`TvSidebarTabBar`).
- **Focus Bridge (Home + Search)** — shipped **`cfb2dd7`**; physical TV human sign-off pending. Search: sidebar → suggestions / result poster; stable IME (no input remount on list update).
- **Movie detail actions** — two-row stack (Watchlist + Watched, then full-width Discover More).

## Upcoming Roadmap

See [`docs/depts/product.md`](docs/depts/product.md) **What's next**:

1. Google TV store submission
2. Manual TV QA
3. Watched data model cleanup (`watched_history` ↔ `user_library`)
4. Handset vs TV build split
5. Handset vs TV build split
6. Phase 2 deep linking (iOS)
7. Watchlist cross-device sync

**Point-in-time audit:** [`reeldive_state.md`](reeldive_state.md)

## Backlog (not scheduled)

- Parental guidance / content advisory tags
- Expanded trivia / context integrations
- AI personalization (marketing rules restrict customer-facing chatbot)

Core business logic (Supabase, Stream Finder mirror, TMDB) remains shared across Web, mobile, and Android TV.
