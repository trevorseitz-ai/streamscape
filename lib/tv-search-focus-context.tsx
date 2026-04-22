import React, { createContext, useContext, useMemo, useState } from 'react';

type TvSearchFocusState = {
  /** Native tag for the Home header search control (Android `findNodeHandle`). */
  searchFieldNativeTag: number | null;
  setSearchFieldNativeTag: (tag: number | null) => void;
  /** Native tag for the sidebar Search row (so the search field can move focus back). */
  searchSidebarNativeTag: number | null;
  setSearchSidebarNativeTag: (tag: number | null) => void;
  /**
   * Default Android `nextFocusRight` target from the sidebar into the tab scene
   * (e.g. home hero — first focusable in main content).
   */
  mainContentEntryNativeTag: number | null;
  setMainContentEntryNativeTag: (tag: number | null) => void;
  /** True when TV focus is in main content (hero/posters), not the sidebar rail. */
  tvContentHasFocus: boolean;
  setTvContentHasFocus: (v: boolean) => void;
};

const TvSearchFocusContext = createContext<TvSearchFocusState | null>(null);

export function TvSearchFocusProvider({ children }: { children: React.ReactNode }) {
  const [searchFieldNativeTag, setSearchFieldNativeTag] = useState<number | null>(null);
  const [searchSidebarNativeTag, setSearchSidebarNativeTag] = useState<number | null>(null);
  const [mainContentEntryNativeTag, setMainContentEntryNativeTag] = useState<number | null>(
    null
  );
  const [tvContentHasFocus, setTvContentHasFocus] = useState(false);

  const value = useMemo(
    () => ({
      searchFieldNativeTag,
      setSearchFieldNativeTag,
      searchSidebarNativeTag,
      setSearchSidebarNativeTag,
      mainContentEntryNativeTag,
      setMainContentEntryNativeTag,
      tvContentHasFocus,
      setTvContentHasFocus,
    }),
    [
      searchFieldNativeTag,
      searchSidebarNativeTag,
      mainContentEntryNativeTag,
      tvContentHasFocus,
    ]
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
      mainContentEntryNativeTag: null,
      setMainContentEntryNativeTag: () => {},
      tvContentHasFocus: false,
      setTvContentHasFocus: () => {},
    };
  }
  return ctx;
}
