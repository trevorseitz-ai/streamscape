import {
  useRef,
  useEffect,
  useState,
  useLayoutEffect,
  useCallback,
  useMemo,
  type ElementRef,
} from 'react';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Keyboard,
  Pressable,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MovieCard, type Movie } from '../../components/MovieCard';
import { useSearch } from '../../lib/search-context';
import { fetchTmdb } from '../../lib/tmdbFetch';
import { isTvTarget, shouldUseTvDpadFocus } from '../../lib/isTv';
import { useTvNativeTag } from '../../hooks/useTvNativeTag';
import { useTvSearchFocusBridge } from '../../lib/tv-search-focus-context';
import { tvAndroidNavProps } from '../../lib/tvAndroidNavProps';
import { tvFocusable } from '../../lib/tvFocus';

const TMDB_POSTER_W92 = 'https://image.tmdb.org/t/p/w92';
/** TV list-row focus ring — matches Watchlist `rowTvFocused`. */
const TV_ROW_FOCUS_CYAN = '#00F5FF';

interface SuggestionMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date?: string;
}

type TvSearchSuggestionRowProps = {
  suggestion: SuggestionMovie;
  isLast: boolean;
  isFirst: boolean;
  firstRowRef: (node: ElementRef<typeof Pressable> | null) => void;
  sidebarLeftTag: number | null;
  searchFieldTag: number | null;
  onSelect: () => void;
  onContentFocus: () => void;
};

