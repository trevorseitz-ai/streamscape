/**
 * Shows the old vs new Top Rated ordering against the live TMDB API, so the
 * ranking change can be checked without rebuilding the app.
 *
 *   node scripts/check-top-rated.mjs          # all years
 *   YEAR=2024 node scripts/check-top-rated.mjs
 */
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']+|["']+$/g, '')]; }),
);
const TMDB = env.TMDB_API_KEY || env.EXPO_PUBLIC_TMDB_API_KEY;
if (!TMDB) { console.error('No TMDB key in .env'); process.exit(1); }

const V4 = TMDB.startsWith('eyJ') && TMDB.split('.').length >= 3;
const init = V4 ? { headers: { Accept: 'application/json', Authorization: `Bearer ${TMDB}` } } : undefined;
const YEAR = process.env.YEAR ? Number(process.env.YEAR) : null;

// Must match lib/rankScore.ts
const C = 7.16, m = 500;
const score = (R, v) => (v > 0 ? (v / (v + m)) * R + (m / (v + m)) * C : C);

function url(sort, page) {
  const u = new URL('https://api.themoviedb.org/3/discover/movie');
  u.searchParams.set('region', 'US');
  u.searchParams.set('language', 'en-US');
  u.searchParams.set('page', String(page));
  u.searchParams.set('sort_by', sort);
  u.searchParams.set('vote_count.gte', '100');
  if (YEAR) u.searchParams.set('primary_release_year', String(YEAR));
  if (!V4) u.searchParams.set('api_key', TMDB);
  return u.toString();
}
const get = async (sort, page) => (await fetch(url(sort, page), init)).json();

const pad = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));
console.log(`\nTop Rated ${YEAR ?? '(all years)'}\n`);

// OLD: page 1 of vote_average.desc
const old = await get('vote_average.desc', 1);
console.log('BEFORE — sort_by=vote_average.desc, page 1\n');
for (const mv of (old.results ?? []).slice(0, 10)) {
  console.log(`  ${pad(mv.title, 40)} ${mv.vote_average.toFixed(1).padStart(5)}  ${String(mv.vote_count).padStart(7)} votes`);
}

// NEW: 5 pages of vote_count.desc, ranked by shrunk score
const pages = await Promise.all([1, 2, 3, 4, 5].map((p) => get('vote_count.desc', p).catch(() => null)));
const seen = new Set();
const pool = [];
for (const d of pages) for (const mv of d?.results ?? []) if (!seen.has(mv.id)) { seen.add(mv.id); pool.push(mv); }
pool.sort((a, b) => score(b.vote_average, b.vote_count) - score(a.vote_average, a.vote_count));

console.log(`\nAFTER — ${pool.length}-title pool by vote_count.desc, ranked by shrunk score\n`);
for (const mv of pool.slice(0, 10)) {
  console.log(`  ${pad(mv.title, 40)} ${score(mv.vote_average, mv.vote_count).toFixed(2).padStart(5)}   (raw ${mv.vote_average.toFixed(1)}, ${mv.vote_count.toLocaleString()} votes)`);
}
console.log('');
