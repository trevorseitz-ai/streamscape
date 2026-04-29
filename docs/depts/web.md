# 🌐 Web App Office

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

- Prefer **`useRef` flags** (e.g. **`rapidTop100FetchedRef`** on Discover) so RapidAPI “Top 100” style hydration runs **once per mount**, with cleanup on unmount where async work continues.
- **`useFocusEffect`** for watchlist refresh should use a **ref to `refetch`** (see Discover) so the callback identity does not thrash when watchlist context value changes every tick.

## Responsive Layout Standards

### HTML meta tags (viewport)

[`app/+html.tsx`](../../app/+html.tsx) is the **source of truth** for the web document shell.

- Include a standard viewport meta so the layout width matches the device: **`width=device-width`**, **`initial-scale=1`** (and project-locked scale as needed). Omitting this can leave mobile Safari in a **desktop-width (~980px)** layout and break all width-based breakpoints.

### Grid breakpoints (Discover, non-TV)

Chunk size for horizontal poster rows (and `getMoviePosterLayout(..., 'phone', numColumns)`) is centralized as **`numColumns`**:

| Viewport (bucketed width) | Columns |
|----------------------------|--------|
| Desktop **> 1024px**       | **5**  |
| Tablet **> 768px**         | **4**  |
| Mobile **≤ 768px**         | **3** (tuned for ~**390–430px**) |

The vertical results `FlatList` **key** should continue to include **`numColumns`** so row math remounts cleanly when crossing breakpoints.

### Row alignment (“no dead space” on narrow screens)

The Discover results list **mixes row items and phase dividers**, so the vertical `FlatList` **cannot** safely use **`numColumns`** / **`columnWrapperStyle`** (that API assumes a uniform grid of cells).

- **Do:** On **phone / non-TV**, pass **`distributePosterRow`** into [`MovieRow`](../../components/MovieRow.tsx) so each **horizontal** poster row’s `FlatList` **`contentContainerStyle`** uses **`justifyContent: 'space-between'`** plus controlled horizontal padding — the intended effect of filling **~430px** with **3** tiles without a drifting gutter.
- **Do not:** Add **`columnWrapperStyle`** to the outer vertical `FlatList` unless the feed is refactored to a single-type grid (unlikely while dividers exist).

## Data architecture sync

Discover is implemented in [**`app/(tabs)/discover.tsx`**](../../app/%28tabs%29/discover.tsx) (shared with native and TV).

### Hybrid mandate (non-negotiable)

- **RapidAPI (“Film & Show”):** **Curation and ordering** — the default “Top” experience and list shape.
- **TMDB:** **Image (and similar) metadata only** for that curated list — hydrate via shared helpers; do not replace RapidAPI ordering with a raw TMDB `/discover` dump for the **default** landing.

Operational detail:

- **Default landing (“Top Rated Movies”): hybrid list.** Rows are sourced from RapidAPI **“Film & Show”** (curated ordering), then **`tmdb_id`-based** enrichment for posters/backdrops in [`lib/film-show-rapid-discover.ts`](../../lib/film-show-rapid-discover.ts). Treat that helper as the **single choke point** for the RapidAPI ↔ `DiscoverResult` mapping and TMDB image hydration logic.
- **TMDB Discover engine on demand.** When users apply **filters** (**year**, **genre**, watch **monetization** / providers), **`fetchMovies`** invokes TMDB **`/discover`** as today. That path remains the authoritative behavior for filtered browsing.
- **Constraint:** Web filters (**Year / Genre** and related controls) **must keep triggering** the TMDB engine. The **default unfiltered landing** across Web and TV is **always** the RapidAPI-enriched curated Top list, not TMDB **`/discover`** until the user changes filters.

### Session stability in effects

- **`sessionUserId`** (**`session?.user?.id`**, or **`discoverAuthKey(session)`** where tri-state matters) belongs in **`useEffect` dependency arrays**, **not** the raw **`session`** object, so identical users do not re-trigger prefetch when Supabase hands a new session reference.
- Related: **`signedOutStable`** / auth-key checks for “logged out” side effects instead of **`[session]`** identity churn.

## Final state (parity checklist)

- **Parity:** TV and phone/web Discover both surface the **curated Top** list as the default experience before filters.
- **Stability:** Bucketed viewport width + mount guards + stable session deps prevent the **render-loop** class of bugs on mobile web and iOS.
- **Responsiveness:** **3 / 4 / 5** column breakpoints and horizontal-row distribution are documented above so mobile **~430px** layouts stay dense and centered.
