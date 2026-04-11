/**
 * Vercel Serverless: proxies RapidAPI Streaming Availability (avoids browser CORS; key stays server-side if you use RAPIDAPI_KEY).
 * Env: RAPIDAPI_KEY (preferred) or EXPO_PUBLIC_RAPIDAPI_KEY.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  fetchLiveStreamingOptions,
  normalizeRapidApiKey,
  type StreamingOption,
} from '../lib/streaming-rapid';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rawId = req.query?.tmdbId;
  const tmdbIdStr = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
  const rawType = req.query?.type;
  const typeStr = typeof rawType === 'string' ? rawType : Array.isArray(rawType) ? rawType[0] : 'movie';
  const pathType: 'movie' | 'show' = typeStr === 'show' ? 'show' : 'movie';

  const rawCountry = req.query?.country;
  const countryStr =
    typeof rawCountry === 'string'
      ? rawCountry
      : Array.isArray(rawCountry)
        ? rawCountry[0]
        : 'us';
  const country = (countryStr || 'us').toLowerCase();

  if (!tmdbIdStr) {
    res.status(400).json({ error: 'tmdbId is required' });
    return;
  }
  const tmdbId = Number(tmdbIdStr);
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    res.status(400).json({ error: 'invalid tmdbId' });
    return;
  }

  const apiKey =
    normalizeRapidApiKey(process.env.RAPIDAPI_KEY) ||
    normalizeRapidApiKey(process.env.EXPO_PUBLIC_RAPIDAPI_KEY) ||
    '';

  if (!apiKey) {
    res.status(503).json({
      error: 'RapidAPI key not configured',
      options: [] as StreamingOption[],
    });
    return;
  }

  const options = await fetchLiveStreamingOptions(tmdbId, pathType, country, apiKey);
  res.status(200).json({ options });
}
