import {
  useRef,
  useEffect,
  useState,
  useLayoutEffect,
  useCallback,
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MovieCard, type Movie } from '../../components/MovieCard';
import { useSearch } from '../../lib/search-context';
import { fetchTmdb } from '../../lib/tmdbFetch';
import { isTvTarget } from '../../lib/isTv';
import { useTvNativeTag } from '../../hooks/useTvNativeTag';
import { useTvSearchFocusBridge } from '../../lib/tv-search-focus-context';

const TMDB_POSTER_W92 = 'https://image.tmdb.org/t/p/w92';

interface SuggestionMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date?: string;
}

export default function SearchScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const isTV = isTvTarget();
  const inputRef = useRef<ElementRef<typeof TextInput>>(null);
  const { setRef: setSearchNavRef, nativeTag: searchFieldNavTag } = useTvNativeTag();
  const { setSearchFieldNativeTag, setTvContentHasFocus } = useTvSearchFocusBridge();

  const setInputRefMerged = useCallback(
    (node: ElementRef<typeof TextInput> | null) => {
      inputRef.current = node;
      setSearchNavRef(node);
    },
    [setSearchNavRef]
  );

  useLayoutEffect(() => {
    if (!isTV || !isFocused) {
      setSearchFieldNativeTag(null);
      return;
    }
    setSearchFieldNativeTag(searchFieldNavTag);
    return () => setSearchFieldNativeTag(null);
  }, [isTV, isFocused, searchFieldNavTag, setSearchFieldNativeTag]);
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={isTV ? setInputRefMerged : inputRef}
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
            onFocus={isTV ? () => setTvContentHasFocus(true) : undefined}
          />
          {query.length > 0 ? (
            <Pressable style={styles.clearButton} onPress={() => setQuery('')} hitSlop={8}>
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

      {query.trim().length >= 3 && suggestions.length > 0 && (
        <View style={styles.suggestionsDropdown}>
          {suggestions.slice(0, 5).map((suggestion, index) => {
            const year =
              suggestion.release_date?.length >= 4
                ? suggestion.release_date.slice(0, 4)
                : '';
            const isLast = index === Math.min(suggestions.length, 5) - 1;
            return (
              <Pressable
                key={suggestion.id}
                style={({ pressed }) => [
                  styles.suggestionRow,
                  isLast && styles.suggestionRowLast,
                  pressed && styles.suggestionRowPressed,
                ]}
                onPress={() => {
                  Keyboard.dismiss();
                  setSearchResult(null);
                  setSearchError(null);
                  router.push(`/movie/${suggestion.id}`);
                }}
              >
                {suggestion.poster_path ? (
                  <Image
                    source={{
                      uri: `${TMDB_POSTER_W92}${suggestion.poster_path}`,
                    }}
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
                  {year ? (
                    <Text style={styles.suggestionYear}>{year}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.content}>
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
              <MovieCard movie={searchResult} onPress={() => handleMoviePress(searchResult)} />
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
