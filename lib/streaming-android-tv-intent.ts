/**
 * Android TV: **`ACTION_VIEW`** via **`expo-intent-launcher`**, plus **`Linking.openURL`** as a last resort
 * (**Attempt C**) when package-targeted and implicit intents fail (**Sony-friendly explicit **`VIEW`** first**, except Netflix **`nflx://…/search`** → implicit **`VIEW`** first).
 *
 * **`patch-package`** (`patches/expo-intent-launcher+55.0.12.patch`): **`categories[]`**; one-shot **`startActivity`** for **`ACTION_VIEW`** + data URI and for **`ACTION_MAIN`**
 * + **`LAUNCHER`** (**with or without explicit **`className`**) when **`data`** is unset so the promise does not block on **`startActivityForResult`**.
 */

import type { IntentLauncherParams } from 'expo-intent-launcher';
import * as IntentLauncher from 'expo-intent-launcher';
import * as ExpoLinking from 'expo-linking';
import { Platform, ToastAndroid } from 'react-native';
import type { StreamingOption } from './streaming-rapid';
import {
  buildTubiHttpsSearchUrlFromMediaTitle,
  collectStreamingLaunchCandidates,
  type CollectStreamingLaunchOptions,
  getAndroidTvLaunchExtrasForTmdbProviderId,
  getAndroidTvPackageCandidatesForTmdbProviderId,
  toTvImplicitLaunchUri,
  TV_HANDOFF_MAIN_LAUNCH_MARKER,
  TV_HANDOFF_JUST_LAUNCH_URI,
} from './linking-utils';
import { openAppleTvApp, openParamountPlusApp, openPrimeVideoApp } from '../utils/linking';

/** Literal **`Intent`** action strings for OEM TVs (Sony / Fire TV strict parsing). */
const ANDROID_INTENT_ACTION_VIEW = 'android.intent.action.VIEW';
const ANDROID_INTENT_ACTION_MAIN = 'android.intent.action.MAIN';

/**
 * Opens the handler in its own task so leanback/streaming clients are not glued to ReelDive’s activity stack.
 * @see [`Intent.FLAG_ACTIVITY_NEW_TASK`](https://developer.android.com/reference/android/content/Intent#FLAG_ACTIVITY_NEW_TASK)
 */
const FLAG_ACTIVITY_NEW_TASK = 0x10000000;

/** Bring an existing streamer task forward so **`VIEW`** data / URI updates apply (Netflix, Prime, …). */
const FLAG_ACTIVITY_CLEAR_TOP = 0x04000000;

const ATTEMPT_AB_FLAGS = FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_CLEAR_TOP;

/** Netflix Ninja — **`VIEW`** deep links (**Attempt A**). */
const ANDROID_TV_EXPLICIT_MAIN_ACTIVITY: Partial<Record<string, string>> = {
  'com.netflix.ninja': 'com.netflix.ninja.MainActivity',
};

/**
 * Sony Bravia-verified **`ACTION_MAIN`** / **`LAUNCHER`** entry (**Attempt D**): explicit component avoids resolver ambiguity.
 */
const ANDROID_TV_ATTEMPT_D_EXPLICIT_ACTIVITY: Partial<Record<string, string>> = {
  'com.apple.atve.sony.appletv': 'com.apple.atve.androidtv.appletv.MainActivity',
  'com.amazon.amazonvideo.livingroom': 'com.amazon.ignition.IgnitionActivity',
  'com.netflix.ninja': 'com.netflix.ninja.MainActivity',
};

/** Attempt A — explicit **`VIEW`** + **`packageName`**; **`className`** only for Netflix Ninja + **`source`** extra. */
function buildIntentAttemptA(
  uri: string,
  packageName: string,
  opts?: { className?: string; extra?: Record<string, string> }
): IntentLauncherParams {
  const out: IntentLauncherParams = {
    data: uri,
    packageName,
    flags: ATTEMPT_AB_FLAGS,
  };
  if (opts?.className) out.className = opts.className;
  if (opts?.extra && Object.keys(opts.extra).length > 0) out.extra = opts.extra;
  return out;
}

