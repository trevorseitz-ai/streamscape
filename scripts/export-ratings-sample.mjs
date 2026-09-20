/**
 * Exports a sample of real titles with every rating source ReelDive can reach,
 * for testing the Jev rating-validity harness against real data.
 *
 * Run from the repo root:   node scripts/export-ratings-sample.mjs
 * Writes:                   scripts/real-titles.json
 *
 * Reads keys from .env. Nothing is sent anywhere except TMDB and OMDb.
 *
 * Captures imdbVotes and TMDB vote_count — two fields already present in
 * responses the app fetches but currently discards.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']+|["']+$/g, '')];
    }),
);

const TMDB = env.TMDB_API_KEY || env.EXPO_PUBLIC_TMDB_API_KEY;
const OMDB = env.EXPO_PUBLIC_OMDB_API_KEY;
const COUNT = Number(process.env.COUNT ?? 25);

if (!TMDB) { console.error('Missing TMDB key in .env'); process.exit(1); }
if (!OMDB) { console.error('Missing EXPO_PUBLIC_OMDB_API_KEY in .env'); process.exit(1); }

// Same rule as lib/tmdbFetch.ts: a v4 Read Access Token is a JWT and goes in
// the Authorization header; a v3 key goes in the query string.
const isReadToken = (k) => k.startsWith('eyJ') && k.split('.').length >= 3 && k.split('.').every((p) => p);
const V4 = isReadToken(TMDB);
console.log(`TMDB auth: ${V4 ? 'v4 Read Access Token (Bearer header)' : 'v3 api_key (query param)'}`);

function tmdbUrl(path, params = {}) {
  const u = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  if (!V4) u.searchParams.set('api_key', TMDB);
  return u.toString();
}
const tmdbInit = V4
  ? { headers: { Accept: 'application/json', Authorization: `Bearer ${TMDB}` } }
  : undefined;

const j = async (url, init) => {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${url.replace(/api_key=[^&]+/, 'api_key=***')}`);
  return r.json();
};
const num = (s) => { const n = parseFloat(String(s ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : null; };
const votes = (s) => { const n = parseInt(String(s ?? '').replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? n : null; };

// Mixed sample: blockbusters, critical darlings, and brand-new releases.
// The last group is where thin samples actually bite.
const lists = ['/movie/popular', '/movie/top_rated', '/movie/now_playing'];

const seen = new Set();
const pool = [];
for (const path of lists) {
  const d = await j(tmdbUrl(path, { page: 1 }), tmdbInit);
  for (const m of d.results ?? []) if (!seen.has(m.id)) { seen.add(m.id); pool.push(m); }
}
console.log(`TMDB pool: ${pool.length} unique titles`);

const picked = pool.sort(() => Math.random() - 0.5).slice(0, COUNT);
const out = [];
let omdbFailures = 0;

for (const m of picked) {
  process.stdout.write(`  ${m.title.slice(0, 50).padEnd(52)}\r`);
  let ext = {}, omdb = {};
  try { ext = await j(tmdbUrl(`/movie/${m.id}/external_ids`), tmdbInit); } catch {}
  const imdbId = ext.imdb_id || null;
  if (imdbId) {
    try {
      omdb = await j(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB}`);
      if (omdb.Response === 'False') { omdbFailures++; omdb = {}; }
    } catch { omdbFailures++; }
  }

  const updated = new Date().toISOString().slice(0, 10);
  const ratings = [];

  if (typeof m.vote_average === 'number' && m.vote_average > 0)
    ratings.push({ source: 'tmdb', value: m.vote_average, votes: m.vote_count ?? null, updated });

  const imdbR = num(omdb.imdbRating);
  if (imdbR !== null)
    ratings.push({ source: 'imdb', value: imdbR, votes: votes(omdb.imdbVotes), updated });

  const rt = (omdb.Ratings ?? []).find((r) => r.Source === 'Rotten Tomatoes');
  if (rt) ratings.push({ source: 'rt_critics', value: num(rt.Value), votes: null, updated });

  const mc = num(omdb.Metascore);
  if (mc !== null) ratings.push({ source: 'metacritic', value: mc, votes: null, updated });

  if (ratings.length < 2) continue;

  out.push({
    id: String(m.id),
    title: m.title,
    year: Number((m.release_date ?? '').slice(0, 4)) || null,
    genres: (omdb.Genre ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    runtime: num(omdb.Runtime) ?? 0,
    imdb_id: imdbId,
    ratings,
  });
}

writeFileSync('scripts/real-titles.json', JSON.stringify(out, null, 2));
const withVotes = out.filter((t) => t.ratings.some((r) => r.source === 'imdb' && r.votes));
console.log(`\nWrote scripts/real-titles.json — ${out.length} titles`);
console.log(`  with imdb votes:  ${withVotes.length}`);
console.log(`  with tmdb votes:  ${out.filter((t) => t.ratings.some((r) => r.source === 'tmdb' && r.votes)).length}`);
console.log(`  with rt_critics:  ${out.filter((t) => t.ratings.some((r) => r.source === 'rt_critics')).length}`);
console.log(`  with metacritic:  ${out.filter((t) => t.ratings.some((r) => r.source === 'metacritic')).length}`);
console.log(`  omdb lookups failed: ${omdbFailures}`);
if (withVotes.length) {
  const v = withVotes.flatMap((t) => t.ratings.filter((r) => r.source === 'imdb').map((r) => r.votes)).sort((a, b) => a - b);
  console.log(`  imdb vote range:  ${v[0].toLocaleString()} – ${v[v.length - 1].toLocaleString()}`);
}
