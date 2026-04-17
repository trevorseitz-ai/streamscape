import { isTvTarget } from './isTv';

const TV_SCALE = 1.5;
const TV_BODY_MIN = 20;
const TV_TITLE_MIN = 36;

/** Body / UI copy: at least 50% larger on TV, floor 20px. */
export function tvBodyFontSize(base: number): number {
  if (!isTvTarget()) return base;
  return Math.max(TV_BODY_MIN, Math.round(base * TV_SCALE));
}

/** Section titles, hero titles: at least 50% larger on TV, floor 36px. */
export function tvTitleFontSize(base: number): number {
  if (!isTvTarget()) return base;
  return Math.max(TV_TITLE_MIN, Math.round(base * TV_SCALE));
}

/** Proportional bump without separate floor (badges, meta). */
export function tvFontSize(base: number): number {
  if (!isTvTarget()) return base;
  return Math.round(base * TV_SCALE);
}
