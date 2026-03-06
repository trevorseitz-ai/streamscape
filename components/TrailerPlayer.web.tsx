import React from 'react';
import { View, StyleSheet } from 'react-native';

interface TrailerPlayerProps {
  videoId: string;
}

const iframe = React.createElement as (
  type: string,
  props: Record<string, unknown>,
) => React.ReactElement;

export function TrailerPlayer({ videoId }: TrailerPlayerProps) {
  return (
    <View style={styles.container}>
      {iframe('iframe', {
        src: `https://www.youtube.com/embed/${videoId}`,
        width: '100%',
        height: 250,
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
