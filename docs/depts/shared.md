# 📦 Shared components (cross-platform)

Lightweight pointers for **`Web`**, **`TV`**, and **`native`** — code lives in-repo; duplicate layout math does not.

## Viewport bucketing — authoritative source

**[`components/MovieRow.tsx`](../../components/MovieRow.tsx)** exports **`bucketViewportWidth`** and consumes it internally for **`MoviePosterRow`** and **`MovieRow`** sizing.

- **Rule:** Prefer importing **`bucketViewportWidth`** from this file anywhere you derive poster or grid width from `useWindowDimensions()` (Discover does; see [`web.md`](web.md#mobile-web-stability-standards)).
- Do not fork a second bucket implementation — regressions fragment behavior across Home, Discover, and TV-adjacent rows.

Secondary references: **[`web.md`](web.md)** (mobile-web stability section), **[`tv.md`](tv.md)** (below-the-fold parity with shared routes).
