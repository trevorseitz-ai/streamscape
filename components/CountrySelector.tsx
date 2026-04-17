import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useCountry } from '../lib/country-context';
import { tvFocusable } from '../lib/tvFocus';

export function CountrySelector() {
  const { selectedCountry, setSelectedCountry } = useCountry();

  return (
    <View style={styles.container}>
      <Pressable
        {...tvFocusable()}
        style={[
          styles.button,
          selectedCountry === 'US' && styles.buttonActive,
        ]}
        onPress={() => setSelectedCountry('US')}
      >
        <Text style={[
          styles.buttonText,
          selectedCountry === 'US' && styles.buttonTextActive,
        ]}>
          US
        </Text>
      </Pressable>
      <Pressable
        {...tvFocusable()}
        style={[
          styles.button,
          selectedCountry === 'CA' && styles.buttonActive,
        ]}
        onPress={() => setSelectedCountry('CA')}
      >
        <Text style={[
          styles.buttonText,
          selectedCountry === 'CA' && styles.buttonTextActive,
        ]}>
          CA
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 12,
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#2d2d2d',
    borderWidth: 1,
    borderColor: '#3d3d3d',
  },
  buttonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  buttonTextActive: {
    color: '#ffffff',
  },
});
