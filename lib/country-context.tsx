import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'streamscape_selected_country';

export type CountryCode = 'US' | 'CA';

interface CountryContextValue {
  selectedCountry: CountryCode;
  setSelectedCountry: (country: CountryCode) => void;
}

const CountryContext = createContext<CountryContextValue | null>(null);

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [selectedCountry, setSelectedCountryState] = useState<CountryCode>('US');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'US' || stored === 'CA') {
        setSelectedCountryState(stored);
      }
    });
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
