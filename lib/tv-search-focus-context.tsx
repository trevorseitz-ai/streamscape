import React, { createContext, useContext, useMemo, useState } from 'react';

type TvSearchFocusState = {
  /** Native tag for the Home header search control (Android `findNodeHandle`). */
  searchFieldNativeTag: number | null;
  setSearchFieldNativeTag: (tag: number | null) => void;
  /** Native tag for the sidebar Search row (so the search field can move focus back). */
  searchSidebarNativeTag: number | null;
  setSearchSidebarNativeTag: (tag: number | null) => void;
};

const TvSearchFocusContext = createContext<TvSearchFocusState | null>(null);

export function TvSearchFocusProvider({ children }: { children: React.ReactNode }) {
  const [searchFieldNativeTag, setSearchFieldNativeTag] = useState<number | null>(null);
  const [searchSidebarNativeTag, setSearchSidebarNativeTag] = useState<number | null>(null);

  const value = useMemo(
    () => ({
      searchFieldNativeTag,
      setSearchFieldNativeTag,
      searchSidebarNativeTag,
      setSearchSidebarNativeTag,
    }),
    [searchFieldNativeTag, searchSidebarNativeTag]
  );

  return <TvSearchFocusContext.Provider value={value}>{children}</TvSearchFocusContext.Provider>;
}

export function useTvSearchFocusBridge(): TvSearchFocusState {
  const ctx = useContext(TvSearchFocusContext);
  if (!ctx) {
    return {
      searchFieldNativeTag: null,
      setSearchFieldNativeTag: () => {},
      searchSidebarNativeTag: null,
      setSearchSidebarNativeTag: () => {},
    };
  }
  return ctx;
}
