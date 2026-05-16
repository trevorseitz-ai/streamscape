import * as IntentLauncher from 'expo-intent-launcher';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StreamingOption } from '../lib/streaming-rapid';
import { isTvTarget } from '../lib/isTv';
import { launchStreamingViaAndroidTvIntent } from '../lib/streaming-android-tv-intent';
import {
  getAndroidTvPackageForTmdbProviderId,
  launchStreamingApp,
  resolveTmdbProviderIdForStreamingOption,
} from '../lib/linking-utils';
import { tvFocusable, tvPreferredFocusProps } from '../lib/tvFocus';
import { tvAndroidNavProps } from '../lib/tvAndroidNavProps';
import { useTvNativeTag } from '../hooks/useTvNativeTag';

/** Matches movie detail streaming strip cyan focus ring. */
const STREAM_BTN_FOCUS = '#00F5FF';

const HANDOFF_OVERLAY_MS = 3000;

type TvRowEntryRefSetter = ReturnType<typeof useTvNativeTag>['setRef'];

type HandoffOverlayState = {
  providerLabel: string;
  packageName: string;
};

export type WatchOnButtonProps = {
  provider: StreamingOption;
  /** Passed into **`collectStreamingLaunchCandidates`** for **`nflx://`** / Prime Video search fallbacks on TV. */
  mediaTitle?: string;
  /** Opens RapidAPI HTTPS URLs — used when `launchStreamingApp` exhausts candidates (and on Web / iOS). */
  onOpenStreamingUrl: (url: string) => void | Promise<void>;
  isLandscape: boolean;
  isPreferredEntry?: boolean;
  tvTextNf?: Record<string, unknown>;
  focusableExplicit?: boolean;
  setEntryRef?: TvRowEntryRefSetter;
  /** Explicit **`nextFocusDown`** (native tag). Omit until the target row has mounted. */
  tvNextFocusDown?: number | null;
  tvNextFocusUp?: number | null;
  /** Row index / count for **`tvOnLadderNativeTag`** registration (Android TV provider stack). */
  tvLadderIndex?: number;
  tvLadderSize?: number;
  tvOnLadderNativeTag?: (index: number, nativeTag: number | null, size: number) => void;
  tvLadderNav?: boolean;
  tvClampRightEdge?: boolean;
};

