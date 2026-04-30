import { Platform } from 'react-native';

/**
 * Stable 10px buckets for `useWindowDimensions()` so layout does not flap on fractional mobile chrome.
 *
 * Warns only when width is genuinely extreme (>2000) or suspicious on **iPhone-class iOS** (>960),
 * keeping TV / tablet / desktop (768-1920) silent while still guarding mis-configured Simulator / kiosk.
 */
export function bucketViewportWidth(rawWidth: number): number {
  if (__DEV__) {
    if (rawWidth > 2000) {
      console.warn(
        '[bucketViewportWidth] Unusually wide window:',
        rawWidth,
        '(>2000 — verify kiosk / ultrawide / viewport meta)'
      );
    } else if (Platform.OS === 'ios' && rawWidth > 960) {
      console.warn(
        '[bucketViewportWidth] Unusually wide iOS viewport:',
        rawWidth,
        '(typical portrait phones are ~390-430; check Simulator device / multitasking)'
      );
    }
  }
  return Math.floor(rawWidth / 10) * 10;
}

/** Discover poster grid density for phone / Web / Android TV usable width (typically bucketed widths). */
export function discoverPosterGridColumns(bucketWidth: number): number {
  if (bucketWidth >= 900) return 6;
  if (bucketWidth >= 600) return 4;
  return 3;
}
