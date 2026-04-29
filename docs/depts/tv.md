# 📺 TV App Office (Lean-back Experience)

> **Shared viewport bucketing** for poster rows used with window-based sizing: import **`bucketViewportWidth`** from **[`components/MovieRow.tsx`](../../components/MovieRow.tsx)** ([Shared components](shared.md)). TV-specific tokens below remain authoritative for rail/bounds.

---

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

## Locked layout constants (540p logical height — above-the-fold)

Single source for Home rail + poster grid. Implementation: `TvSidebarTabBar.tsx`, `app/(tabs)/index.tsx`, `MovieCard.tsx`.

| Token | Value |
|-------|--------|
| `TV_SIDEBAR_WIDTH` | **100px** |
| `TV_HERO_HEIGHT` | **220px** |
| `TV_POSTER_WIDTH` | **140px** |
| `TV_POSTER_HEIGHT` | **210px** |
| `TV_GAP` | **12px** |

Supporting tokens (unchanged unless noted elsewhere): `TV_HOME_CONTENT_PADDING` **10px**, `TV_GRID_COLUMNS` **5**, poster tile title **13px**, year **11px**, section header **22px**.

Type tokens for the Hero text column:

| Token | Value |
|-------|--------|
| `TV_HERO_TITLE_FONT` | **18px** |
| `TV_HERO_META_FONT` | **12px** (year + rating line) |
| `TV_HERO_RESIZE_MODE` | **`'cover'`** (backdrop in col 3) |

---

## Hero Layout Standards

The TV **Hero** above the scroll region uses a **4-column flex row** with equal width distribution (**1 : 1 : 1 : 1**) — typically four sibling views in a **`flexDirection: 'row'`** layout, each with **`flex: 1`** so columns share space proportionally across **1080p** and **4K**.

| Column | Role |
|:------:|------|
| **1 & 4** | **Empty spacer** columns (**`flex: 1`**, no substantive content). They symmetrically sandwich the Hero so headline and artwork stay visually centered instead of glued to screen edges. |
| **2** | **Content / text** container (title, meta, primary actions — e.g. **`heroContentTv`**). Horizontal padding stays **inside** this column (see **`TV_HOME_CONTENT_PADDING`** / **10px**); the outer shell does not add contradictory horizontal gutters on TV. |
| **3** | **Image / backdrop** container — **`aspectRatio: 16 / 9`** and **`resizeMode`**: **`cover`**. Image views use **`width: '100%'`** within the column; the column participates in **`flex: 1`**. Shell-level TV overlay patterns (`heroOverlay`) remain **phone-only**. |

**Image sizing mandate:** Do **not** prescribe fixed pixel widths for Hero images (historic one-off widths such as **391px** are obsolete). Prefer **`flex: 1`**, **`width: '100%'`**, and **aspect-ratio** constraints so scaling tracks the column, not arbitrary absolute dimensions.

---

## Hero component constraints

**Never use absolute positioning** for Hero elements (text block, backdrop frame, badges). Rely on the **4-column flex architecture** so symmetry and proportional scaling hold across **1080p** and **4K** displays and under Focus scaling without manual coordinate math.

---

## Data Sourcing & Enrichment Mandate

This section is the **hybrid API contract** for curated rails (Discover default list, Home-style featured rows, etc.). TV inherits the same data rules as touch targets unless a screen documents a deliberate exception.

### Primary curated source

**RapidAPI “Film & Show”** (Film & Show ratings hub) is the **absolute authority** for **Top 100**, **Trending**, and **Featured** lists when presenting the **default curated** experience.

### Enrichment role (TMDB)

**TMDB** is strictly a **metadata provider** in this pipeline—not the list curator. Rows from RapidAPI include **`ids.TMDB`** / **`tmdb_id`**. The client may **`GET https://api.themoviedb.org/3/movie/{tmdb_id}`** to hydrate **high-resolution posters and backdrops** when the Rapid feed lacks ready-to-render image URLs (**`poster_path` / `backdrop_path`** → full **`image.tmdb.org`** **`w500`** URLs in **`lib/film-show-rapid-discover.ts`**).

### Logic gates (Discover)

**`rapidDiscoverListActiveRef`** (see **`app/(tabs)/discover.tsx`**) gates **infinite scroll / pagination**:

- While **true**, the grid is sourced from the **curated RapidAPI** payload; **`loadMore` / `onEndReached`** must **not** append generic TMDB **`/discover`** results into that rail or replace it mid-scroll.
- The ref clears when the user invokes **filtered** TMDB discover (e.g. **year**, **genre**, **monetization** changes that call **`fetchMovies`**), restoring normal TMDB pagination.

### Persisted experience

Upserts into **`media`** and watchlists (**Supabase**) follow existing product flows once a title is opened or saved.

---

## 🔐 Environment Variables

Before running the emulator, duplicate `.env.example`, rename it to `.env`, and populate it with your active API keys and Supabase credentials.

---

## 🏗️ API Architecture & Data Flow

### 1. The core services

| Service | Role | Key variable(s) |
|--------|------|-----------------|
| **RapidAPI “Film & Show”** | Curated **Top / Trend / Featured** lists — see **Data Sourcing & Enrichment Mandate** (above). | `EXPO_PUBLIC_RAPIDAPI_KEY`, `EXPO_PUBLIC_RAPIDAPI_HOST` |
| **TMDB** | Metadata backbone: detail, cast/crew, search, **`/discover`** when filters demand it — and **per-id** enrichment for RapidAPI rows (**`/movie/{tmdb_id}`**). Never the curator for default top/trend lists. | `EXPO_PUBLIC_TMDB_API_KEY` (client), `TMDB_API_KEY` (server / Node) |
| **RapidAPI (streaming)** | The streaming bridge. Provides live “where to watch” deep links and regional availability by TMDB id. | `EXPO_PUBLIC_RAPIDAPI_KEY` *(no underscore between `RAPID` and `API`)* — host varies by product |
| **Supabase** | The source of truth. Manages auth, user watchlists, and caches canonical media rows synced from TMDB. | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| **OMDB** | Ratings provider. Optional fetch for IMDb, Rotten Tomatoes, and Metacritic scores. | `EXPO_PUBLIC_OMDB_API_KEY` |

### 2. Additional synchronization logic

- **Filtered Discover:** TMDB **`/discover`** applies when users opt into genre/year/watch-provider filters (**`fetchMovies`** in **`app/(tabs)/discover.tsx`**).
- **Live links:** The movie screen uses [`lib/streaming-rapid.ts`](../../lib/streaming-rapid.ts) for outbound links via the **`streaming-availability`** RapidAPI host.
- **UI context:** Browsing mixes curated RapidAPI grids with TMDB-driven filtered discovery; personalization still flows through **Supabase** (watchlists, history).

### 3. Environment configuration

Before booting the emulator, ensure the **RapidAPI** naming convention (**`EXPO_PUBLIC_RAPIDAPI_KEY`** — no extra underscore) matches `lib/streaming-rapid.ts`. Curated Film & Show requests also require **`EXPO_PUBLIC_RAPIDAPI_HOST`** (the hub **`X-RapidAPI-Host`** value).

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

