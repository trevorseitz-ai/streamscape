'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { supabase } from './supabase';

interface WatchlistStatusContextValue {
  watchlistTmdbIds: Set<number>;
  watchedTmdbIds: Set<number>;
  session: { user: { id: string } } | null;
  toggleWatchlist: (
    tmdbId: number,
    title: string,
    posterUrl: string | null
  ) => Promise<void>;
  toggleWatched: (
    tmdbId: number,
    title: string,
    posterUrl: string | null
  ) => Promise<void>;
  refetch: () => Promise<void>;
}

const WatchlistStatusContext = createContext<WatchlistStatusContextValue | null>(
  null
);

export function WatchlistStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<{
    user: { id: string };
  } | null>(null);
  const [watchlistTmdbIds, setWatchlistTmdbIds] = useState<Set<number>>(
    new Set()
  );
  const [watchedTmdbIds, setWatchedTmdbIds] = useState<Set<number>>(new Set());

  const fetchStatus = useCallback(async (userId: string) => {
    const [watchlistRes, watchedRes] = await Promise.all([
      supabase
        .from('watchlist')
        .select('media_id, media(tmdb_id)')
        .eq('user_id', userId)
        .eq('watched', false),
      supabase
        .from('watched_history')
        .select('tmdb_id')
        .eq('user_id', userId),
    ]);

    const watchlistIds = new Set<number>();
    if (watchlistRes.data) {
      for (const row of watchlistRes.data) {
        const raw = row.media;
        const media = Array.isArray(raw)
          ? (raw[0] as { tmdb_id: number | null } | undefined)
          : (raw as { tmdb_id: number | null } | null);
        if (media?.tmdb_id != null) {
          watchlistIds.add(media.tmdb_id);
        }
      }
    }

    const watchedIds = new Set<number>();
    if (watchedRes.data) {
      for (const row of watchedRes.data) {
        watchedIds.add(row.tmdb_id);
      }
    }

    setWatchlistTmdbIds(watchlistIds);
    setWatchedTmdbIds(watchedIds);
  }, []);

  const refetch = useCallback(async () => {
    if (session) await fetchStatus(session.user.id);
  }, [session, fetchStatus]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) fetchStatus(s.user.id);
      else {
        setWatchlistTmdbIds(new Set());
        setWatchedTmdbIds(new Set());
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) fetchStatus(s.user.id);
      else {
        setWatchlistTmdbIds(new Set());
        setWatchedTmdbIds(new Set());
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchStatus]);

  const toggleWatchlist = useCallback(
    async (tmdbId: number, title: string, posterUrl: string | null) => {
      if (!session) return;

      const nextIn = !watchlistTmdbIds.has(tmdbId);
      setWatchlistTmdbIds((prev) => {
        const next = new Set(prev);
        if (nextIn) next.add(tmdbId);
        else next.delete(tmdbId);
        return next;
      });

      try {
        const { data: media } = await supabase
          .from('media')
          .select('id')
          .eq('tmdb_id', tmdbId)
          .maybeSingle();

        let mediaId: string | null = media?.id ?? null;

        if (nextIn) {
          if (!mediaId) {
            const { data: inserted, error } = await supabase
              .from('media')
              .insert({
                tmdb_id: tmdbId,
                type: 'movie',
                title,
                poster_url: posterUrl,
                release_year: null,
              })
              .select('id')
              .single();

            if (error) {
              if (error.code === '23505') {
                const { data: existing } = await supabase
                  .from('media')
                  .select('id')
                  .eq('tmdb_id', tmdbId)
                  .maybeSingle();
                mediaId = existing?.id ?? null;
              } else throw error;
            } else {
              mediaId = inserted?.id ?? null;
            }
          }

          if (mediaId) {
            const { count } = await supabase
              .from('watchlist')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', session.user.id);
            const { error } = await supabase.from('watchlist').insert({
              user_id: session.user.id,
              media_id: mediaId,
              watched: false,
              sort_order: count ?? 0,
              order_index: count ?? 0,
            });
            if (error) throw error;
          }
        } else {
          if (!mediaId) return;
          const { error } = await supabase
            .from('watchlist')
            .delete()
            .eq('user_id', session.user.id)
            .eq('media_id', mediaId);
          if (error) throw error;
        }
      } catch (err) {
        console.error('Watchlist toggle error:', err);
        setWatchlistTmdbIds((prev) => {
          const next = new Set(prev);
          if (nextIn) next.delete(tmdbId);
          else next.add(tmdbId);
          return next;
        });
      }
    },
    [session, watchlistTmdbIds]
  );

  const toggleWatched = useCallback(
    async (tmdbId: number, title: string, posterUrl: string | null) => {
      if (!session) return;

      const nextWatched = !watchedTmdbIds.has(tmdbId);
      setWatchedTmdbIds((prev) => {
        const next = new Set(prev);
        if (nextWatched) next.add(tmdbId);
        else next.delete(tmdbId);
        return next;
      });

      try {
        if (nextWatched) {
          const { error } = await supabase.from('watched_history').insert({
            user_id: session.user.id,
            tmdb_id: tmdbId,
            title,
            poster_url: posterUrl,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('watched_history')
            .delete()
            .eq('user_id', session.user.id)
            .eq('tmdb_id', tmdbId);
          if (error) throw error;
        }
      } catch (err) {
        console.error('Watched toggle error:', err);
        setWatchedTmdbIds((prev) => {
          const next = new Set(prev);
          if (nextWatched) next.delete(tmdbId);
          else next.add(tmdbId);
          return next;
        });
      }
    },
    [session, watchedTmdbIds]
  );

  const value = useMemo(
    () => ({
      watchlistTmdbIds,
      watchedTmdbIds,
      session,
      toggleWatchlist,
      toggleWatched,
      refetch,
    }),
    [
      watchlistTmdbIds,
      watchedTmdbIds,
      session,
      toggleWatchlist,
      toggleWatched,
      refetch,
    ]
  );

  return (
    <WatchlistStatusContext.Provider value={value}>
      {children}
    </WatchlistStatusContext.Provider>
  );
}

export function useWatchlistStatus() {
  const ctx = useContext(WatchlistStatusContext);
  return ctx;
}
