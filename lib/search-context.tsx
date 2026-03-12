import React, { createContext, useContext, useState, useCallback } from 'react';
import { Keyboard } from 'react-native';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

export interface Movie {
  id: string;
  title: string;
  poster_url: string | null;
  release_year?: number | null;
  vote_average?: number | null;
}

interface SearchContextValue {
  isSearching: boolean;
  setIsSearching: (v: boolean) => void;
  query: string;
  setQuery: (v: string) => void;
  searchResult: Movie | null;
  setSearchResult: (v: Movie | null) => void;
  searchError: string | null;
  setSearchError: (v: string | null) => void;
  searchLoading: boolean;
  handleSearch: () => Promise<void>;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<Movie | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || searchLoading) return;

    Keyboard.dismiss();
    setSearchLoading(true);
    setSearchResult(null);
    setSearchError(null);

    const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
    if (!apiKey) {
      setSearchError('TMDB API key not configured');
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const searchUrl = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(trimmed)}&language=en-US`;

      const res = await fetch(searchUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const responseText = await res.text();

      let data: { results?: Array<{ id: number; title: string; poster_path: string | null; release_date?: string; vote_average?: number }> };
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        setSearchError(res.ok ? 'Invalid response from server' : `Request failed (${res.status})`);
        return;
      }

      if (!res.ok) {
        const errData = (data as Record<string, unknown>)?.status_message ?? (data as Record<string, unknown>)?.error;
        setSearchError(typeof errData === 'string' ? errData : `Request failed (${res.status})`);
        return;
      }

      const movie = data.results?.[0];
      if (!movie) {
        setSearchError('No results found');
        return;
      }

      const releaseYear = movie.release_date
        ? parseInt(movie.release_date.slice(0, 4), 10)
        : null;

      setSearchResult({
        id: String(movie.id),
        title: movie.title,
        poster_url: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
        release_year: releaseYear,
        vote_average: movie.vote_average ?? null,
      });
    } catch (err) {
      if (err instanceof Error) {
        setSearchError(err.name === 'AbortError' ? 'Request timed out. Try again.' : err.message);
      } else {
        setSearchError('Request failed');
      }
    } finally {
      clearTimeout(timeoutId);
      setSearchLoading(false);
    }
  }, [query, searchLoading]);

  const value: SearchContextValue = {
    isSearching,
    setIsSearching,
    query,
    setQuery,
    searchResult,
    setSearchResult,
    searchError,
    setSearchError,
    searchLoading,
    handleSearch,
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return ctx;
}
