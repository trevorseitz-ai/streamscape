import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { isTvTarget } from '../lib/isTv';

/**
 * Stats block sourced from **`watched_history`** for the **Watched** tab header (TV-friendly spacing).
 */
export function WatchedHistoryStatsHeader({ userId }: { userId: string }) {
  const router = useRouter();
  const isTV = isTvTarget();
  const tvNf =
    isTV && Platform.OS === 'android'
      ? ({ focusable: false, collapsable: false } as const)
      : {};
  const labelWeight = isTV ? ('400' as const) : ('500' as const);

  const [rows, setRows] = useState<
    { tmdb_id: number; title: string | null; personal_rating: number | null }[]
  >([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('watched_history')
      .select('tmdb_id, title, personal_rating')
      .eq('user_id', userId);
    if (error) {
      console.warn('watched_history stats:', error.message);
      setRows([]);
      return;
    }
    setRows(data ?? []);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const {
    totalWatched,
    averageRating,
    ratingDistribution,
    favoriteMovie,
  } = useMemo(() => {
    const total = rows.length;
    const nonNull = rows
      .map((r) => r.personal_rating)
      .filter((r): r is number => r != null);
    const average =
      nonNull.length === 0
        ? null
        : Math.round(
            (nonNull.reduce((sum, n) => sum + n, 0) / nonNull.length) * 10
          ) / 10;
    const counts = Array.from({ length: 10 }, () => 0);
    for (const row of rows) {
      const v = row.personal_rating;
      if (v != null && v >= 1 && v <= 10) counts[v - 1] += 1;
    }

    let fav: (typeof rows)[number] | null = null;
    const ratedMovies = rows.filter((m) => m.personal_rating != null);
    if (ratedMovies.length > 0) {
      ratedMovies.sort(
        (a, b) => (b.personal_rating ?? 0) - (a.personal_rating ?? 0)
      );
      fav = ratedMovies[0];
    }

    return {
      totalWatched: total,
      averageRating: average,
      ratingDistribution: counts,
      favoriteMovie: fav,
    };
  }, [rows]);

  return (
    <View style={styles.wrap} {...tvNf}>
      <Text style={[styles.sectionHead, isTV && styles.sectionHeadTv]} numberOfLines={1}>
        Your viewing stats
      </Text>
      <Text style={[styles.sectionHint, isTV && styles.sectionHintTv]}>
        {"From titles you've rated in watched history"}
      </Text>

      <View style={styles.statsRow} {...tvNf}>
        <View style={styles.statCard} {...tvNf}>
          <Text style={[styles.statCardLabel, { fontWeight: labelWeight }]}>
            Movies watched
          </Text>
          <Text style={styles.statCardValue}>{totalWatched}</Text>
        </View>
        <View style={styles.statCard} {...tvNf}>
          <Text style={[styles.statCardLabel, { fontWeight: labelWeight }]}>
            Average rating
          </Text>
          <Text style={styles.statCardValue}>
            {averageRating != null ? averageRating : '—'}
          </Text>
        </View>
      </View>

      {favoriteMovie ? (
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/movie/[id]',
              params: {
                id: String(favoriteMovie.tmdb_id),
                fromWatched: 'true',
              },
            })
          }
          style={({ pressed }) => [
            styles.favoriteMoviePressable,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.statCardLabel, { fontWeight: labelWeight }]}>
            Favorite movie
          </Text>
          <Text style={styles.favoriteMovieText} numberOfLines={2}>
            {favoriteMovie.title?.trim() || 'Untitled'} ⭐️{' '}
            {favoriteMovie.personal_rating}/10
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.chartBlock} {...tvNf}>
        <Text style={[styles.chartLabel, { fontWeight: labelWeight }]}>
          Rating distribution
        </Text>
        <View style={styles.chartRow} {...tvNf}>
          {ratingDistribution.map((count, index) => {
            const rating = index + 1;
            const maxCount = Math.max(...ratingDistribution, 0);
            const barHeight = maxCount === 0 ? 0 : (count / maxCount) * 60;
            return (
              <View key={rating} style={styles.chartColumn} {...tvNf}>
                <View style={styles.chartBarTrack} {...tvNf}>
                  <View style={[styles.chartBarFill, { height: barHeight }]} />
                </View>
                <Text style={styles.chartAxisLabel}>{rating}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 28,
    width: '100%',
    alignSelf: 'stretch',
  },
  sectionHead: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 6,
  },
  sectionHeadTv: {
    fontSize: 22,
    fontWeight: '600',
  },
  sectionHint: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  sectionHintTv: {
    fontWeight: '400',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  statCardLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 8,
  },
  statCardValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#6366f1',
    letterSpacing: -0.5,
  },
  favoriteMoviePressable: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    marginBottom: 20,
  },
  favoriteMovieText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366f1',
    letterSpacing: -0.2,
  },
  chartBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  chartLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
    minHeight: 72,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarTrack: {
    width: '100%',
    height: 60,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  chartBarFill: {
    width: '100%',
    maxWidth: 28,
    backgroundColor: '#6366f1',
    borderRadius: 4,
    minHeight: 0,
  },
  chartAxisLabel: {
    marginTop: 6,
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
});
