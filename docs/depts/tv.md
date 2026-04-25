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

## Spatial Engine Routing & Focus Graphs

### 1. The Left-Edge Ladder (Vertical Navigation)

**Rule:** When navigating vertically between distinct horizontal lists (e.g. from a Cast row down to a Crew row), focus **must** snap to the first item (index 0) of the target row.

**Implementation:** Capture the native tag of the first item in each row. Apply `tvNextFocusUp` and `tvNextFocusDown` to every item in a row, pointing them directly to the native tags of the adjacent rows. Do not rely on the spatial proximity engine for jumping between distinct sections.

### 2. The Right-Edge Wall (Horizontal Navigation)

**Rule:** Horizontal lists must not diagonally wrap to other sections when the user reaches the end of the list.

**Implementation:** For the last item in a horizontal list (`index === array.length - 1`), capture its native tag and set `tvNextFocusRight={itsOwnNativeTag}`. This traps the D-pad and prevents diagonal drift.

### 3. No Nested Pressables

**Rule:** Never wrap a `Pressable` inside another `Pressable`, and avoid wrapping custom button components if that obscures the root interactive element.

**Implementation:** Android TV focus graphs break when interactable elements are nested. Apply TV navigation props (`hasTVPreferredFocus`, `tvNextFocus*`) directly to the root native interactive component.

### 4. Avoid Fallback Race Conditions

**Rule:** Do not use `?? fallbackTag` in `tvNextFocus*` assignments if the primary target **exists** on the screen (even if its tag is not ready yet).

**Implementation:** Native tags initialize as `null` for a few milliseconds. If you use a fallback, the spatial engine can permanently wire the UI to that fallback before the primary tag loads. Let the primary tag stay `null` until it mounts; the engine will wire it correctly once the tag populates.

### 5. The Typewriter Wrap (Carriage Return)

**Rule:** In a multi-row grid, reaching the far-right edge of a row should wrap focus to the first item of the next row down.

**Implementation:** Capture the entry tag of the next row (`nextRowEntryTag`). On the last item of the current row, set `tvNextFocusRight={nextRowEntryTag ?? localTag}`.

### 6. Universal Left-Edge Sidebar Escape

**Rule:** The left-most column of any content grid or list must always serve as an escape hatch to the main Sidebar navigation. Do not implement “reverse wrap” (left wrapping to the end of the previous row).

**Implementation:** For `index === 0` of every row, strictly set `tvNextFocusLeft={sidebarTag ?? localTag}`. This keeps “left” from any row’s first cell moving focus to the menu, no matter how far the user has scrolled.

### 7. The Self-Trap Fallback (Ghost Tags)

**Rule:** Never leave a cross-row `tvNextFocus*` target as `null` or `undefined` when the user can still move in that direction.

**Implementation:** Native engine tags can take a moment to register. If you point an item at `nextRowTag` and that tag is still `null`, the Android TV engine falls back to proximity routing and the focus can jump diagonally. Always fall back to the component’s own tag (`?? localTag`) to create a short-lived “invisible wall” until the cross-row tag is ready.

---

## TV Performance & State Management

### The Optimistic UI Pattern

**Rule:** TV interfaces must respond instantly to remote clicks. Never wait for a network request to resolve before updating a visual toggle (for example a Watchlist or Library button).

**Implementation:** When a user toggles an action, immediately update the local React state (e.g. `setIsInLibrary(!isInLibrary)`) so the cyan focus/active ring reflects the new intent. Fire the database sync in the background. Wrap the database call in a `try`/`catch` block; if the network fails, revert the state to its previous value and show an `Alert`.

**State decoupling:** Keep discrete list states (like Watchlist vs. Library) completely decoupled in the UI unless the product explicitly requires them to be mutually exclusive.

