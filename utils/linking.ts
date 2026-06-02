import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

/**
 * Prime Video lean-back launch: **`expo-intent-launcher`** **`startActivityAsync`** with explicit
 * **`packageName`** / **`className`** and **`LEANBACK_LAUNCHER`** (**no **`Linking.sendIntent`**).
 *
 * **@returns** **`true`** if **`startActivityAsync`** resolves, **`false`** on **`catch`** (**non‑Android**: **`false`**).
 */
export const openPrimeVideoApp = async (): Promise<boolean> => {
  const packageId = 'com.amazon.amazonvideo.livingroom';
  const activityClass = 'com.amazon.ignition.IgnitionActivity';

  if (Platform.OS !== 'android') {
    return false;
  }

  console.log(
    '[ReelDive Debug] Using native expo-intent-launcher for explicit target: ' +
      packageId +
      '/' +
      activityClass
  );

  try {
    await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
      packageName: packageId,
      className: activityClass,
      category: 'android.intent.category.LEANBACK_LAUNCHER',
    });
    console.log('[ReelDive Debug] Native intent launcher opened container successfully');
    return true;
  } catch (error) {
    console.error('[ReelDive Debug] Native expo-intent-launcher failed for Prime Video:', error);
    return false;
  }
};

/** Sony/Android TV **`Apple TV`** lean-back (**`ACTION_MAIN`** + **`LEANBACK_LAUNCHER`** — mirrors **`openPrimeVideoApp`**). */
export const openAppleTvApp = async (): Promise<boolean> => {
  const packageId = 'com.apple.atve.sony.appletv';
  const activityClass = 'com.apple.atve.androidtv.appletv.MainActivity';

  if (Platform.OS !== 'android') {
    return false;
  }

  console.log(
    '[ReelDive Debug] Launching native Apple TV container with verified production class: ' +
      packageId +
      '/' +
      activityClass
  );

  try {
    await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
      packageName: packageId,
      className: activityClass,
      category: 'android.intent.category.LEANBACK_LAUNCHER',
    });
    console.log('[ReelDive Debug] Apple TV native container opened fullscreen successfully');
    return true;
  } catch (error) {
    console.error('[ReelDive Debug] Native expo-intent-launcher failed for Apple TV:', error);
    return false;
  }
};

/** Android TV Paramount+ lean-back (**`ACTION_MAIN`** + **`LEANBACK_LAUNCHER`** — mirrors **`openPrimeVideoApp`**). */
export const openParamountPlusApp = async (): Promise<boolean> => {
  const packageId = 'com.cbs.ott';
  const activityClass = 'com.cbs.app.tv.ui.activity.HomeActivity';

  if (Platform.OS !== 'android') {
    return false;
  }

  console.log(
    '[ReelDive Debug] Launching native Paramount Plus container: ' +
      packageId +
      '/' +
      activityClass
  );

  try {
    await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
      packageName: packageId,
      className: activityClass,
      category: 'android.intent.category.LEANBACK_LAUNCHER',
    });
    console.log('[ReelDive Debug] Paramount Plus intent launcher opened container successfully');
    return true;
  } catch (error) {
    console.error('[ReelDive Debug] Native expo-intent-launcher failed for Paramount Plus:', error);
    return false;
  }
};
