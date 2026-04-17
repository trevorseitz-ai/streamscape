import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'reeldive_country';
const LEGACY_STORAGE_KEY = 'streamscape_selected_country';

export type CountryCode = 'US' | 'CA';

interface CountryContextValue {
  selectedCountry: CountryCode;
  setSelectedCountry: (country: CountryCode) => void;
}

const CountryContext = createContext<CountryContextValue | null>(null);

async function loadAndMigrateCountry(): Promise<CountryCode | null> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored === 'US' || stored === 'CA') {
    return stored;
  }

  const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy === 'US' || legacy === 'CA') {
    await AsyncStorage.setItem(STORAGE_KEY, legacy);
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    return legacy;
  }

  return null;
}

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [selectedCountry, setSelectedCountryState] = useState<CountryCode>('US');

  useEffect(() => {
    loadAndMigrateCountry()
      .then((country) => {
        if (country) {
          setSelectedCountryState(country);
        }
      })
      .catch((e) => console.warn('[country-context] load failed', e));
  }, []);

  const setSelectedCountry = (country: CountryCode) => {
    setSelectedCountryState(country);
    AsyncStorage.setItem(STORAGE_KEY, country);
  };

  const value: CountryContextValue = {
    selectedCountry,
    setSelectedCountry,
  };

  return (
    <CountryContext.Provider value={value}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  const ctx = useContext(CountryContext);
  if (!ctx) {
    throw new Error('useCountry must be used within CountryProvider');
  }
  return ctx;
}
