# 🌐 Web App Office

> **Shared layout primitives:** **`bucketViewportWidth`** and **`discoverPosterGridColumns`** live in **`lib/viewport-utils.ts`** (re-exported from **`MovieRow.tsx`**) — see [Shared components](shared.md).

## Universal Web Strategy

- **Route logic:** Uses the shared **`app/(tabs)`** routes ([`_layout.tsx`](../../app/%28tabs%29/_layout.tsx)). Platform-specific UI is gated via **`Platform.OS === 'web'`**.

### Route pruning (Expo Router)

- **`app/(tabs)/account.tsx` deleted:** The placeholder **Account** tab file is **gone**—keeps the **tab navigator and bundle** lean (no orphaned screen or deep link stub with an empty layout). Sign-in flows use **`app/login.tsx`** (**`/login`**); authenticated settings and **“My services”** stay on **`app/(tabs)/profile.tsx`**.
- **Related standard:** Prefer removing placeholder routes alongside hiding tabs—“no-empty-placeholder”—see **`HQ.md` → Engineering standards**.

### Tab order (canonical)

**Standard horizontal order** (mobile web and native handset **bottom tab bar**; TV mirrors this **top-to-bottom** on the sidebar):

**Home → Search → Watchlist → Library → Discover → Profile**.

**Profile** is intentionally **last** (anchored)—see [`product.md`](product.md).

- **Hybrid components:** `.web.tsx` extensions override implementations for the browser when Metro resolves the platform suffix — e.g. [`components/TrailerPlayer.web.tsx`](../../components/TrailerPlayer.web.tsx) for YouTube iframes.
- **Auth flow:** Standard `signInWithPassword` in [`app/login.tsx`](../../app/login.tsx), shared with the TV redirect logic in [`app/index.tsx`](../../app/index.tsx).

## Mobile Web Stability Standards

Critical patterns from the iPhone / mobile-web sync work; regressing them risks render loops or duplicate hydration.

### Viewport bucketing

To avoid infinite re-renders when the mobile browser **fractionally** changes `window` width (URL bar, inset, sub-pixel layout), **do not** drive layout math from raw `useWindowDimensions()` width alone.

- **Use** [`bucketViewportWidth(rawWidth)`](../../lib/viewport-utils.ts) (implementation: `Math.floor(rawWidth / 10) * 10`; re-exported from [`MovieRow.tsx`](../../components/MovieRow.tsx)).
- **Rule:** Treat layout as unchanged until the bucketed width moves by **≥10px**. `MovieRow` and Discover both bucket before `getMoviePosterLayout`, **`discoverPosterGridColumns`**, and related styles.
- **Stability (high-DPI / mobile web):** Fractional width jitter on phone browsers and dense displays no longer drives poster/grid math on every tick—**10px bucketing** breaks the width → layout → re-measure **feedback loop** class of bugs when combined with mount guards and stable effect deps; production Discover at **>1k** rows has validated this posture.

### Mount guards for heavy async work

Parent context (auth, watchlists) can update often. **One-shot** fetches must not re-run on every context tick.

- Prefer **`useRef` flags** (e.g. **`streamFinderCuratedFetchedRef`** on Discover) so **Stream Finder cache** hydration runs **once per mount**, with cleanup on unmount where async work continues.
- **`useFocusEffect`** for watchlist refresh should use a **ref to `refetch`** (see Discover) so the callback identity does not thrash when watchlist context value changes every tick.

## Responsive Layout Standards

### HTML shell & viewport scaling (`app/+html.tsx`)

[`app/+html.tsx`](../../app/+html.tsx) is the **source of truth** for the **web document shell** and **proper viewport scaling** on mobile browsers.

- **Viewport meta:** `width=device-width`, `initial-scale=1`, plus project **scale caps** (`maximum-scale`, `user-scalable`) as set in that file. Without this, mobile Safari can stay in a **desktop-width (~980px)** logical viewport — **all bucketed breakpoints and “~430px phone” assumptions break**.
- **Expo HTML reset:** `ScrollViewStyleReset` from `expo-router/html` is included so the document body matches Expo Router’s expected baseline for web.

### Adaptive Discover grid — 3 / 4 / 6 tiers (`bucketViewportWidth`)

Chunk size for horizontal poster rows (and `getMoviePosterLayout(..., 'phone', numColumns)`) is driven by **`discoverPosterGridColumns`** in [`lib/viewport-utils.ts`](../../lib/viewport-utils.ts) after **`bucketViewportWidth`** (same module; re-exported from [`MovieRow.tsx`](../../components/MovieRow.tsx)) so jitter does not flip layouts.

**Tier rules (responsive, bucketed width):**

| Breakpoint (bucketed width) | Columns | Notes |
|------------------------------|--------|--------|
| **Compact** — **&lt; 600px** (typical phone, e.g. **~430px**) | **3** | Dense grid; rows use **`distributePosterRow`** / **`justifyContent: 'space-between'`** where applicable. |
| **Medium** — **600px – 899px** | **4** | Tablets / small laptop windows. |
| **Wide** — **≥ 900px** (desktop, large browser) | **6** | Avoids oversized poster tiles on wide monitors. **Android TV Discover** uses the same density rules against **usable row width** (after sidebar + padding). |

The vertical results `FlatList` **key** should continue to include **`numColumns`** (or TV column count) so row math remounts cleanly when crossing breakpoints.

### Discover performance at scale (1,000+ mirrored titles)

