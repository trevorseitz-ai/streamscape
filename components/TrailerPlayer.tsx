import { View, StyleSheet } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';

interface TrailerPlayerProps {
  videoId: string;
  height?: number;
}

export function TrailerPlayer({ videoId, height = 250 }: TrailerPlayerProps) {
  return (
    <View style={[styles.container, height ? { height } : undefined]}>
      <YoutubePlayer height={height} videoId={videoId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
});
