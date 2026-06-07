import React from 'react';
import { View, StyleSheet } from 'react-native';

interface TrailerPlayerProps {
  videoId: string;
  width: number;
  height: number;
}

const iframe = React.createElement as (
  type: string,
  props: Record<string, unknown>,
) => React.ReactElement;

export function TrailerPlayer({ videoId, width, height }: TrailerPlayerProps) {
  const embedSrc = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;

  return (
    <View
      testID="maestro-trailer-player-frame"
      style={[styles.container, { width, height }]}
    >
      {iframe('iframe', {
        src: embedSrc,
        width,
        height,
        style: { border: 'none', borderRadius: 12, display: 'block' },
        allow:
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        allowFullScreen: true,
        title: 'Movie Trailer',
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    flexGrow: 0,
    flexShrink: 0,
  },
});
