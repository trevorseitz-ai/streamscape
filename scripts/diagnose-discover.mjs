/**
 * Probes the exact TMDB discover queries the Discover screen builds, so we can
 * see which filter is emptying the result set.
 *
 *   YEAR=2026 node scripts/diagnose-discover.mjs
 */
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']+|["']+$/g, '')]; }),
);
const TMDB = env.TMDB_API_KEY || env.EXPO_PUBLIC_TMDB_API_KEY;
const V4 = TMDB.startsWith('eyJ');
const init = V4 ? { headers: { Accept: 'application/json', Authorization: `Bearer ${TMDB}` } } : undefined;
const YEAR = process.env.YEAR ? Number(process.env.YEAR) : 2026;

async function probe(label, params) {
  const u = new URL('https://api.themoviedb.org/3/discover/movie');
  u.searchParams.set('page', '1');
  u.searchParams.set('language', 'en-US');
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, String(v));
  if (!V4) u.searchParams.set('api_key', TMDB);
  const r = await fetch(u.toString(), init);
  if (!r.ok) { console.log(`  ${label.padEnd(56)} HTTP ${r.status}`); return; }
  const d = await r.json();
  const n = d.total_results ?? 0;
  const top = (d.results ?? []).slice(0, 3)
    .map((m) => `${m.title} (${m.vote_average}, ${m.vote_count}v)`).join(' | ');
  console.log(`  ${label.padEnd(56)} ${String(n).padStart(6)} results`);
  if (n) console.log(`      ${top}`);
}

console.log(`\nDiscover probes for year ${YEAR}\n`);
console.log('WHAT THE APP ASKS FOR NOW (phase 1):');
await probe('region=US, vote_count.desc, gte=100', { region: 'US', primary_release_year: YEAR, sort_by: 'vote_count.desc', 'vote_count.gte': 100 });

console.log('\nISOLATING EACH FILTER:');
await probe('no region,  vote_count.desc, gte=100', { primary_release_year: YEAR, sort_by: 'vote_count.desc', 'vote_count.gte': 100 });
await probe('region=US, vote_count.desc, gte=10', { region: 'US', primary_release_year: YEAR, sort_by: 'vote_count.desc', 'vote_count.gte': 10 });
await probe('region=US, vote_count.desc, no floor', { region: 'US', primary_release_year: YEAR, sort_by: 'vote_count.desc' });
await probe('region=US, vote_average.desc, gte=10 (OLD)', { region: 'US', primary_release_year: YEAR, sort_by: 'vote_average.desc', 'vote_count.gte': 10 });
await probe('region=US, popularity.desc (phase 2)', { region: 'US', primary_release_year: YEAR, sort_by: 'popularity.desc' });

console.log('\nUSING release_date RANGE INSTEAD OF primary_release_year:');
await probe('no region, date range, vote_count.desc, gte=100', {
  'primary_release_date.gte': `${YEAR}-01-01`,
  'primary_release_date.lte': `${YEAR}-12-31`,
  sort_by: 'vote_count.desc', 'vote_count.gte': 100,
});
console.log('');
