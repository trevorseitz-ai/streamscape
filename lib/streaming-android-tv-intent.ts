/**
 * Android TV: **`ACTION_VIEW`** via **`expo-intent-launcher`**, plus **`Linking.openURL`** as a last resort
 * (**Attempt C**) when package-targeted and implicit intents fail (**Sony-friendly “naked” A first**).
 *
 * **`patch-package`** (`patches/expo-intent-launcher+55.0.12.patch`): **`Intent.setPackage`** when set;
 * **`categories[]`** when used (Attempt B only); one-shot **`startActivity`** for **`ACTION_VIEW`** + data URI
 * so the promise does not block on **`startActivityForResult`**.
 */

import type { IntentLauncherParams } from 'expo-intent-launcher';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import { Platform, ToastAndroid } from 'react-native';
import type { StreamingOption } from './streaming-rapid';
import {
  collectStreamingLaunchCandidates,
  getAndroidTvPackageCandidatesForTmdbProviderId,
} from './linking-utils';

/** Explicit **`android.intent.action.VIEW`** (not a settings / implicit action). */
const ACTION_VIEW = 'android.intent.action.VIEW';

/**
 * Opens the handler in its own task so leanback/streaming clients are not glued to ReelDive’s activity stack.
 * @see [`Intent.FLAG_ACTIVITY_NEW_TASK`](https://developer.android.com/reference/android/content/Intent#FLAG_ACTIVITY_NEW_TASK)
 */
const FLAG_ACTIVITY_NEW_TASK = 0x10000000;

/** Attempt A — package-targeted **`VIEW`** only (no **`categories`**; some Sony apps reject **`BROWSABLE`** on explicit targets). */
function buildIntentAttemptA(uri: string, packageName: string): IntentLauncherParams {
  return {
    data: uri,
    packageName,
    flags: FLAG_ACTIVITY_NEW_TASK,
  };
}

/** Attempt B — implicit resolver: **`DEFAULT`** only. */
const CATEGORY_IMPLICIT_DEFAULT_ONLY: readonly string[] = ['android.intent.category.DEFAULT'];

function buildIntentAttemptB(uri: string): IntentLauncherParams {
  const out: IntentLauncherParams = {
    data: uri,
    flags: FLAG_ACTIVITY_NEW_TASK,
  };
  if (CATEGORY_IMPLICIT_DEFAULT_ONLY.length > 0) {
    out.categories = [...CATEGORY_IMPLICIT_DEFAULT_ONLY];
  }
  return out;
}

function logHandoffAttempt(params: {
  attempt: 'A' | 'B' | 'C';
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
        : '📦 PACKAGE: (Linking.openURL bridge)';
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
        : `Open URL\n${shortUri}`;
  ToastAndroid.show(toastLabel, ToastAndroid.LONG);
}

export type AndroidTvIntentLaunchResult =
  | { ok: true; packageName: string; uri: string }
  | { ok: false; packageName: string | null };

/**
 * **`collectStreamingLaunchCandidates`** drives URI order (**Bravia-tailored **`nflx`**, **`amzn`**, **`apple-tv`**, …).
 *
 * **Attempt A:** each matrix **`packageName`** × URI, **`ACTION_VIEW`** + **`FLAG_ACTIVITY_NEW_TASK`**, **no **`categories`**.
 * **Attempt B:** same URI, implicit **`VIEW`**, **`DEFAULT`** category only.
 * **Attempt C:** **`Linking.openURL`** (React Native **`Intent.ACTION_VIEW`** path; no **`NEW_TASK`** from JS —
 * aligns with handset-style apps like Disney+).
 */
export async function launchStreamingViaAndroidTvIntent(
  providerIdStr: string,
  option: StreamingOption
): Promise<AndroidTvIntentLaunchResult> {
  const pkgs = getAndroidTvPackageCandidatesForTmdbProviderId(providerIdStr);
  if (pkgs.length === 0) {
    return { ok: false, packageName: null };
  }

  const candidates = collectStreamingLaunchCandidates(providerIdStr, option);
  const primaryPkg = pkgs[0] ?? null;

  for (let i = 0; i < candidates.length; i++) {
    const uri = candidates[i]!;

    for (let j = 0; j < pkgs.length; j++) {
      const pkg = pkgs[j]!;
      try {
        logHandoffAttempt({
          attempt: 'A',
          uri,
          packageName: pkg,
          spotlight: i === 0 && j === 0,
        });
        await IntentLauncher.startActivityAsync(ACTION_VIEW, buildIntentAttemptA(uri, pkg));
        return { ok: true, packageName: pkg, uri };
      } catch {
        console.warn(
          `⚠️ [HANDOFF] Attempt A failed (package-targeted VIEW, no categories): ${pkg}`
        );
      }
    }

    try {
      logHandoffAttempt({
        attempt: 'B',
        uri,
        spotlight: false,
      });
      await IntentLauncher.startActivityAsync(ACTION_VIEW, buildIntentAttemptB(uri));
      return { ok: true, packageName: primaryPkg ?? '', uri };
    } catch {
      console.warn(`⚠️ [HANDOFF] Attempt B failed (implicit VIEW) for URI.`);
    }

    try {
      logHandoffAttempt({
        attempt: 'C',
        uri,
        spotlight: false,
      });
      await Linking.openURL(uri);
      return { ok: true, packageName: primaryPkg ?? '', uri };
    } catch {
      console.warn(`⚠️ [HANDOFF] Attempt C failed (Linking.openURL).`);
    }
  }

  return { ok: false, packageName: primaryPkg };
}