/** Tubi **`https://tubitv.com/movies/…`** — inject title search (**Attempt B**) after package **`VIEW`** fails. */
function isTubiMoviesHttps(uri: string): boolean {
  try {
    const u = new URL(uri.trim());
    const h = u.hostname.toLowerCase();
    if (!h.endsWith('tubitv.com')) return false;
    return /^\/movies\/[^/?#]+/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** Attempt B — implicit **`VIEW`** (**`nflx://`**, **`https://`** storefront/detail, …). */
const CATEGORY_IMPLICIT_DEFAULT_ONLY: readonly string[] = ['android.intent.category.DEFAULT'];

/** Netflix **`nflx://…/search?q=`** — Sony often resolves implicit **`VIEW`** better than package-targeted **`VIEW`**. */
function isNetflixSearchSchemeUri(uri: string): boolean {
  const u = uri.trim().toLowerCase();
  return u.startsWith('nflx://www.netflix.com/search');
}

function buildIntentAttemptB(uri: string): IntentLauncherParams {
  const out: IntentLauncherParams = {
    data: uri,
    flags: ATTEMPT_AB_FLAGS,
  };
  if (CATEGORY_IMPLICIT_DEFAULT_ONLY.length > 0) {
    out.categories = [...CATEGORY_IMPLICIT_DEFAULT_ONLY];
  }
  return out;
}

const CATEGORY_LAUNCHER: readonly string[] = ['android.intent.category.LAUNCHER'];

/** Attempt D — front door: **`android.intent.action.MAIN`** + **`LAUNCHER`** + **`NEW_TASK`**, optional Sony **`className`**. */
function buildIntentAttemptD(packageName: string): IntentLauncherParams {
  const className = ANDROID_TV_ATTEMPT_D_EXPLICIT_ACTIVITY[packageName];
  const out: IntentLauncherParams = {
    packageName,
    flags: FLAG_ACTIVITY_NEW_TASK,
    categories: [...CATEGORY_LAUNCHER],
  };
  if (className) out.className = className;
  return out;
}

function logHandoffAttempt(params: {
  attempt: 'A' | 'B' | 'C' | 'D';
  uri: string;
  packageName?: string | null;
  /** First candidate only — limits toast noise */
  spotlight: boolean;
}): void {
  const pkgLine =
    params.attempt === 'A'
      ? `📦 PACKAGE: ${params.packageName ?? ''}`
      : params.attempt === 'B'
        ? '📦 PACKAGE: (implicit VIEW)'
        : params.attempt === 'C'
          ? '📦 PACKAGE: (Linking.openURL bridge)'
          : `📦 PACKAGE: ${params.packageName ?? ''} (MAIN/LAUNCHER)`;
  console.log('\n🚀 [TV HANDOFF DEBUG] ——————————————————————————————');
  console.log(pkgLine);
  console.log(`🔁 ATTEMPT: ${params.attempt}`);
  console.log(`🔗 FULL URI: ${params.uri}`);
  console.log('————————————————————————————————————————————————————\n');

  const showToast = params.spotlight;
  if (
    !showToast ||
    Platform.OS !== 'android' ||
    !ToastAndroid ||
    typeof ToastAndroid.show !== 'function'
  ) {
    return;
  }
  const shortUri =
    params.uri.length > 50 ? `${params.uri.substring(0, 50)}...` : params.uri;
  const toastLabel =
    params.attempt === 'A'
      ? `Launching ${params.packageName}\n${shortUri}`
      : params.attempt === 'B'
        ? `Opening\n${shortUri}`
        : params.attempt === 'C'
          ? `Open URL\n${shortUri}`
          : `Open app\n${params.packageName ?? ''}`;
  ToastAndroid.show(toastLabel, ToastAndroid.LONG);
}

export type AndroidTvIntentLaunchResult =
  | { ok: true; packageName: string; uri: string }
  | { ok: false; packageName: string | null };

/**
 * **`collectStreamingLaunchCandidates`** drives URI order (**Bravia-tailored **`nflx`**, **`https`**, **`apple-tv`**, …).
 *
 * **Attempt A:** **`packageName`**-targeted **`VIEW`** — **Max** (**`play.max.com`** chain) keeps this first when it succeeds on TV; **Tubi** uses **`/movies/{id}`** here first.
 * **Attempt B:** implicit **`VIEW`** — **Tubi **`/movies/…`**: title **`/search/{title}`** runs **before** generic **`toTvImplicitLaunchUri`**; Netflix search skips **A**.
 * **Attempt C:** **`Linking.openURL`** (same URI order as **B** where applicable).
 * **Attempt D:** **`MAIN`** + **`LAUNCHER`** (**no data**) — Netflix / Prime / Apple TV / Paramount+ Sony packages use explicit **`className`**; sentinel first for Netflix, **and** final **`Trevor fallback`** after all **`VIEW`** attempts fail.
 */
export async function launchStreamingViaAndroidTvIntent(
  providerIdStr: string,
  option: StreamingOption,
  launchOpts?: CollectStreamingLaunchOptions
): Promise<AndroidTvIntentLaunchResult> {
  const handoffPid = Number.parseInt(String(providerIdStr).trim(), 10);
  if (Number.isFinite(handoffPid) && handoffPid === 9) {
    void option;
    void launchOpts;
    const ok = await openPrimeVideoApp();
    const pkg = 'com.amazon.amazonvideo.livingroom';
    return ok
      ? { ok: true, packageName: pkg, uri: ANDROID_INTENT_ACTION_MAIN }
      : { ok: false, packageName: pkg };
  }

  if (Number.isFinite(handoffPid) && handoffPid === 350) {
    void option;
    void launchOpts;
    const ok = await openAppleTvApp();
    const pkg = 'com.apple.atve.sony.appletv';
    return ok
      ? { ok: true, packageName: pkg, uri: ANDROID_INTENT_ACTION_MAIN }
      : { ok: false, packageName: pkg };
  }

  if (Number.isFinite(handoffPid) && handoffPid === 531) {
    void option;
    void launchOpts;
    const ok = await openParamountPlusApp();
    const pkg = 'com.cbs.ott';
    return ok
      ? { ok: true, packageName: pkg, uri: ANDROID_INTENT_ACTION_MAIN }
      : { ok: false, packageName: pkg };
  }

  const pkgs = getAndroidTvPackageCandidatesForTmdbProviderId(providerIdStr);
  if (pkgs.length === 0) {
    return { ok: false, packageName: null };
  }

  const candidates = collectStreamingLaunchCandidates(providerIdStr, option, launchOpts);
  const primaryPkg = pkgs[0] ?? null;
  const matrixExtras = getAndroidTvLaunchExtrasForTmdbProviderId(providerIdStr);

  for (let i = 0; i < candidates.length; i++) {
    const uri = candidates[i]!;

    if (uri === TV_HANDOFF_MAIN_LAUNCH_MARKER || uri === TV_HANDOFF_JUST_LAUNCH_URI) {
      for (let j = 0; j < pkgs.length; j++) {
        const pkg = pkgs[j]!;
        try {
          logHandoffAttempt({
            attempt: 'D',
            uri: '(android.intent.action.MAIN)',
            packageName: pkg,
            spotlight: i === 0 && j === 0,
          });
          await IntentLauncher.startActivityAsync(
            ANDROID_INTENT_ACTION_MAIN,
            buildIntentAttemptD(pkg)
          );
          return { ok: true, packageName: pkg, uri: TV_HANDOFF_MAIN_LAUNCH_MARKER };
        } catch {
          console.warn(`⚠️ [HANDOFF] Attempt D failed (MAIN/LAUNCHER): ${pkg}`);
        }
      }
      continue;
    }

    const implicitUri = toTvImplicitLaunchUri(providerIdStr, uri, option);
    const handoffPid = Number.parseInt(String(providerIdStr).trim(), 10);
    const skipAttemptA = handoffPid === 8 && isNetflixSearchSchemeUri(uri);

    if (!skipAttemptA) {
      for (let j = 0; j < pkgs.length; j++) {
        const pkg = pkgs[j]!;
        try {
          logHandoffAttempt({
            attempt: 'A',
            uri,
            packageName: pkg,
            spotlight: i === 0 && j === 0,
          });
          const mainActivity = ANDROID_TV_EXPLICIT_MAIN_ACTIVITY[pkg];
          const extrasForPkg = pkg === primaryPkg ? matrixExtras : undefined;
          await IntentLauncher.startActivityAsync(
            ANDROID_INTENT_ACTION_VIEW,
            buildIntentAttemptA(uri, pkg, {
              className: mainActivity,
              extra: extrasForPkg,
            })
          );
          return { ok: true, packageName: pkg, uri };
        } catch {
          console.warn(
            `⚠️ [HANDOFF] Attempt A failed (package-targeted VIEW, no categories): ${pkg}`
          );
        }
      }
    }

    const tubiTitleSearchUrl = buildTubiHttpsSearchUrlFromMediaTitle(launchOpts?.mediaTitle);
    const tryTubiTitleSearchFirst =
      handoffPid === 33 &&
      isTubiMoviesHttps(uri) &&
      tubiTitleSearchUrl != null &&
      tubiTitleSearchUrl !== implicitUri;

    if (tryTubiTitleSearchFirst) {
      try {
        logHandoffAttempt({
          attempt: 'B',
          uri: tubiTitleSearchUrl,
          spotlight: false,
        });
        await IntentLauncher.startActivityAsync(
          ANDROID_INTENT_ACTION_VIEW,
          buildIntentAttemptB(tubiTitleSearchUrl)
        );
        return { ok: true, packageName: primaryPkg ?? '', uri: tubiTitleSearchUrl };
      } catch {
        console.warn(`⚠️ [HANDOFF] Attempt B failed (Tubi /search implicit VIEW).`);
      }

      try {
        logHandoffAttempt({
          attempt: 'C',
          uri: tubiTitleSearchUrl,
          spotlight: false,
        });
      await ExpoLinking.openURL(tubiTitleSearchUrl);
        return { ok: true, packageName: primaryPkg ?? '', uri: tubiTitleSearchUrl };
      } catch {
        console.warn(`⚠️ [HANDOFF] Attempt C failed (Tubi /search Linking).`);
      }
    }

    try {
      logHandoffAttempt({
        attempt: 'B',
        uri: implicitUri,
        spotlight: false,
      });
      await IntentLauncher.startActivityAsync(ANDROID_INTENT_ACTION_VIEW, buildIntentAttemptB(implicitUri));
      return { ok: true, packageName: primaryPkg ?? '', uri: implicitUri };
    } catch {
      console.warn(`⚠️ [HANDOFF] Attempt B failed (implicit VIEW) for URI.`);
    }

    try {
      logHandoffAttempt({
        attempt: 'C',
        uri: implicitUri,
        spotlight: false,
      });
      await ExpoLinking.openURL(implicitUri);
      return { ok: true, packageName: primaryPkg ?? '', uri: implicitUri };
    } catch {
      console.warn(`⚠️ [HANDOFF] Attempt C failed (Linking.openURL).`);
    }
  }

  for (let j = 0; j < pkgs.length; j++) {
    const pkg = pkgs[j]!;
    try {
      logHandoffAttempt({
        attempt: 'D',
        uri: '(android.intent.action.MAIN) [Trevor fallback]',
        packageName: pkg,
        spotlight: j === 0,
      });
      await IntentLauncher.startActivityAsync(
        ANDROID_INTENT_ACTION_MAIN,
        buildIntentAttemptD(pkg)
      );
      return { ok: true, packageName: pkg, uri: TV_HANDOFF_MAIN_LAUNCH_MARKER };
    } catch {
      console.warn(`⚠️ [HANDOFF] Attempt D failed (Trevor fallback MAIN/LAUNCHER): ${pkg}`);
    }
  }

  return { ok: false, packageName: primaryPkg };
}
