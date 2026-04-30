/**
 * Run from project root with `.env` (STREAM_FINDER_KEY, SUPABASE_SERVICE_ROLE_KEY).
 * `npm run sync:stream-finder`
 */
import 'dotenv/config';
import { runStreamFinderSync } from '../lib/services/stream-finder-sync';

runStreamFinderSync().catch((err) => {
  console.error(err);
  process.exit(1);
});
