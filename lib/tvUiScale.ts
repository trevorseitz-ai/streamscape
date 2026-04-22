/**
 * Global density compensation for 1080p TV layouts (avoids oversized / “zoomed” UI).
 */
export const tvScale = 0.7;

/** Fixed rail width (aligned with `TV_SIDEBAR_WIDTH` in TvSidebarTabBar). */
export const TV_RAIL_WIDTH_BASE = 160;

/**
 * Fixed left rail width in px (see TvSidebarTabBar `TV_SIDEBAR_WIDTH`).
 */
export function getTvSidebarWidthPx(_windowWidth?: number): number {
  return 160;
}

export function getTvSidebarPaddingH(windowWidth: number): number {
  return Math.max(8, Math.round(windowWidth * 0.0104 * tvScale));
}

export function getTvSidebarPaddingV(windowWidth: number): number {
  return Math.max(28, Math.round(windowWidth * 0.026 * tvScale));
}

export function getTvSidebarIconSize(): number {
  return Math.max(20, Math.round(32 * tvScale));
}

export function getTvSidebarLabelFontSize(): number {
  return Math.max(12, Math.round(17 * tvScale));
}

export function getTvSidebarLabelLineHeight(): number {
  return Math.max(16, Math.round(22 * tvScale));
}

/** Scaled 30×2 decorative line (30px × 2px × {@link tvScale}). */
export function getTvSidebarSegmentLineWidth(): number {
  return Math.max(18, Math.round(30 * tvScale));
}

export function getTvSidebarSegmentLineHeight(): number {
  return Math.max(1, Math.round(2 * tvScale));
}

export function getTvSidebarSegmentLineMarginV(): number {
  return Math.max(6, Math.round(10 * tvScale));
}

/** Main content horizontal inset on TV (percentage of window, scaled). */
export function getTvContentHorizontalPad(windowWidth: number): number {
  return Math.min(80, Math.max(40, Math.round(windowWidth * 0.04 * tvScale)));
}
