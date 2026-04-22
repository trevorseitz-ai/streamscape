# 📐 Android TV UI & Layout Guidelines

**Core Directive:** This document dictates the strict mathematical layout for all Android TV interfaces in Streamscape. Never rely on flexbox guesses for horizontal TV grids.

## 1. The 20-Pixel Law

The absolute truth of this app's TV layout is a `20px` spacing grid.

- The main content wrapper must always sit exactly **20 pixels** away from the right edge of the Side Navigation Bar.
- All section titles, filter lists (Years/Genres), and the first movie poster of any row must perfectly align to this `20px` invisible boundary.
- The right edge of the screen must also maintain a `20px` margin (`DISCOVER_TV_RIGHT_MARGIN`) to protect against hardware overscan.

## 2. The 5-Poster Grid Math

Movie posters must be calculated dynamically based on window width. Do not use static widths.

- **The Math:**
  const USABLE_WIDTH = width - NAV_BAR_WIDTH - 20 - 20;
  const POSTER_WIDTH = (USABLE_WIDTH - (GAP _ 4)) / 5;
  const POSTER_HEIGHT = POSTER_WIDTH _ 1.5;

## 3. The Guillotine Effect (Focus Clipping)

When a TV component scales up on focus (`transform: [{ scale: 1.05 }]`), it physically expands outside of its container.

- **The Fix:** If a white focus border is getting chopped off at the top or bottom, **do not** shrink the poster. Add `paddingVertical: 20` to the `contentContainerStyle` of the parent `<FlatList>` to give the animation breathing room.

## 4. The "Invisible Bumper" Principle

If a grid is shoved too far to the right, or the layout math is ignoring your padding instructions, a parent container is enforcing a global rule.

- Always check the master layout (`_layout.tsx`) or sidebar component for rogue `gap`, `marginRight`, or `justifyContent: 'space-between'` properties.
- **Debug Strategy:** Temporarily add `backgroundColor: 'rgba(255, 0, 0, 0.3)'` to containers to visually expose hidden boundaries.
