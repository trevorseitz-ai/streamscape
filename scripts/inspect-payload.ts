/**
 * One-off: peek at Stream Finder API shape (debug).
 * Usage: load `.env`, then `npx tsx scripts/inspect-payload.ts`
 */
import 'dotenv/config';

import { extractMovies } from '../lib/services/stream-finder-sync';

const STREAM_FINDER_URL =
  process.env.STREAM_FINDER_MOVIES_URL?.trim() ||
  'https://stream-finder--trevorseitzai.replit.app/api/movies';

async function main(): Promise<void> {
  const key = process.env.STREAM_FINDER_KEY?.trim();
  if (!key) {
    throw new Error('Set STREAM_FINDER_KEY in the environment (e.g. .env)');
  }

  const res = await fetch(STREAM_FINDER_URL, {
    headers: {
      'X-Api-Key': key,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Stream Finder HTTP ${res.status}: ${t.slice(0, 800)}`);
  }

  const json: unknown = await res.json();

  /** Same list the sync consumes (after unwrap). */
  const data = extractMovies(json);

  console.log('IS ARRAY:', Array.isArray(data));

  const first = data[0];
  if (first != null && typeof first === 'object') {
    console.log('RAW FIRST MOVIE KEYS:', Object.keys(first as Record<string, unknown>));
    console.log('FULL FIRST MOVIE OBJECT:', JSON.stringify(first, null, 2));
  } else {
    console.log('RAW FIRST MOVIE KEYS:', '(no elements)');
    console.log('FULL FIRST MOVIE OBJECT:', '(undefined)');
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      console.log('ROOT PAYLOAD KEYS:', Object.keys(json as Record<string, unknown>));
      console.log('ROOT SAMPLE:', JSON.stringify(json, null, 2).slice(0, 2000));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
