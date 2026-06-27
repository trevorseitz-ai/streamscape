import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tvFocusable, tvPreferredFocusProps } from '../lib/tvFocus';

const STAR_ON = '#f5c518';
const STAR_OFF = '#4b5563';
export const RATING_MAX = 5;

/** Read-only row of stars for showing an existing rating. */
export function StarDisplay({
  value,
  max = RATING_MAX,
  size = 14,
}: {
  value: number | null;
  max?: number;
  size?: number;
}) {
  const v = value ?? 0;
  return (
    <View style={styles.displayRow} pointerEvents="none">
      {Array.from({ length: max }, (_, i) => (
        <Ionicons
          key={i}
          name={i < v ? 'star' : 'star-outline'}
          size={size}
          color={i < v ? STAR_ON : STAR_OFF}
          style={styles.displayStar}
        />
      ))}
    </View>
  );
}

/**
 * Modal star picker used for both Web (click / hover preview) and Android TV
 * (D-pad: Left/Right move across the focusable stars, Select chooses). Kept as a
 * modal so the list rows don't need nested interactive focus targets.
 */
export function RatingPickerModal({
  visible,
  value,
  title,
  max = RATING_MAX,
  onSelect,
  onClear,
  onClose,
}: {
  visible: boolean;
  value: number | null;
  title: string;
  max?: number;
  onSelect: (n: number) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const [focusedStar, setFocusedStar] = useState<number | null>(null);
  const [focusedAction, setFocusedAction] = useState<'clear' | 'cancel' | null>(
    null
  );
  const shown = preview ?? value ?? 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner press swallow so taps on the card don't dismiss. */}
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.cardSub}>Rate this title</Text>

          <View style={styles.starsRow}>
            {Array.from({ length: max }, (_, i) => {
              const n = i + 1;
              const filled = n <= shown;
              const preferred = (value ?? 1) === n;
              return (
                <Pressable
                  key={n}
                  {...(preferred ? tvPreferredFocusProps() : tvFocusable())}
                  onHoverIn={
                    Platform.OS === 'web' ? () => setPreview(n) : undefined
                  }
                  onHoverOut={
                    Platform.OS === 'web' ? () => setPreview(null) : undefined
                  }
                  onFocus={() => {
                    setPreview(n);
                    setFocusedStar(n);
                  }}
                  onBlur={() => {
                    setPreview((p) => (p === n ? null : p));
                    setFocusedStar((f) => (f === n ? null : f));
                  }}
                  onPress={() => onSelect(n)}
                  accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
                  style={({ pressed }) => [
                    styles.starBtn,
                    focusedStar === n && styles.starBtnFocused,
                    pressed && styles.starBtnPressed,
                  ]}
                >
                  <Ionicons
                    name={filled ? 'star' : 'star-outline'}
                    size={40}
                    color={filled ? STAR_ON : STAR_OFF}
                  />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              {...tvFocusable()}
              onPress={onClear}
              onFocus={() => setFocusedAction('clear')}
              onBlur={() => setFocusedAction((a) => (a === 'clear' ? null : a))}
              style={({ pressed }) => [
                styles.actionBtn,
                focusedAction === 'clear' && styles.actionBtnFocused,
                pressed && styles.actionBtnPressed,
              ]}
            >
              <Text style={styles.actionText}>Clear</Text>
            </Pressable>
            <Pressable
              {...tvFocusable()}
              onPress={onClose}
              onFocus={() => setFocusedAction('cancel')}
              onBlur={() => setFocusedAction((a) => (a === 'cancel' ? null : a))}
              style={({ pressed }) => [
                styles.actionBtn,
                focusedAction === 'cancel' && styles.actionBtnFocused,
                pressed && styles.actionBtnPressed,
              ]}
            >
              <Text style={styles.actionText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayStar: {
    marginRight: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    padding: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  cardSub: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  starBtn: {
    padding: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  starBtnFocused: {
    borderColor: '#00F5FF',
  },
  starBtnPressed: {
    opacity: 0.7,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3f3f46',
    backgroundColor: '#26262b',
  },
  actionBtnFocused: {
    borderColor: '#00F5FF',
  },
  actionBtnPressed: {
    opacity: 0.7,
  },
  actionText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
  },
});