function TvSearchSuggestionRow({
  suggestion,
  isLast,
  isFirst,
  firstRowRef,
  sidebarLeftTag,
  searchFieldTag,
  onSelect,
  onContentFocus,
}: TvSearchSuggestionRowProps) {
  const [focused, setFocused] = useState(false);
  const year =
    suggestion.release_date?.length >= 4 ? suggestion.release_date.slice(0, 4) : '';

  return (
    <Pressable
      ref={isFirst ? (firstRowRef as never) : undefined}
      {...tvFocusable()}
      {...(Platform.OS === 'android'
        ? tvAndroidNavProps({
            nextFocusLeft: sidebarLeftTag,
            nextFocusUp: isFirst ? searchFieldTag : undefined,
          })
        : {})}
      style={[
        styles.suggestionRowTv,
        isLast && styles.suggestionRowTvLast,
        focused && styles.suggestionRowTvFocused,
      ]}
      onPress={onSelect}
      onFocus={() => {
        setFocused(true);
        onContentFocus();
      }}
      onBlur={() => setFocused(false)}
    >
      {suggestion.poster_path ? (
        <Image
          source={{ uri: `${TMDB_POSTER_W92}${suggestion.poster_path}` }}
          style={styles.suggestionThumb}
        />
      ) : (
        <View style={styles.suggestionThumbPlaceholder}>
          <Text style={styles.suggestionThumbInitial}>{suggestion.title.charAt(0)}</Text>
        </View>
      )}
      <View style={styles.suggestionTextCol}>
        <Text style={styles.suggestionTitle} numberOfLines={2}>
          {suggestion.title}
        </Text>
        {year ? <Text style={styles.suggestionYear}>{year}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const isTV = isTvTarget();
  const tvDpadFocus = shouldUseTvDpadFocus();
  const tvNav = tvDpadFocus && Platform.OS === 'android';
  const tvNf =
    tvNav ? ({ focusable: false, collapsable: false } as const) : {};
  const inputRef = useRef<ElementRef<typeof TextInput>>(null);
  const { setRef: setSearchNavRef, nativeTag: searchFieldNavTag } = useTvNativeTag();
  const { setRef: setFirstSuggestionRef, nativeTag: firstSuggestionNavTag } = useTvNativeTag();
  const [searchResultPosterTag, setSearchResultPosterTag] = useState<number | null>(null);
  const {
    setSearchFieldNativeTag,
    setMainContentEntryNativeTag,
    setTvContentHasFocus,
    sidebarSlotNativeTags,
  } = useTvSearchFocusBridge();

  const {
    query,
    setQuery,
    handleSearch,
    searchLoading,
    searchResult,
    searchError,
    setSearchResult,
    setSearchError,
  } = useSearch();

  const [suggestions, setSuggestions] = useState<SuggestionMovie[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const suggestionRequestId = useRef(0);

  const searchSidebarLeftTag = tvNav ? (sidebarSlotNativeTags['search'] ?? null) : null;

  const setInputRefMerged = useCallback(
    (node: ElementRef<typeof TextInput> | null) => {
      inputRef.current = node;
      setSearchNavRef(node);
    },
    [setSearchNavRef]
  );

  useLayoutEffect(() => {
    if (!tvNav || !isFocused) {
      setSearchFieldNativeTag(null);
      return;
    }
    setSearchFieldNativeTag(searchFieldNavTag);
    return () => setSearchFieldNativeTag(null);
  }, [tvNav, isFocused, searchFieldNavTag, setSearchFieldNativeTag]);

  const contentEntryTag = useMemo(() => {
    if (!tvNav) return null;
    if (searchResult != null && searchResultPosterTag != null) {
      return searchResultPosterTag;
    }
    if (suggestions.length > 0 && firstSuggestionNavTag != null) {
      return firstSuggestionNavTag;
    }
    return null;
  }, [
    tvNav,
    searchResult,
    searchResultPosterTag,
    suggestions.length,
    firstSuggestionNavTag,
  ]);

  useLayoutEffect(() => {
    if (!tvNav || !isFocused) {
      setMainContentEntryNativeTag(null);
      return;
    }
    setMainContentEntryNativeTag(contentEntryTag);
    return () => setMainContentEntryNativeTag(null);
  }, [tvNav, isFocused, contentEntryTag, setMainContentEntryNativeTag]);

  useEffect(() => {
    if (searchResult == null) {
      setSearchResultPosterTag(null);
    }
  }, [searchResult]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      suggestionRequestId.current += 1;
      setSuggestions([]);
      setIsTyping(false);
      return;
    }

    const t = setTimeout(async () => {
      const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
      if (!apiKey) {
        setSuggestions([]);
        setIsTyping(false);
        return;
      }

      const id = ++suggestionRequestId.current;
      setIsTyping(true);

      try {
        const res = await fetchTmdb(
          '/search/movie',
          { query: trimmed, language: 'en-US', page: '1' },
          apiKey
        );
        if (!res.ok) {
          if (id === suggestionRequestId.current) setSuggestions([]);
          return;
        }
        const data = (await res.json()) as {
          results?: SuggestionMovie[];
        };
        if (id !== suggestionRequestId.current) return;
        setSuggestions(data.results ?? []);
      } catch {
        if (id === suggestionRequestId.current) setSuggestions([]);
      } finally {
        if (id === suggestionRequestId.current) setIsTyping(false);
      }
    }, 400);

    return () => clearTimeout(t);
  }, [query]);

  const handleMoviePress = (movie: Movie) => {
    Keyboard.dismiss();
    setSearchResult(null);
    setSearchError(null);
    router.push(`/movie/${movie.id}`);
  };

  const handleBack = () => {
    Keyboard.dismiss();
    router.back();
  };

  const openSuggestion = useCallback(
    (suggestionId: number) => {
      Keyboard.dismiss();
      setSearchResult(null);
      setSearchError(null);
      router.push(`/movie/${suggestionId}`);
    },
    [router, setSearchResult, setSearchError]
  );

  const handleSearchResultPosterTag = useCallback((tag: number | null) => {
    setSearchResultPosterTag(tag);
  }, []);

  const showSuggestions = query.trim().length >= 3 && suggestions.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']} {...tvNf}>
      <View style={styles.header} {...tvNf}>
        {!isTV ? (
          <Pressable onPress={handleBack} style={styles.backButton} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </Pressable>
        ) : null}
        <View style={styles.inputWrapper} {...tvNf}>
          {/** Keep a stable instance — remounting (e.g. via `key`) dismisses the keyboard when suggestions update. */}
          <TextInput
            ref={tvNav ? setInputRefMerged : inputRef}
            style={styles.input}
            placeholder="Search movies..."
            placeholderTextColor="#6b7280"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => {
              Keyboard.dismiss();
              handleSearch();
            }}
            returnKeyType="search"
            editable={!searchLoading}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            focusable={tvNav ? true : undefined}
            onFocus={tvNav ? () => setTvContentHasFocus(true) : undefined}
            {...(tvNav
              ? tvAndroidNavProps({
                  nextFocusLeft: searchSidebarLeftTag,
                  nextFocusDown: contentEntryTag,
                })
              : {})}
          />
          {query.length > 0 ? (
            <Pressable
              style={styles.clearButton}
              onPress={() => setQuery('')}
              hitSlop={8}
              {...(isTV ? { focusable: false } : {})}
            >
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {query.trim().length >= 3 && isTyping && suggestions.length === 0 ? (
        <View style={styles.suggestionsLoadingRow}>
          <ActivityIndicator size="small" color="#6366f1" />
        </View>
      ) : null}

      {showSuggestions ? (
        tvNav ? (
          <View style={styles.suggestionsListTv} {...tvNf}>
            {suggestions.slice(0, 5).map((suggestion, index) => {
              const isLast = index === Math.min(suggestions.length, 5) - 1;
              const isFirst = index === 0;
              return (
                <TvSearchSuggestionRow
                  key={suggestion.id}
                  suggestion={suggestion}
                  isLast={isLast}
                  isFirst={isFirst}
                  firstRowRef={setFirstSuggestionRef}
                  sidebarLeftTag={searchSidebarLeftTag}
                  searchFieldTag={searchFieldNavTag}
                  onSelect={() => openSuggestion(suggestion.id)}
                  onContentFocus={() => setTvContentHasFocus(true)}
                />
              );
            })}
          </View>
        ) : (
        <View style={styles.suggestionsDropdown}>
          {suggestions.slice(0, 5).map((suggestion, index) => {
            const isLast = index === Math.min(suggestions.length, 5) - 1;
            return (
              <Pressable
                key={suggestion.id}
                style={({ pressed }) => [
                  styles.suggestionRow,
                  isLast && styles.suggestionRowLast,
                  pressed && styles.suggestionRowPressed,
                ]}
                onPress={() => openSuggestion(suggestion.id)}
              >
                {suggestion.poster_path ? (
                  <Image
                    source={{ uri: `${TMDB_POSTER_W92}${suggestion.poster_path}` }}
                    style={styles.suggestionThumb}
                  />
                ) : (
                  <View style={styles.suggestionThumbPlaceholder}>
                    <Text style={styles.suggestionThumbInitial}>
                      {suggestion.title.charAt(0)}
                    </Text>
                  </View>
                )}
                <View style={styles.suggestionTextCol}>
                  <Text style={styles.suggestionTitle} numberOfLines={2}>
                    {suggestion.title}
                  </Text>
                  {suggestion.release_date?.length >= 4 ? (
                    <Text style={styles.suggestionYear}>
                      {suggestion.release_date.slice(0, 4)}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        )
      ) : null}

      <View style={styles.content} {...tvNf}>
        {searchLoading && (
          <View style={styles.resultBox}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.resultText}>Searching...</Text>
          </View>
        )}
        {searchError && !searchLoading && (
          <View style={styles.resultBox}>
            <Text style={styles.errorText}>{searchError}</Text>
          </View>
        )}
        {searchResult && !searchLoading && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search Result</Text>
            <View style={styles.resultRow}>
              <MovieCard
                movie={searchResult}
                onPress={() => handleMoviePress(searchResult)}
                tvNextFocusLeft={tvNav ? searchSidebarLeftTag : undefined}
                tvNextFocusUp={tvNav ? searchFieldNavTag : undefined}
                onTvPosterNavTag={tvNav ? handleSearchResultPosterTag : undefined}
              />
            </View>
          </View>
        )}
        {!query.trim() && !searchLoading && !searchResult && !searchError && (
          <Text style={styles.hint}>Enter a movie title to search</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f0f0f',
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d2d',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  input: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingRight: 40,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    padding: 4,
  },
  suggestionsLoadingRow: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  suggestionsDropdown: {
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 8,
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  /** Android TV: separate rows (Watchlist-style) instead of grouped dropdown. */
  suggestionsListTv: {
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 2,
  },
  suggestionRowTv: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 80,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  suggestionRowTvLast: {},
  suggestionRowTvFocused: {
    borderColor: TV_ROW_FOCUS_CYAN,
    borderWidth: 2,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#3f3f46',
  },
  suggestionRowLast: {
    borderBottomWidth: 0,
  },
  suggestionRowPressed: {
    backgroundColor: '#3f3f46',
  },
  suggestionThumb: {
    width: 40,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#1f1f1f',
  },
  suggestionThumbPlaceholder: {
    width: 40,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionThumbInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6b7280',
  },
  suggestionTextCol: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  suggestionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  suggestionYear: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  resultBox: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    alignItems: 'center',
  },
  resultText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    width: 120,
  },
  hint: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 40,
  },
});
