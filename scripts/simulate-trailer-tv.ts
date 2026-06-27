/**
 * Simulates trailer modal layout across lean-back viewports and TMDB trailer selection.
 * Run: npx tsx scripts/simulate-trailer-tv.ts
 */
import { computeTrailerPlayerLayout } from '../lib/trailerLayout';
import { pickBestYoutubeTrailerKey } from '../lib/tmdb-trailer';

const TARGET_ASPECT = 16 / 9;
const ASPECT_TOLERANCE = 0.02;

type ViewportProfile = {
  name: string;
  width: number;
  height: number;
};

const TV_VIEWPORTS: ViewportProfile[] = [
  { name: 'Android TV (logical, 1080p output)', width: 960, height: 540 },
  { name: 'Android TV (logical, 4K output — same canvas)', width: 960, height: 540 },
  { name: 'Apple TV 1080p', width: 1920, height: 1080 },
  { name: 'Apple TV 4K (logical)', width: 1920, height: 1080 },
  { name: 'Web desktop', width: 1440, height: 900 },
  { name: 'Phone landscape', width: 844, height: 390 },
];

/** Pre-fix: full width + 60% window height (stretch bug). */
function legacyTrailerLayout(windowWidth: number, windowHeight: number) {
  return {
    width: windowWidth,
    height: Math.floor(windowHeight * 0.6),
  };
}

function aspectRatio(width: number, height: number): number {
  return width / height;
}

function isSixteenByNine(width: number, height: number): boolean {
  const ratio = aspectRatio(width, height);
  return Math.abs(ratio - TARGET_ASPECT) <= ASPECT_TOLERANCE;
}

function pixelArea(width: number, height: number): number {
  return width * height;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function status(ok: boolean): string {
  return ok ? 'PASS' : 'FAIL';
}

console.log('=== ReelDive trailer TV simulation ===\n');

let failures = 0;

console.log('--- Layout: legacy (60% height × full width) vs fixed (16:9 fit) ---\n');
console.log(
  'Profile'.padEnd(42),
  'Legacy AR'.padStart(10),
  'Fixed AR'.padStart(10),
  'Legacy px'.padStart(12),
  'Fixed px'.padStart(12),
  '16:9'.padStart(6)
);
console.log('-'.repeat(96));

for (const vp of TV_VIEWPORTS) {
  const legacy = legacyTrailerLayout(vp.width, vp.height);
  const fixed = computeTrailerPlayerLayout(vp.width, vp.height);
  const legacyAr = aspectRatio(legacy.width, legacy.height);
  const fixedAr = aspectRatio(fixed.width, fixed.height);
  const ok = isSixteenByNine(fixed.width, fixed.height);
  if (!ok) failures += 1;

  console.log(
    vp.name.padEnd(42),
    legacyAr.toFixed(3).padStart(10),
    fixedAr.toFixed(3).padStart(10),
    fmt(pixelArea(legacy.width, legacy.height)).padStart(12),
    fmt(pixelArea(fixed.width, fixed.height)).padStart(12),
    status(ok).padStart(6)
  );
  console.log(
    '  '.padEnd(42),
    `${legacy.width}×${legacy.height}`.padStart(10),
    `${fixed.width}×${fixed.height}`.padStart(10)
  );
}

console.log('\n--- Assertions ---\n');

for (const vp of TV_VIEWPORTS) {
  const fixed = computeTrailerPlayerLayout(vp.width, vp.height);
  const fitsWidth = fixed.width <= vp.width - 48;
  const fitsHeight = fixed.height <= vp.height - 96;
  const ok = isSixteenByNine(fixed.width, fixed.height) && fitsWidth && fitsHeight;
  console.log(`${status(ok)}  ${vp.name}: fits viewport, 16:9`);
  if (!ok) failures += 1;
}

// Android TV: legacy was ~2.96:1 (stretched); fixed must be ~1.778
const androidLegacy = legacyTrailerLayout(960, 540);
const androidFixed = computeTrailerPlayerLayout(960, 540);
const legacyStretch = aspectRatio(androidLegacy.width, androidLegacy.height);
const stretchFixed =
  legacyStretch > 2.5 && isSixteenByNine(androidFixed.width, androidFixed.height);
console.log(
  `${status(stretchFixed)}  Android TV legacy was ultrawide stretch (${legacyStretch.toFixed(2)}:1); fixed is 16:9`
);
if (!stretchFixed) failures += 1;

// Fixed layout should use more vertical space than legacy on Android TV (better quality signal)
const androidAreaGain =
  pixelArea(androidFixed.width, androidFixed.height) >=
  pixelArea(androidLegacy.width, androidLegacy.height) * 0.85;
console.log(
  `${status(androidAreaGain)}  Android TV fixed player area is substantial (${fmt(pixelArea(androidFixed.width, androidFixed.height))} px² vs legacy ${fmt(pixelArea(androidLegacy.width, androidLegacy.height))} px² stretched)`
);
if (!androidAreaGain) failures += 1;

console.log('\n--- TMDB trailer selection (Fight Club fixture) ---\n');

const fightClubVideos = [
  {
    key: 'O-b2VfmmbyA',
    site: 'YouTube',
    type: 'Trailer',
    size: 720,
    official: false,
    published_at: '2016-03-05T02:03:14.000Z',
  },
  {
    key: 'BdJKm16Co6M',
    site: 'YouTube',
    type: 'Trailer',
    size: 1080,
    official: true,
    published_at: '2014-10-02T19:20:22.000Z',
  },
];

const picked = pickBestYoutubeTrailerKey(fightClubVideos);
const tmdbOk = picked === 'BdJKm16Co6M';
console.log(`${status(tmdbOk)}  Picks official 1080p key BdJKm16Co6M (got ${picked ?? 'null'})`);
if (!tmdbOk) failures += 1;

const oldPick = fightClubVideos.find((v) => v.site === 'YouTube' && v.type === 'Trailer')?.key;
const tmdbBetter = picked !== oldPick;
console.log(
  `${status(tmdbBetter)}  Differs from legacy first-match pick (${oldPick}) — higher-quality source`
);
if (!tmdbBetter) failures += 1;

console.log('\n--- Summary ---\n');
if (failures === 0) {
  console.log('All checks PASSED. Trailer modal should render 16:9 on TV viewports.');
  process.exit(0);
}

console.log(`${failures} check(s) FAILED. Review layout or selection logic.`);
process.exit(1);
