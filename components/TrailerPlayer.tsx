import { View, StyleSheet } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';

interface TrailerPlayerProps {
  videoId: string;
}

export function TrailerPlayer({ videoId }: TrailerPlayerProps) {
  return (
    <View style={styles.container}>
      <YoutubePlayer height={250} videoId={videoId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
});
