# 🌐 Web App Office

> **Shared layout primitives:** Viewport **`bucketViewportWidth`** is defined and owned by **[`MovieRow.tsx`](../../components/MovieRow.tsx)** — see [Shared components](shared.md).

## Universal Web Strategy

- **Route logic:** Uses the shared `app/(tabs)` routes ([`_layout.tsx`](../../app/%28tabs%29/_layout.tsx)). Platform-specific UI is gated via `Platform.OS === 'web'`.
- **Hybrid components:** `.web.tsx` extensions override implementations for the browser when Metro resolves the platform suffix — e.g. [`components/TrailerPlayer.web.tsx`](../../components/TrailerPlayer.web.tsx) for YouTube iframes.
- **Auth flow:** Standard `signInWithPassword` in [`app/login.tsx`](../../app/login.tsx), shared with the TV redirect logic in [`app/index.tsx`](../../app/index.tsx).

## Mobile Web Stability Standards

Critical patterns from the iPhone / mobile-web sync work; regressing them risks render loops or duplicate hydration.

### Viewport bucketing

To avoid infinite re-renders when the mobile browser **fractionally** changes `window` width (URL bar, inset, sub-pixel layout), **do not** drive layout math from raw `useWindowDimensions()` width alone.

- **Use** [`bucketViewportWidth(rawWidth)`](../../components/MovieRow.tsx) (implementation: `Math.floor(rawWidth / 10) * 10`).
- **Rule:** Treat layout as unchanged until the bucketed width moves by **≥10px**. `MovieRow` and Discover both bucket before `getMoviePosterLayout` and related styles.

### Mount guards for heavy async work

Parent context (auth, watchlists) can update often. **One-shot** fetches must not re-run on every context tick.

- Prefer **`useRef` flags** (e.g. **`streamFinderCuratedFetchedRef`** on Discover) so **Stream Finder cache** hydration runs **once per mount**, with cleanup on unmount where async work continues.
- **`useFocusEffect`** for watchlist refresh should use a **ref to `refetch`** (see Discover) so the callback identity does not thrash when watchlist context value changes every tick.

## Responsive Layout Standards

### HTML shell & viewport scaling (`app/+html.tsx`)

[`app/+html.tsx`](../../app/+html.tsx) is the **source of truth** for the **web document shell** and **proper viewport scaling** on mobile browsers.

- **Viewport meta:** `width=device-width`, `initial-scale=1`, plus project **scale caps** (`maximum-scale`, `user-scalable`) as set in that file. Without this, mobile Safari can stay in a **desktop-width (~980px)** logical viewport — **all bucketed breakpoints and “~430px phone” assumptions break**.
- **Expo HTML reset:** `ScrollViewStyleReset` from `expo-router/html` is included so the document body matches Expo Router’s expected baseline for web.

### Grid breakpoints (Discover, non-TV)

Chunk size for horizontal poster rows (and `getMoviePosterLayout(..., 'phone', numColumns)`) is centralized as **`numColumns`**. Use **`bucketViewportWidth`** before choosing a column count so jitter does not flip layouts.

**Standard (responsive):**

| Breakpoint (bucketed width) | Columns | Notes |
|------------------------------|--------|--------|
| **Mobile** — up to **768px** (e.g. **~430px** iPhone class) | **3** | Dense phone grid; rows use **`distributePosterRow`** / **`justifyContent: 'space-between'`** so three tiles read **centered and balanced** on ~**430px** width. |
| **Tablet** — **> 768px**     | **4**  | |
| **Desktop** — **> 1024px**   | **5**  | |

The vertical results `FlatList` **key** should continue to include **`numColumns`** so row math remounts cleanly when crossing breakpoints.

### Row alignment (“no dead space” on narrow screens)

The Discover results list **mixes row items and phase dividers**, so the vertical `FlatList` **cannot** safely use **`numColumns`** / **`columnWrapperStyle`** (that API assumes a uniform grid of cells).

- **Do:** On **phone / non-TV**, pass **`distributePosterRow`** into [`MovieRow`](../../components/MovieRow.tsx) so each **horizontal** poster row’s `FlatList` **`contentContainerStyle`** uses **`justifyContent: 'space-between'`** plus controlled horizontal padding — the intended effect of filling **~430px** with **3** tiles without a drifting gutter.
- **Do not:** Add **`columnWrapperStyle`** to the outer vertical `FlatList` unless the feed is refactored to a single-type grid (unlikely while dividers exist).

## Data architecture sync

Discover is implemented in [**`app/(tabs)/discover.tsx`**](../../app/%28tabs%29/discover.tsx) (shared with native and TV).

### Hybrid mandate (non-negotiable)

- **Stream Finder (Supabase cache):** **Curation and ordering** for the default “Top ~300” experience — authoritative list membership and streaming links for the synced catalog (`stream_finder_movies`, `movie_availability`). Read path: [`lib/stream-finder-supabase.ts`](../../lib/stream-finder-supabase.ts); sync: **`npm run sync:stream-finder`**.
- **TMDB:** **Enrichment layer** — high-resolution posters and backdrops for that curated list via [`lib/film-show-rapid-discover.ts`](../../lib/film-show-rapid-discover.ts). **TMDB Discover** on demand when users apply **filters** (**year**, **genre**, **monetization** / providers).
- **Legacy / alternate curated path:** RapidAPI “Film & Show” remains in the repo for optional or historical flows; the **default unfiltered** Discover landing is **Stream Finder + TMDB enrich**, not a raw TMDB `/discover` dump.

Operational detail:

- **Default landing:** Stream Finder cache → `DiscoverResult` mapping + TMDB **`tmdb_id`** image hydration. **Filters** keep invoking TMDB **`/discover`** as today.
- **Constraint:** The **default unfiltered** landing must stay **Stream Finder–ordered** until the user changes filters.

### Profile & “My services” — auto-pruning

User selections (`user_profiles.enabled_services` + local AsyncStorage) are **not** an open-ended TMDB ID list — they are **intersected with `stream_finder_providers`** (the master list produced by each Stream Finder sync).

- **On Profile load:** After the catalog fetch, any saved ID **not** in the current provider table is **silently dropped**; storage and Supabase are updated to match. A one-time UI hint may appear when pruning occurs.
- **Globally:** [`resolvePrunedProviderSelections`](../../lib/stream-finder-supabase.ts) (and related helpers) ensure **Discover filters**, **Library**, **Watchlist**, and **Movie** “my services” highlights only use IDs that still exist in the synced catalog — so **dead or expired providers from an old feed never affect behavior** after a sync reshapes the catalog.

### Session stability in effects

- **`sessionUserId`** (**`session?.user?.id`**, or **`discoverAuthKey(session)`** where tri-state matters) belongs in **`useEffect` dependency arrays**, **not** the raw **`session`** object, so identical users do not re-trigger prefetch when Supabase hands a new session reference.
- Related: **`signedOutStable`** / auth-key checks for “logged out” side effects instead of **`[session]`** identity churn.

## Final state (parity checklist)

- **Parity:** TV and phone/web Discover both surface the **Stream Finder curated** list as the default experience before filters.
- **Stability:** **`app/+html.tsx`** viewport + bucketed width + mount guards + stable session deps prevent **layout mis-scale** and **render-loop** classes of bugs on mobile web and iOS.
- **Responsiveness:** **3 / 4 / 5** column breakpoints and horizontal-row distribution are documented above so mobile **~430px** layouts stay dense and centered.
