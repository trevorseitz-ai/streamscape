import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface RatingModalProps {
  visible: boolean;
  movieTitle: string;
  onSubmit: (rating: number) => void;
  onSkip: () => void;
}

const STAR_SIZE = 40;
const GOLD = '#f5c518';

export function RatingModal({
  visible,
  movieTitle,
  onSubmit,
  onSkip,
}: RatingModalProps) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [pressedStar, setPressedStar] = useState<number | null>(null);

  const displayFillUpTo = Math.max(
    hoveredStar ?? 0,
    pressedStar ?? 0,
  );

  useEffect(() => {
    if (!visible) {
      setHoveredStar(null);
      setPressedStar(null);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.centered}>
          <View style={styles.card}>
            <Text style={styles.title}>Rate {movieTitle}</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((value) => {
                const filled = value <= displayFillUpTo;
                return (
                  <Pressable
                    key={value}
                    onPress={() => onSubmit(value)}
                    onPressIn={() => setPressedStar(value)}
                    onPressOut={() => setPressedStar(null)}
                    onHoverIn={() => setHoveredStar(value)}
                    onHoverOut={() => setHoveredStar(null)}
                    style={({ pressed }) => [
                      styles.starHit,
                      pressed && styles.starPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate ${value} out of 5`}
                  >
                    <Ionicons
                      name={filled ? 'star' : 'star-outline'}
                      size={STAR_SIZE}
                      color={filled ? GOLD : '#9ca3af'}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={onSkip}
              style={({ pressed }) => [
                styles.skipButton,
                pressed && styles.skipPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Skip rating"
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  centered: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
        }
      : { elevation: 12 }),
  },
  title: {
    color: '#f9fafb',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  starHit: {
    padding: 4,
  },
  starPressed: {
    opacity: 0.85,
  },
  skipButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipPressed: {
    opacity: 0.6,
  },
  skipText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '500',
  },
});
