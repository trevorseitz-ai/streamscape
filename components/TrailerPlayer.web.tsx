import React from 'react';
import { View, StyleSheet } from 'react-native';

interface TrailerPlayerProps {
  videoId: string;
  height?: number;
}

const iframe = React.createElement as (
  type: string,
  props: Record<string, unknown>,
) => React.ReactElement;

export function TrailerPlayer({ videoId, height = 250 }: TrailerPlayerProps) {
  return (
    <View style={[styles.container, height ? { height } : undefined]}>
      {iframe('iframe', {
        src: `https://www.youtube.com/embed/${videoId}`,
        width: '100%',
        height,
        style: { border: 'none', borderRadius: 12 },
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
  },
});
