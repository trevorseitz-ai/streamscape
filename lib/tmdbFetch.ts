const TMDB_ORIGIN = 'https://api.themoviedb.org/3';

/**
 * Use the same global `fetch` as the rest of React Native.
 * `expo/fetch` uses a different native TLS path and can throw
 * `SSLHandshakeException: chain validation failed` on some devices/emulators
 * where standard OkHttp + system trust store works for api.themoviedb.org.
 */
function dispatchFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, init);
}

/**
 * Trim, strip BOM, strip accidental quotes from .env pastes.
 */
export function sanitizeTmdbSecret(key: string): string {
  return key
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/^["']+|["']+$/g, '');
}

/**
 * TMDB v3 "API Key" → use `api_key` query param.
 * TMDB "Read Access Token" (JWT) → use `Authorization: Bearer …`.
 */
function isReadAccessToken(key: string): boolean {
  const t = key.trim();
  if (!t.startsWith('eyJ')) return false;
  const parts = t.split('.');
  return parts.length >= 3 && parts.every((p) => p.length > 0);
}

export function buildTmdbUrl(
  path: string,
  query: Record<string, string | undefined>,
  apiKey: string
): { url: string; init?: RequestInit } {
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${TMDB_ORIGIN}${p}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || String(v).trim() === '') return;
    url.searchParams.set(k, String(v));
  });

  if (isReadAccessToken(apiKey)) {
    return {
      url: url.toString(),
      init: {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      },
    };
  }

  url.searchParams.set('api_key', apiKey);
  return {
    url: url.toString(),
    init: { headers: { Accept: 'application/json' } },
  };
}

export async function fetchTmdb(
  path: string,
  query: Record<string, string | undefined>,
  apiKey: string,
  options?: { signal?: AbortSignal }
): Promise<Response> {
  const key = sanitizeTmdbSecret(apiKey);
  const { url, init } = buildTmdbUrl(path, query, key);
  return dispatchFetch(url, {
    ...init,
    signal: options?.signal,
    headers: {
      ...init?.headers,
      Accept: 'application/json',
    },
  });
}
