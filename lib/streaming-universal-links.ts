/**
 * Universal streaming handoffs via **`Linking.openURL`** — HTTPS (and safe **`https://`** storefront URLs only).
 *
 * Android TV / phone resolve **`ACTION_VIEW`** targets into installed streaming apps, Play Store, or browser.
 * **No OEM forks:** Sony / TCL / Hisense etc. must not special-case routing here — rely on OS dispatch only.
 *
 * Title-aware URLs complement **`lib/linking-utils.ts`** (**`collectStreamingLaunchCandidates`**, intents).
 */

import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { isTvTarget } from './isTv';
import { openAppleTvApp, openParamountPlusApp, openPrimeVideoApp } from '../utils/linking';

/** Mirrors **`PROVIDER_ALIASES`** in **`linking-utils.ts`**. */
const PROVIDER_ALIASES: Record<number, number> = {
  384: 1899,
  24: 1899,
};

function normalizeTmdbProviderId(raw: string | number): number | null {
  const n = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return PROVIDER_ALIASES[n] ?? n;
}

function sanitizeNetflixCatalogDigits(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  return d.length > 0 ? d : null;
}

function sanitizeMaxSegment(raw: string): string | null {
  const t = raw.trim();
  if (t === '') return null;
  return /^[a-zA-Z0-9._~-]+$/.test(t) ? t : null;
}

/**
 * Canonical HTTPS URLs for major services when a provider-native **`externalMovieId`** is known.
 * Order is intentional (title-style URLs before **`/watch/`** where both apply).
 */
export function buildUniversalStreamingHttpsCandidates(
  providerId: string | number,
  externalMovieId?: string
): string[] {
  const pid = normalizeTmdbProviderId(providerId);
  if (pid == null) return [];

  const ext = externalMovieId?.trim();
  if (!ext) return [];

  const ordered: string[] = [];
  const seen = new Set<string>();

  const push = (u: string) => {
    const t = u.trim();
    if (t === '' || seen.has(t)) return;
    seen.add(t);
    ordered.push(t);
  };

  if (pid === 8) {
    const nid = sanitizeNetflixCatalogDigits(ext);
    if (nid != null) {
      push(`https://www.netflix.com/title/${nid}`);
      push(`https://www.netflix.com/watch/${nid}`);
    }
    return ordered;
  }

  /* Prime (**`9`**): omit ASIN/GTI HTTPS (**Android TV**: **`utils/linking`** `openPrimeVideoApp`). */
  if (pid === 9) {
    return ordered;
  }

  /* Apple TV (**`350`**): omit tv.apple.com / scheme URLs (**Android TV**: **`openAppleTvApp`**). */
  if (pid === 350) {
    return ordered;
  }

  /* Paramount+ (**`531`**): omit HTTPS (**Android TV**: **`openParamountPlusApp`**). */
  if (pid === 531) {
    return ordered;
  }

  if (pid === 337) {
    push(`https://www.disneyplus.com/video/${encodeURIComponent(ext.trim())}`);
    return ordered;
  }

  if (pid === 1899) {
    const seg = sanitizeMaxSegment(ext);
    if (seg != null) {
      push(`https://play.max.com/video/watch/${encodeURIComponent(seg)}`);
    }
    return ordered;
  }

  if (pid === 15) {
    push(`https://www.hulu.com/watch/${encodeURIComponent(ext)}`);
    return ordered;
  }

  return ordered;
}

const STOREFRONT_FALLBACK_HTTPS: Partial<Record<number, string>> = {
  8: 'https://www.netflix.com/browse',
  9: 'https://www.primevideo.com/',
  15: 'https://www.hulu.com/hub/home',
  337: 'https://www.disneyplus.com/home',
  1899: 'https://www.max.com/',
  531: 'https://www.paramountplus.com/',
  386: 'https://www.peacocktv.com/',
  350: 'https://tv.apple.com/',
  283: 'https://www.crunchyroll.com/',
  526: 'https://www.amcplus.com/',
  99: 'https://www.shudder.com/',
  358: 'https://www.criterionchannel.com/',
  11: 'https://mubi.com/',
  613: 'https://www.mgmplus.com/',
  520: 'https://www.discoveryplus.com/',
  1794: 'https://www.fubo.tv/',
  33: 'https://tubitv.com/',
};

export type LaunchStreamingServiceOptions = {
  /** Reserved for storefront search URLs (not yet wired through this HTTPS-first helper). */
  mediaTitle?: string;
};

/**
 * Opens the best-known **HTTPS** storefront URL for **`providerId`** (TMDB **`provider_id`**) when
 * **`externalMovieId`** is a service-native catalog token (Netflix numeric title id, Prime ASIN/GTI, Disney slug, …).
 *
 * When **`externalMovieId`** is omitted or does not yield URLs, falls back to the provider
 * **home or browse** HTTPS URL when known.
 *
 * Returns **`false`** when nothing attempted or every **`Linking.openURL`** throws.
 *
 * For full chains (**`nflx://`**, **`ACTION_VIEW`** package intents, RapidAPI links), use **`launchStreamingApp`** from **`linking-utils`**.
 */
export async function launchStreamingService(
  providerId: string | number,
  externalMovieId?: string,
  _opts?: LaunchStreamingServiceOptions
): Promise<boolean> {
  void _opts;
  const pid = normalizeTmdbProviderId(providerId);
  if (pid == null) return false;

  if (pid === 9 && Platform.OS === 'android' && isTvTarget()) {
    return openPrimeVideoApp();
  }

  if (pid === 350 && Platform.OS === 'android' && isTvTarget()) {
    return openAppleTvApp();
  }

  if (pid === 531 && Platform.OS === 'android' && isTvTarget()) {
    return openParamountPlusApp();
  }

  const titled = buildUniversalStreamingHttpsCandidates(providerId, externalMovieId);
  const home = STOREFRONT_FALLBACK_HTTPS[pid];
  const urls = titled.length > 0 ? titled : home != null ? [home] : [];

  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}