Production validation has been extended to **1,206** cached movie rows (**Stream Finder mirror**) with the full **16-provider** footprint. **Phone Discover** stays dense on **`~430px`** widths (**3-column** tier); **`bucketViewportWidth`** + **`discoverPosterGridColumns`** widen the grid **silently** on TV / tablet / desktop up to **6** columns (**≥900px** bucket) so scrolling stays predictable—performance traces in Chromium / Safari remain the regression check.

### Row alignment (“no dead space” on narrow screens)

The Discover results list **mixes row items and phase dividers**, so the vertical `FlatList` **cannot** safely use **`numColumns`** / **`columnWrapperStyle`** (that API assumes a uniform grid of cells).

- **Do:** On **phone / non-TV**, pass **`distributePosterRow`** into [`MovieRow`](../../components/MovieRow.tsx) so each **horizontal** poster row’s `FlatList` **`contentContainerStyle`** uses **`justifyContent: 'space-between'`** plus controlled horizontal padding — the intended effect of filling **~430px** with **3** tiles without a drifting gutter.
- **Do not:** Add **`columnWrapperStyle`** to the outer vertical `FlatList` unless the feed is refactored to a single-type grid (unlikely while dividers exist).

## Data architecture sync

Discover is implemented in [**`app/(tabs)/discover.tsx`**](../../app/%28tabs%29/discover.tsx) (shared with native and TV).

### Hybrid mandate (non-negotiable)

- **Stream Finder (Supabase cache):** **Curation and ordering** for the default “Top ~300” experience — authoritative list membership and streaming links for the synced catalog (`stream_finder_movies`, `movie_availability`). **Provider catalog (scale milestone):** **`GET /api/providers`** feeds **16** providers into **`stream_finder_providers`**—major services plus niche and premium options upstream includes (e.g. **AMC+, Shudder, Criterion Channel**); same table backs **Profile (“My services”)** and **Discover** (badges, filters, pruning). Read path: [`lib/stream-finder-supabase.ts`](../../lib/stream-finder-supabase.ts); sync: **`npm run sync:stream-finder`**.
- **TMDB:** **Enrichment layer** — high-resolution posters and backdrops for that curated list via [`lib/film-show-rapid-discover.ts`](../../lib/film-show-rapid-discover.ts). **TMDB Discover** on demand when users apply **filters** (**year**, **genre**, **monetization** / providers).
- **Legacy / alternate curated path:** RapidAPI “Film & Show” remains in the repo for optional or historical flows; the **default unfiltered** Discover landing is **Stream Finder + TMDB enrich**, not a raw TMDB `/discover` dump.

### Metadata fallbacks (provider logos)

[`resolveStreamFinderProviderLogoUrl`](../../lib/stream-finder-supabase.ts) turns each `stream_finder_providers.logo_path` into a display URL. **`null`**, empty strings, and the sync **`__generic_stream__`** sentinel (used when the API omits artwork—e.g. **Paramount+** in the current catalog) resolve to a **built-in generic SVG** so the grid never shows a broken image. Valid paths and full TMDB URLs still map to **`image.tmdb.org` / w92** as before.

Operational detail:

- **Default landing:** Stream Finder cache → `DiscoverResult` mapping + TMDB **`tmdb_id`** image hydration. **Filters** keep invoking TMDB **`/discover`** as today.
- **Constraint:** The **default unfiltered** landing must stay **Stream Finder–ordered** until the user changes filters.

### Profile & “My services” — auto-pruning

User selections (`user_profiles.enabled_services` + local AsyncStorage) are **not** an open-ended TMDB ID list — they are **intersected with `stream_finder_providers`**, which mirrors **`GET /api/providers`** on each Stream Finder sync (**API as source of truth** for which services exist in the product).

- **On Profile load:** After the catalog fetch, any saved ID **not** in the current provider table is **silently dropped**; storage and Supabase are updated to match. A one-time UI hint may appear when pruning occurs.
- **Globally:** [`resolvePrunedProviderSelections`](../../lib/stream-finder-supabase.ts) (and related helpers) ensure **Discover filters**, **Library**, **Watchlist**, and **Movie** “my services” highlights only use IDs that still exist in the synced catalog — so **dead or expired providers from an old feed never affect behavior** after a sync reshapes the catalog.

### Session stability in effects

- **`sessionUserId`** (**`session?.user?.id`**, or **`discoverAuthKey(session)`** where tri-state matters) belongs in **`useEffect` dependency arrays**, **not** the raw **`session`** object, so identical users do not re-trigger prefetch when Supabase hands a new session reference.
- Related: **`signedOutStable`** / auth-key checks for “logged out” side effects instead of **`[session]`** identity churn.

## Final state (parity checklist)

- **Parity:** Web, native mobile, and Android TV Discover all surface the **Stream Finder curated** list as the default experience before filters.
- **Stability:** **`app/+html.tsx`** viewport + bucketed width + mount guards + stable session deps prevent **layout mis-scale** and **render-loop** classes of bugs on mobile web and iOS.
- **Responsiveness & scale:** **3 / 4 / 6** column tiers ( **`discoverPosterGridColumns`** — **≥900 → 6**, **≥600 → 4**, else **3** ) plus horizontal-row distribution; at **>1k** mirrored titles (`stream_finder_movies`), **bucketing + mount guards** stay the backbone for predictable scroll performance (**~60fps**) on phone Discover.
