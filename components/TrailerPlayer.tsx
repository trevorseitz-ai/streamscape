import { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, Text, Platform } from 'react-native';
import YoutubePlayer, { type YoutubeIframeRef } from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';

import { tvPreferredFocusProps } from '../lib/tvFocus';

interface TrailerPlayerProps {
  videoId: string;
  height?: number;
  /**
   * TV / **`EXPO_PUBLIC_TV_FOCUS`**: RN **Play** control with **`hasTVPreferredFocus`** drives iframe
   * **`play`** so the Close (×) chip is not the first focus trap.
   */
  tvPlayGate?: boolean;
  /** When the trailer modal hides, internal playback resets (next open shows gate again). */
  modalVisible?: boolean;
}

export function TrailerPlayer({
  videoId,
  height = 250,
  tvPlayGate = false,
  modalVisible = true,
}: TrailerPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const youtubeRef = useRef<YoutubeIframeRef | null>(null);

  useEffect(() => {
    if (!modalVisible) setPlaying(false);
  }, [modalVisible]);

  useEffect(() => {
    setPlaying(false);
  }, [videoId]);

  const playControlled = tvPlayGate ? playing : undefined;

  const handleInitialPlayPress = useCallback(() => {
    if (__DEV__) {
      console.log(
        '[ReelDive Debug] Trailer Play: dispatching direct iframe playVideo() + WebView focus (patched ref).'
      );
    }
    youtubeRef.current?.playVideo();
    setPlaying(true);
  }, []);

  return (
    <View style={[styles.container, height ? { height } : undefined]}>
      <YoutubePlayer
        ref={youtubeRef}
        height={height}
        videoId={videoId}
        play={playControlled}
        forceAndroidAutoplay={tvPlayGate && Platform.OS === 'android'}
      />
      {tvPlayGate && !playing ? (
        <Pressable
          {...tvPreferredFocusProps()}
          style={({ pressed }) => [styles.playOverlay, pressed && styles.playOverlayPressed]}
          onPress={handleInitialPlayPress}
          accessibilityRole="button"
          accessibilityLabel="Play trailer"
        >
          <View style={styles.playCircle}>
            <Ionicons name="play" size={56} color="#ffffff" />
          </View>
          <Text style={styles.playLabel}>Play</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  playOverlayPressed: {
    opacity: 0.92,
  },
  playCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(99, 102, 241, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  playLabel: {
    marginTop: 16,
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});
