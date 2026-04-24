# 📺 TV App Office (Lean-back Experience)

## 🚀 Running the TV Emulator

### Prerequisites

- Install **Android Studio**.
- In **Device Manager**, create an **Android TV** Virtual Device (AVD) and keep it available for runs.

### Startup steps

1. **Boot the emulator first:** Android Studio → **Device Manager** → click **Play** on your Android TV AVD. Wait until the **TV home screen** is fully loaded.
2. **Start the Expo server:** From the project root in a terminal, run:

   ```bash
   npx expo start --clear
   ```

   The `--clear` flag avoids stale Metro/web cache interfering with the native TV build.

3. **Launch on Android:** When the Expo CLI is up, press **`a`** in that terminal to open the app on the **active Android TV** emulator.

### Note

**D-pad** behavior is exercised with the **arrow keys** on your physical keyboard while the **emulator window has focus**.

- **Focus debugging:** The `MovieCard` and TV poster cells (`HomeTvPosterCell`, `DiscoverTvPosterCell`) are equipped with a **Focus Trail**. Watch the Metro terminal for `[D-PAD FOCUS]` / `[D-PAD BLUR]` logs (development builds) to see which item the focus engine is highlighting during emulator navigation.

---

## 🔐 Environment Variables

Before running the emulator, duplicate `.env.example`, rename it to `.env`, and populate it with your active API keys and Supabase credentials.

---

## 🏗️ API Architecture & Data Flow

### 1. The core services

| Service | Role | Key variable(s) |
|--------|------|-----------------|
| **TMDB** | The metadata engine. Handles search, discovery, trending, posters, and cast/crew data. | `EXPO_PUBLIC_TMDB_API_KEY` (client), `TMDB_API_KEY` (server / Node) |
| **RapidAPI** | The streaming bridge. Provides live “where to watch” deep links and regional availability by TMDB id. | `EXPO_PUBLIC_RAPIDAPI_KEY` *(no underscore between `RAPID` and `API`)* |
| **Supabase** | The source of truth. Manages auth, user watchlists, and caches canonical media rows synced from TMDB. | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| **OMDB** | Ratings provider. Optional fetch for IMDb, Rotten Tomatoes, and Metacritic scores. | `EXPO_PUBLIC_OMDB_API_KEY` |

### 2. Data synchronization logic

- **Discovery flow:** TMDB results from `/discover` or `/search` are mapped to the UI. When a title is interacted with, it is upserted into the Supabase `media` table to ensure persistent state.
- **Live links:** The movie screen uses [`lib/streaming-rapid.ts`](../../lib/streaming-rapid.ts) to fetch real-time outbound links (e.g. Netflix, Max) via the `streaming-availability` RapidAPI host.
- **UI context:** The TV app primarily consumes **TMDB** for browsing but relies on **Supabase** for the ReelDive personalized experience (watchlists and watched history).

### 3. Environment configuration

Before booting the emulator, ensure the `.env` file follows the **RapidAPI** naming convention (`EXPO_PUBLIC_RAPIDAPI_KEY` — no extra underscore) so it matches the logic in `lib/streaming-rapid.ts`.

---

## Core logic

TV is driven by **explicit focus**, not desktop-style layout alone. The **Focus Bridge** — [`lib/tv-search-focus-context.tsx`](../../lib/tv-search-focus-context.tsx) — ties together regions (sidebar, search, horizontal rows) so focus can move predictably across the screen.

**D-pad navigation** is implemented with React Native TV primitives: **`nextFocus*`** props, native focus tags via [`hooks/useTvNativeTag.ts`](../../hooks/useTvNativeTag.ts), and the left rail in [`components/TvSidebarTabBar.tsx`](../../components/TvSidebarTabBar.tsx). Row geometry and margins follow [`docs/tv_layout_rules.md`](../tv_layout_rules.md); home horizontal lists use [`components/HomeTvMovieRow.tsx`](../../components/HomeTvMovieRow.tsx).

## List Rendering & Focus Stability (The Box Rule)

> **The Box Rule (Deferred Sorting).** Never dynamically re-sort or re-order a `FlatList` or `ScrollView` based on an active user click (e.g. clicking “Add” moving an item to the top of the list).

**Why:** React Native destroys the physical DOM nodes during live re-sorts. If the native Android TV spatial engine is holding focus on a node when it is destroyed, the engine panics and throws the focus to the top-left of the screen (typically the **Sidebar**).

**The Fix:** Lock the sort order when the component mounts or when a search query is executed. When a user clicks an item, apply a **visual toggle** (e.g. change the border color, opacity, or add a checkmark icon) via state, but **do not** move the item in the array. Defer the actual re-sorting of the list until the next time the user mounts the screen.
