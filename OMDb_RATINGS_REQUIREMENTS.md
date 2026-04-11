# OMDb Ratings Integration — Requirement Doc

## 1. Research (Supabase `media` table)

**Verified via MCP:** The live `public.media` table currently has:

`id`, `type`, `title`, `synopsis`, `release_year`, `poster_url`, `backdrop_url`, `last_scraped_at`, `created_at`, `updated_at`, `tmdb_id`.

**It does not** include `rt_score`, `metascore`, or `imdb_rating` (or `imdb_id`).

### Proposed DDL

Apply when approved (see `database/migrations/009_media_omdb_ratings.sql`):

| Column | Type | Purpose |
|--------|------|--------|
| `imdb_id` | `VARCHAR(20)` UNIQUE, nullable | IMDb id (`tt…`) from TMDB `external_ids`; required for stable OMDb requests and DB caching |
| `imdb_rating` | `TEXT`, nullable | OMDb `imdbRating` (e.g. `8.4`) |
| `rt_score` | `TEXT`, nullable | Rotten Tomatoes Tomatometer (e.g. `93%`) |
| `metascore` | `TEXT`, nullable | OMDb `Metascore` |
| `ratings_fetched_at` | `TIMESTAMPTZ`, nullable | Last successful OMDb fetch (TTL / avoid hammering API) |

**Note:** Storing scores as `TEXT` preserves OMDb string forms; the app can parse for UI. Add index on `imdb_id` where not null.

**API key:** Use `EXPO_PUBLIC_OMDB_API_KEY` (provided by you after sign-off). Document in `README` / env example only after the value is available.

---

## 2. Library (`lib/ratings.ts`)

**Shipped:** `getOmdbScores(imdbId)` → `{ imdbRating, rottenTomatoes, metascore }` (nullable strings), modeled after the streaming helper pattern: normalize id, env-guarded fetch, parse JSON, dev-only `console.warn` on failure (no user-facing debug alerts).

**IMDb id source on Movie Details:**

1. TMDB route: GET `/movie/{id}/external_ids` → `imdb_id`.
2. After migration: read/cache `media.imdb_id` when opening a UUID-backed row.

**Persistence (later task, not required to merge `ratings.ts`):** On successful fetch, upsert `media` with the three scores + `ratings_fetched_at`, respecting a TTL (e.g. 7 days) similar in spirit to streaming cache.

---

## 3. Movie Details UI — goals

**Screen:** `app/movie/[id].tsx`

**Placement:** Adjacent to the **title row** (same horizontal band as the title text), show:

1. **Rotten Tomatoes** — official **“Tomato”** brand asset (licensed/red tomato icon), next to the RT score text (from `rt_score` / OMDb Ratings `Rotten Tomatoes` value).
2. **Metacritic** — official **square** mark (Metacritic’s yellow square / brand guidelines), next to the Metascore.

**IMDb:** Show **IMDb rating** (e.g. `8.4/10`) with IMDb’s brand rules (link-out optional; do not misrepresent as official IMDb app unless compliant).

**Behavior:**

- **Loading:** Small skeleton or inline placeholder next to title until scores resolve (or confirm absent).
- **Missing data:** Hide a badge entirely if that score is null (do not show `N/A` clutter unless product prefers it).
- **Order:** e.g. `[Title] … [RT tomato + %] [MC square + score] [IMDb]` — exact order TBD with design.
- **Accessibility:** `accessibilityLabel` per badge including source and value.
- **Theming:** Match existing dark UI (`#0f0f0f` context); ensure contrast for yellow/green/red brand elements.

**Legal / brand:** Rotten Tomatoes, Metacritic, and IMDb have **trademark and logo usage rules**. Before shipping, confirm:

- Approved artwork (or text-only fallback where logos are disallowed).
- Attribution if required (footer line: “Ratings by OMDb” / per OMDb terms).

**Out of scope for v1 (optional follow-ups):**

- TV episodes / Metacritic TV rules.
- Writing scores back from every TMDB-only view without `imdb_id` (must resolve external id first).

---

## 4. Acceptance criteria (summary)

- [ ] Migration applied (or equivalent) so `media` can store `imdb_id`, `imdb_rating`, `rt_score`, `metascore`, `ratings_fetched_at`.
- [ ] `lib/ratings.ts` returns the three scores from OMDb given a valid `imdb_id` and API key.
- [ ] Movie Details loads IMDb id when possible, fetches ratings, and shows RT + Metacritic (and IMDb if in scope) beside the title with correct icons and loading/empty states.
- [ ] No API key committed; env documented for developers.

---

## 5. Approval gate

**Blocked on:** Your **OMDb API key** (`EXPO_PUBLIC_OMDB_API_KEY`) and confirmation of **logo/attribution** approach for RT / Metacritic / IMDb.

After approval, implement UI wiring + optional `media` upsert + TTL in a follow-up PR.
