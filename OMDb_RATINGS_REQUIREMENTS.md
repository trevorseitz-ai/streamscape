# OMDb Ratings Integration — Requirement Doc

> **Status (June 2026):** Migration applied; **`media`** stores OMDb fields. **IMDb, Rotten Tomatoes, and Metacritic** chips render on **`app/movie/[id].tsx`** when cached data exists. Personal **1–5 star ratings** are a separate system on **`user_library.personal_rating`** — see [`docs/depts/product.md`](docs/depts/product.md).

---

## 1. Research (Supabase `media` table)

**Live `public.media` table** includes OMDb columns (migration **`supabase/migrations/20250101001000_media_omdb_ratings.sql`**):

| Column | Type | Purpose |
|--------|------|--------|
| `imdb_id` | `VARCHAR(20)` UNIQUE, nullable | IMDb id (`tt…`) from TMDB `external_ids` |
| `imdb_rating` | `TEXT`, nullable | OMDb `imdbRating` (e.g. `8.4`) |
| `rt_score` | `TEXT`, nullable | Rotten Tomatoes Tomatometer (e.g. `93%`) |
| `metascore` | `TEXT`, nullable | OMDb `Metascore` |
| `ratings_fetched_at` | `TIMESTAMPTZ`, nullable | Last successful OMDb fetch (TTL) |

**API key:** `EXPO_PUBLIC_OMDB_API_KEY` in `.env`.

---

## 2. Library (`lib/ratings.ts`)

**Shipped:** `getOmdbScores(imdbId)` → `{ imdbRating, rottenTomatoes, metascore }` (nullable strings).

**IMDb id source on Movie Details:**

1. TMDB route: GET `/movie/{id}/external_ids` → `imdb_id`.
2. Read/cache `media.imdb_id` when opening a UUID-backed row.

**Persistence:** On successful fetch, upsert `media` with scores + `ratings_fetched_at`, respecting TTL (similar to streaming cache).

---

## 3. Movie Details UI

**Screen:** `app/movie/[id].tsx`

**Shipped (June 2026):** Ratings row shows **RT**, **Metacritic**, and **IMDb** chips when OMDb/cache data is present. Missing scores are omitted (no `N/A` clutter).

**Behavior:**

- Hide a badge entirely if that score is null.
- Match existing dark UI (`#0f0f0f` context).
- **Accessibility:** `accessibilityLabel` per badge including source and value.

**Legal / brand:** Confirm logo/attribution rules for RT, Metacritic, and IMDb before external marketing uses official marks.

**Out of scope:**

- Personal user ratings (handled by **`user_library.personal_rating`** / [`components/StarRating.tsx`](components/StarRating.tsx)).
- TV episodes / Metacritic TV rules.

---

## 4. Acceptance criteria (summary)

- [x] Migration applied so `media` stores `imdb_id`, `imdb_rating`, `rt_score`, `metascore`, `ratings_fetched_at`.
- [x] `lib/ratings.ts` returns scores from OMDb given a valid `imdb_id` and API key.
- [x] Movie Details shows RT + Metacritic + **IMDb** when data exists, with loading/empty states.
- [x] No API key committed; env documented for developers.
- [ ] Logo/attribution legal review for external marketing (engineering display shipped).

---

## 5. Approval gate

**Remaining:** Confirm **logo/attribution** approach for RT / Metacritic / IMDb in **marketing/store** copy if official brand assets are used beyond in-app chips.
