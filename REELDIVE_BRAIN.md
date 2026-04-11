# ReelDive / StreamScape — long-term memory

## Database schema

**Canonical content table:** The primary table for movies and TV titles is **`media`**, not `movies`. Rows distinguish kind via **`media.type`** (`'movie'` \| `'tv'`). Related data uses foreign keys into `media` (for example `watchlist.media_id`, `media_availability.media_id`, `media_cast_crew.media_id`).

**Supporting tables (see `database/schema.sql` and migrations):** `people`, `platforms`, `media_availability`, `media_cast_crew`, `user_profiles`, `watchlist`, `watched_history`.

## Features

### Streaming logos (TMDB watch providers)

**Status:** Verified and stable.

Provider logos in the movie detail UI come from TMDB watch-provider payloads (`logo_path` → full image URL). The “Where to Watch” provider grid uses these logos together with the user’s enabled services from `user_profiles.enabled_services` (or local provider preferences when logged out).

## Finished Features

### OMDb Ratings Integration

Rotten Tomatoes and Metacritic scores on Movie Details (`app/movie/[id].tsx`, `lib/ratings.ts`, `OMDb_RATINGS_REQUIREMENTS.md`, migration `009_media_omdb_ratings.sql`).

- Implemented 7-day TTL caching for Rotten Tomatoes and Metacritic scores.
- Using `imdb_id` as the primary anchor for external rating fetches.

### Streaming Deep Links

RapidAPI Streaming Availability options on Movie Details open provider URLs via **`expo-linking`** (`handleStreamingPress` in `app/movie/[id].tsx`). Rows without a valid `link` are omitted; each actionable row uses **`TouchableOpacity`** (`activeOpacity={0.7}`) with **`accessibilityLabel`** `Watch on {service}`.

## Upcoming Roadmap

### Future Enhancements (Backlog)

- [ ] **Parental Guidance:** Integrate Content Advisory tags (Violence, Language, etc.).
- [ ] **Video Integration:** YouTube Data API for native trailer playback and clips.
- [ ] **Trivia & Context:** Wikipedia/WikiData integration for cast bios and movie trivia.
- [ ] **AI “Vibe” Engine:** LLM-powered personalization (e.g., “Movies for a rainy Sunday”).
