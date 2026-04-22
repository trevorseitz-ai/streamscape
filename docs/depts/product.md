# 🚀 Product & Features Office

## TV Technical Architecture

- **Navigation:** Left-rail UI via [`components/TvSidebarTabBar.tsx`](../../components/TvSidebarTabBar.tsx).
- **Focus management:** Custom bridge in [`lib/tv-search-focus-context.tsx`](../../lib/tv-search-focus-context.tsx) plus native tags from [`hooks/useTvNativeTag.ts`](../../hooks/useTvNativeTag.ts) to steer spatial navigation.
- **TV-first components:** [`components/HomeTvMovieRow.tsx`](../../components/HomeTvMovieRow.tsx) drives horizontal media rows with window-based poster sizing math.
