import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';

export interface RatingModalProps {
  visible: boolean;
  movieTitle: string;
  onSubmit: (rating: number) => void;
  onSkip: () => void;
}

const BUTTON_SIZE = 44;
const GRID_GAP = 10;
/** Five buttons per row: 5×44 + 4×10 */
const GRID_WIDTH = 5 * BUTTON_SIZE + 4 * GRID_GAP;

const ACCENT = '#6366f1';

export function RatingModal({
  visible,
  movieTitle,
  onSubmit,
  onSkip,
}: RatingModalProps) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) {
      setSelectedRating(null);
    }
  }, [visible]);

  const handleSubmitRating = () => {
    if (selectedRating == null) return;
    onSubmit(selectedRating);
  };

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

            <View style={styles.grid}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => {
                const selected = selectedRating === value;
                return (
                  <TouchableOpacity
                    key={value}
                    activeOpacity={0.85}
                    onPress={() => setSelectedRating(value)}
                    style={[
                      styles.numberButton,
                      selected ? styles.numberButtonSelected : styles.numberButtonIdle,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select rating ${value} out of 10`}
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.numberText,
                        selected ? styles.numberTextSelected : styles.numberTextIdle,
                      ]}
                    >
                      {value}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={handleSubmitRating}
              disabled={selectedRating == null}
              activeOpacity={0.9}
              style={[
                styles.submitButton,
                selectedRating == null && styles.submitButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Submit rating"
              accessibilityState={{ disabled: selectedRating == null }}
            >
              <Text style={styles.submitButtonText}>Submit Rating</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onSkip}
              activeOpacity={0.7}
              style={styles.skipButton}
              accessibilityRole="button"
              accessibilityLabel="Skip rating"
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
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
  grid: {
    width: GRID_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: GRID_GAP,
    marginBottom: 20,
  },
  numberButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberButtonIdle: {
    backgroundColor: '#2d2d2d',
  },
  numberButtonSelected: {
    backgroundColor: ACCENT,
  },
  numberText: {
    fontSize: 17,
    fontWeight: '600',
  },
  numberTextIdle: {
    color: '#9ca3af',
  },
  numberTextSelected: {
    color: '#ffffff',
  },
  submitButton: {
    alignSelf: 'stretch',
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.35,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '500',
  },
});
