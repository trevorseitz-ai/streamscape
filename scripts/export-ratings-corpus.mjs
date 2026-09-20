/**
 * Pulls a large, deliberately spread corpus of titles for fitting per-source
 * rating calibration curves and vote-count distributions.
 *
 * Run from repo root:   node scripts/export-ratings-corpus.mjs
 * Writes:               scripts/real-corpus.json
 *
 * Unlike export-ratings-sample.mjs (which grabs whatever is popular right
 * now), this walks /discover across deliberately chosen vote-count bands so
 * the obscure end of the catalog is represented. Calibration fitted only on
 * blockbusters would be useless for the titles that actually need it.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']+|["']+$/g, '')]; }),
);

const TMDB = env.TMDB_API_KEY || env.EXPO_PUBLIC_TMDB_API_KEY;
const OMDB = env.EXPO_PUBLIC_OMDB_API_KEY;
const TARGET = Number(process.env.COUNT ?? 400);

if (!TMDB || !OMDB) { console.error('Missing TMDB or OMDb key in .env'); process.exit(1); }

const isReadToken = (k) => k.startsWith('eyJ') && k.split('.').length >= 3;
const V4 = isReadToken(TMDB);
const tmdbInit = V4 ? { headers: { Accept: 'application/json', Authorization: `Bearer ${TMDB}` } } : undefined;
function tmdbUrl(path, params = {}) {
  const u = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  if (!V4) u.searchParams.set('api_key', TMDB);
  return u.toString();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(url, init, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, init);
    if (r.ok) return r.json();
    if (r.status === 429) { await sleep(1500 * (i + 1)); continue; }
    throw new Error(`${r.status}`);
  }
  throw new Error('retries exhausted');
}
const num = (s) => { const n = parseFloat(String(s ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : null; };
const votes = (s) => { const n = parseInt(String(s ?? '').replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? n : null; };

// Vote-count bands. Without these the sample is all blockbusters and the
// calibration never sees the low end, which is exactly where TMDB and IMDb
// diverge most.
const BANDS = [
  { gte: 10,    lte: 100    },
  { gte: 100,   lte: 500    },
  { gte: 500,   lte: 2000   },
  { gte: 2000,  lte: 10000  },
  { gte: 10000, lte: 50000  },
  { gte: 50000, lte: 1000000 },
];
const PER_BAND = Math.ceil(TARGET / BANDS.length);

const seen = new Set();
const pool = [];
for (const b of BANDS) {
  let got = 0;
  for (let page = 1; page <= 10 && got < PER_BAND; page++) {
    let d;
    try {
      d = await j(tmdbUrl('/discover/movie', {
        page,
        sort_by: 'popularity.desc',
        'vote_count.gte': b.gte,
        'vote_count.lte': b.lte,
        include_adult: 'false',
      }), tmdbInit);
    } catch { break; }
    for (const m of d.results ?? []) {
      if (seen.has(m.id) || got >= PER_BAND) continue;
      seen.add(m.id); pool.push(m); got++;
    }
    if (!d.results?.length) break;
  }
  console.log(`  band ${b.gte}–${b.lte} votes: ${got} titles`);
}
console.log(`pool: ${pool.length} titles — now joining OMDb (this takes a few minutes)`);

const out = [];
let done = 0, omdbFail = 0;
for (const m of pool) {
  done++;
  if (done % 25 === 0) process.stdout.write(`  ${done}/${pool.length}\r`);
  let ext = {}, omdb = {};
  try { ext = await j(tmdbUrl(`/movie/${m.id}/external_ids`), tmdbInit); } catch {}
  const imdbId = ext.imdb_id || null;
  if (imdbId) {
    try {
      omdb = await j(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB}`);
      if (omdb.Response === 'False') { omdbFail++; omdb = {}; }
    } catch { omdbFail++; }
  }

  const updated = new Date().toISOString().slice(0, 10);
  const ratings = [];
  if (typeof m.vote_average === 'number' && m.vote_average > 0)
    ratings.push({ source: 'tmdb', value: m.vote_average, votes: m.vote_count ?? null, updated });
  const imdbR = num(omdb.imdbRating);
  if (imdbR !== null) ratings.push({ source: 'imdb', value: imdbR, votes: votes(omdb.imdbVotes), updated });
  const rt = (omdb.Ratings ?? []).find((r) => r.Source === 'Rotten Tomatoes');
  if (rt) ratings.push({ source: 'rt_critics', value: num(rt.Value), votes: null, updated });
  const mc = num(omdb.Metascore);
  if (mc !== null) ratings.push({ source: 'metacritic', value: mc, votes: null, updated });

  if (ratings.length < 2) continue;
  out.push({
    id: String(m.id), title: m.title,
    year: Number((m.release_date ?? '').slice(0, 4)) || null,
    genres: (omdb.Genre ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    runtime: num(omdb.Runtime) ?? 0, imdb_id: imdbId, ratings,
  });
}

writeFileSync('scripts/real-corpus.json', JSON.stringify(out));
const has = (s) => out.filter((t) => t.ratings.some((r) => r.source === s)).length;
const paired = out.filter((t) => t.ratings.some((r) => r.source === 'tmdb') && t.ratings.some((r) => r.source === 'imdb')).length;
console.log(`\nWrote scripts/real-corpus.json — ${out.length} titles`);
console.log(`  tmdb ${has('tmdb')} · imdb ${has('imdb')} · rt ${has('rt_critics')} · metacritic ${has('metacritic')}`);
console.log(`  tmdb+imdb paired: ${paired}  (need 50+ to fit calibration, 200+ is better)`);
console.log(`  omdb lookups failed: ${omdbFail}`);
