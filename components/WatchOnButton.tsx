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
  /** Opens RapidAPI HTTPS URLs — used when `launchStreamingApp` exhausts candidates (and on Web / iOS). */
  onOpenStreamingUrl: (url: string) => void | Promise<void>;
  isLandscape: boolean;
  isPreferredEntry?: boolean;
  tvTextNf?: Record<string, unknown>;
  focusableExplicit?: boolean;
  setEntryRef?: TvRowEntryRefSetter;
  tvNextFocusDown?: number | null;
  tvLadderNav?: boolean;
  tvClampRightEdge?: boolean;
};

export function WatchOnButton({
  provider,
  onOpenStreamingUrl,
  isLandscape,
  isPreferredEntry = false,
  tvTextNf = {},
  focusableExplicit = false,
  setEntryRef,
  tvNextFocusDown = null,
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

  const platformName =
    provider.serviceName.trim() !== '' ? provider.serviceName.trim() : 'service';
  const label = `Watch on ${platformName}`;

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

  const downNav =
    tvLadderNav && tvNextFocusDown != null
      ? tvAndroidNavProps({ nextFocusDown: tvNextFocusDown })
      : undefined;
  const rightWall =
    tvLadderNav && tvClampRightEdge && localTag != null
      ? tvAndroidNavProps({ nextFocusRightSelf: localTag })
      : undefined;

  const handlePress = useCallback(async () => {
    const providerKey = resolveTmdbProviderIdForStreamingOption(provider);
    const preferredHttps = (provider.videoLink ?? provider.link).trim();
    const isAndroidTvUi = Platform.OS === 'android' && isTvTarget();

    if (isAndroidTvUi && providerKey != null) {
      const pkg = getAndroidTvPackageForTmdbProviderId(providerKey);
      if (pkg != null) {
        setHandoffOverlay({ providerLabel: platformName, packageName: pkg });
        const res = await launchStreamingViaAndroidTvIntent(providerKey, provider);
        if (res.ok) return;
        if (preferredHttps !== '') {
          await onOpenStreamingUrl(preferredHttps);
          return;
        }
        return;
      }
    }

    if (Platform.OS === 'android' && providerKey != null) {
      const opened = await launchStreamingApp(providerKey, provider);
      if (opened) return;
    }

    if (preferredHttps !== '') {
      await onOpenStreamingUrl(preferredHttps);
    }
  }, [provider, onOpenStreamingUrl, platformName]);

  const initialGlyph = platformName.trim().charAt(0).toUpperCase() || '?';

  return (
    <>
      <Pressable
        ref={mergedRef as never}
        {...(isPreferredEntry ? tvPreferredFocusProps() : tvFocusable())}
        focusable={focusableExplicit ? true : undefined}
        {...(downNav ?? {})}
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
  streamingTvButtonFocused: {
    borderColor: STREAM_BTN_FOCUS,
    borderWidth: 3,
    transform: [{ scale: 1.05 }],
    overflow: 'visible',
    zIndex: 2,
    elevation: 6,
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
