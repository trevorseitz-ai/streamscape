# 📦 Shared components (cross-platform)

Lightweight pointers for **`Web`**, **`TV`**, and **`native`** — code lives in-repo; duplicate layout math does not.

**Related:** **[`docs/depts/web-tv-parity.md`](web-tv-parity.md)** — what Web and Android TV share vs where they diverge (grids, input, truthful product framing).

## Viewport bucketing — authoritative source

**[`lib/viewport-utils.ts`](../../lib/viewport-utils.ts)** defines **`bucketViewportWidth`** and **`discoverPosterGridColumns`**. They are **re-exported** from **[`components/MovieRow.tsx`](../../components/MovieRow.tsx)** for convenience; **`MovieRow`** / **`MoviePosterRow`** consume them for sizing.

- **Rule:** Prefer importing from **`MovieRow`** or **`viewport-utils`** anywhere you derive poster or grid width from `useWindowDimensions()` (Discover uses both; see [`web.md`](web.md#mobile-web-stability-standards)).
- Do not fork a second bucket implementation — regressions fragment behavior across Home, Discover, and TV-adjacent rows.

Secondary references: **[`web.md`](web.md)** (mobile-web stability section), **[`tv.md`](tv.md)** (below-the-fold parity with shared routes), **[`web-tv-parity.md`](web-tv-parity.md)** (summarized Web × TV matrix).

## Android Expo config (`app.json`)

Shared native Android targets use **`expo.android.softwareKeyboardLayoutMode: "pan"`** in **`app.json`**, mapping to **`adjustPan`** (`windowSoftInputMode`) so Search and forms pan when the IME appears. Do **not** use **`onScroll`** there — Gradle/manifest tooling expects valid Android modes (**`resize`**, **`pan`**) and rejects invalid strings on prebuild/release.

**Search / typeahead IME:** Do **not** change a focused **`TextInput`**'s React **`key`** when async suggestion lists update — remounting dismisses the keyboard mid-query (see [`app/(tabs)/search.tsx`](../../app/(tabs)/search.tsx)).