export function WatchOnButton({
  provider,
  mediaTitle,
  onOpenStreamingUrl,
  isLandscape,
  isPreferredEntry = false,
  tvTextNf = {},
  focusableExplicit = false,
  setEntryRef,
  tvNextFocusDown,
  tvNextFocusUp,
  tvLadderIndex,
  tvLadderSize,
  tvOnLadderNativeTag,
  tvLadderNav = false,
  tvClampRightEdge = false,
}: WatchOnButtonProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [handoffOverlay, setHandoffOverlay] = useState<HandoffOverlayState | null>(null);
  const [appIconDataUri, setAppIconDataUri] = useState<string | null>(null);
  const { setRef: setLocalRef, nativeTag: localTag } = useTvNativeTag();
  const mergedRef: TvRowEntryRefSetter = (node) => {
    setLocalRef(node);
    setEntryRef?.(node);
  };

  const providerKey = resolveTmdbProviderIdForStreamingOption(provider);
  const platformName =
    provider.serviceName.trim() !== '' ? provider.serviceName.trim() : 'service';
  const isAndroidTvUi = Platform.OS === 'android' && isTvTarget();
  let label = `Watch on ${platformName}`;
  if (isAndroidTvUi && providerKey === '8') {
    label = 'Go to Netflix';
  } else if (isAndroidTvUi && providerKey === '9') {
    label = 'Go to Amazon Prime';
  } else if (isAndroidTvUi && providerKey === '350') {
    label = 'Go to Apple TV';
  } else if (isAndroidTvUi && providerKey === '1899') {
    label = 'Watch on Max';
  } else if (isAndroidTvUi && providerKey === '33') {
    label = 'Watch on Tubi';
  }

  useEffect(() => {
    if (!handoffOverlay) {
      setAppIconDataUri(null);
      return;
    }
    const pkg = handoffOverlay.packageName;
    if (Platform.OS !== 'android' || pkg === '') {
      setAppIconDataUri(null);
      return;
    }
    let canceled = false;
    void IntentLauncher.getApplicationIconAsync(pkg)
      .then((b64) => {
        if (!canceled && b64) setAppIconDataUri(b64);
      })
      .catch(() => {
        if (!canceled) setAppIconDataUri(null);
      });
    return () => {
      canceled = true;
    };
  }, [handoffOverlay]);

  useEffect(() => {
    if (!handoffOverlay) return;
    const t = setTimeout(() => setHandoffOverlay(null), HANDOFF_OVERLAY_MS);
    const onAppState = (s: AppStateStatus) => {
      if (s !== 'active') setHandoffOverlay(null);
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [handoffOverlay]);

  useEffect(() => {
    if (
      Platform.OS !== 'android' ||
      !tvLadderNav ||
      tvOnLadderNativeTag == null ||
      tvLadderIndex == null ||
      tvLadderSize == null
    ) {
      return;
    }
    tvOnLadderNativeTag(tvLadderIndex, localTag, tvLadderSize);
  }, [tvLadderNav, tvOnLadderNativeTag, tvLadderIndex, tvLadderSize, localTag]);

  const downNav =
    tvLadderNav && tvNextFocusDown != null
      ? tvAndroidNavProps({ nextFocusDown: tvNextFocusDown })
      : undefined;
  const upNav =
    tvLadderNav && tvNextFocusUp != null
      ? tvAndroidNavProps({ nextFocusUp: tvNextFocusUp })
      : undefined;
  const rightWall =
    tvLadderNav && tvClampRightEdge && localTag != null
      ? tvAndroidNavProps({ nextFocusRightSelf: localTag })
      : undefined;

  const tvNativeFocusable =
    Platform.OS === 'android' && isTvTarget() ? true : focusableExplicit ? true : undefined;
  const tvAccessible = Platform.OS === 'android' && isTvTarget() ? true : undefined;

  const handlePress = useCallback(async () => {
    const preferredHttps = (provider.videoLink ?? provider.link).trim();
    const onTvAndroid = Platform.OS === 'android' && isTvTarget();

    if (onTvAndroid && providerKey != null) {
      const pkg = getAndroidTvPackageForTmdbProviderId(providerKey);
      if (pkg != null) {
        setHandoffOverlay({ providerLabel: platformName, packageName: pkg });
        const res = await launchStreamingViaAndroidTvIntent(providerKey, provider, {
          mediaTitle,
        });
        if (res.ok) return;
        if (preferredHttps !== '') {
          await onOpenStreamingUrl(preferredHttps);
          return;
        }
        return;
      }
    }

    if (Platform.OS === 'android' && providerKey != null) {
      const opened = await launchStreamingApp(providerKey, provider, { mediaTitle });
      if (opened) return;
    }

    if (preferredHttps !== '') {
      await onOpenStreamingUrl(preferredHttps);
    }
  }, [provider, providerKey, mediaTitle, onOpenStreamingUrl, platformName]);

  const initialGlyph = platformName.trim().charAt(0).toUpperCase() || '?';

  return (
    <>
      {/* Slot **`pointerEvents="box-none"`**: touches hit the **`Pressable`** only; avoids parent clipping in stacked layouts. */}
      <View style={styles.streamingTvButtonSlot} pointerEvents="box-none" collapsable={false}>
        <Pressable
          ref={mergedRef as never}
          {...(isPreferredEntry ? tvPreferredFocusProps() : tvFocusable())}
          focusable={tvNativeFocusable}
          accessible={tvAccessible}
          {...(downNav ?? {})}
          {...(upNav ?? {})}
          {...(rightWall ?? {})}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onPress={() => void handlePress()}
          style={({ pressed }) => [
            styles.streamingTvButton,
            isLandscape && styles.streamingTvButtonDesktop,
            isFocused && styles.streamingTvButtonFocused,
            pressed && styles.streamingTvButtonPressing,
          ]}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Opens streaming app when available"
        >
          <Text
            style={[
              styles.streamingTvButtonText,
              isLandscape && styles.streamingTvButtonTextDesktop,
            ]}
            numberOfLines={1}
            {...tvTextNf}
          >
            {label}
          </Text>
        </Pressable>
      </View>

      <Modal visible={handoffOverlay != null} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.handoffBackdrop} pointerEvents="box-none">
          <View style={[styles.handoffCard, isLandscape && styles.handoffCardLandscape]}>
            {appIconDataUri ? (
              <Image
                accessibilityIgnoresInvertColors
                source={{ uri: appIconDataUri }}
                style={styles.handoffAppIcon}
              />
            ) : (
              <View style={styles.handoffGlyphCircle}>
                <Text style={styles.handoffGlyphText}>{initialGlyph}</Text>
              </View>
            )}
            <ActivityIndicator size="large" color={STREAM_BTN_FOCUS} />
            <Text style={styles.handoffTitle} maxFontSizeMultiplier={1.3}>
              Opening {handoffOverlay?.providerLabel ?? platformName}…
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  streamingTvButtonSlot: {
    width: '100%',
    alignSelf: 'stretch',
  },
  streamingTvButton: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#333333',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamingTvButtonDesktop: {
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  /** No **`scale`** / **`zIndex`** here — on stacked rows they inflate hit-testing and the focused row steals presses below. */
  streamingTvButtonFocused: {
    borderColor: STREAM_BTN_FOCUS,
    borderWidth: 3,
    overflow: 'visible',
  },
  streamingTvButtonPressing: {
    opacity: 0.88,
  },
  streamingTvButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  streamingTvButtonTextDesktop: {
    fontSize: 17,
  },
  handoffBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.74)',
    paddingHorizontal: 24,
  },
  handoffCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 32,
    borderRadius: 16,
    backgroundColor: '#252525',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    minWidth: 280,
    maxWidth: 420,
    gap: 14,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
  },
  handoffCardLandscape: {
    paddingVertical: 32,
    paddingHorizontal: 40,
  },
  handoffAppIcon: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  handoffGlyphCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#3d3d3d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handoffGlyphText: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700',
  },
  handoffTitle: {
    color: '#f5f5f5',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
