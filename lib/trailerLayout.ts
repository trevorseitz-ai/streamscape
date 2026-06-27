/** Theatrical movie trailers on YouTube are overwhelmingly 16:9. */
export const TRAILER_ASPECT_WIDTH = 16;
export const TRAILER_ASPECT_HEIGHT = 9;

export type TrailerPlayerLayout = {
  width: number;
  height: number;
};

export type TrailerLayoutOptions = {
  /** Horizontal inset from each screen edge (pillarbox gutter). */
  horizontalPad?: number;
  /** Vertical inset from top and bottom when fitting the player. */
  verticalPad?: number;
};

/**
 * Largest 16:9 player box that fits inside the available window.
 * Width-first, then height-clamp — maximizes iframe area for YouTube adaptive quality.
 */
export function computeTrailerPlayerLayout(
  windowWidth: number,
  windowHeight: number,
  options?: TrailerLayoutOptions
): TrailerPlayerLayout {
  const horizontalPad = options?.horizontalPad ?? 24;
  const verticalPad = options?.verticalPad ?? 48;

  const maxWidth = Math.max(0, windowWidth - horizontalPad * 2);
  const maxHeight = Math.max(0, windowHeight - verticalPad * 2);

  if (maxWidth <= 0 || maxHeight <= 0) {
    return { width: 320, height: 180 };
  }

  let width = maxWidth;
  let height = Math.round((width * TRAILER_ASPECT_HEIGHT) / TRAILER_ASPECT_WIDTH);

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round((height * TRAILER_ASPECT_WIDTH) / TRAILER_ASPECT_HEIGHT);
  }

  return { width: Math.floor(width), height: Math.floor(height) };
}
