import React, { createContext, useContext, useState } from 'react';

interface MovieContextValue {
  title: string | null;
  setTitle: (title: string | null) => void;
}

const MovieContext = createContext<MovieContextValue | null>(null);

export function MovieProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return (
    <MovieContext.Provider value={{ title, setTitle }}>
      {children}
    </MovieContext.Provider>
  );
}

export function useMovie() {
  const ctx = useContext(MovieContext);
  if (!ctx) {
    throw new Error('useMovie must be used within MovieProvider');
  }
  return ctx;
}
