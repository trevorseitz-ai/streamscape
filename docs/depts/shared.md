# 📦 Shared components (cross-platform)

Lightweight pointers for **`Web`**, **`TV`**, and **`native`** — code lives in-repo; duplicate layout math does not.

## Viewport bucketing — authoritative source

**[`lib/viewport-utils.ts`](../../lib/viewport-utils.ts)** defines **`bucketViewportWidth`** and **`discoverPosterGridColumns`**. They are **re-exported** from **[`components/MovieRow.tsx`](../../components/MovieRow.tsx)** for convenience; **`MovieRow`** / **`MoviePosterRow`** consume them for sizing.

- **Rule:** Prefer importing from **`MovieRow`** or **`viewport-utils`** anywhere you derive poster or grid width from `useWindowDimensions()` (Discover uses both; see [`web.md`](web.md#mobile-web-stability-standards)).
- Do not fork a second bucket implementation — regressions fragment behavior across Home, Discover, and TV-adjacent rows.

Secondary references: **[`web.md`](web.md)** (mobile-web stability section), **[`tv.md`](tv.md)** (below-the-fold parity with shared routes).
