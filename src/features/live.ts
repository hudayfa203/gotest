/**
 * Live coverage data layer: GET /live/{id} through React Query, refreshed incrementally with
 * `?since=<serverTime>` and merged by the pure reducer in lib/live.ts.
 *
 * The feed is kept in the query cache (persisted → the last fetched updates are readable offline after a
 * restart) and, for SAVED coverage, also in SQLite next to the saved article (savedStore.putLive).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { endpoints } from '../api';
import { queryClient } from '../api/queryClient';
import { LIVE_POLL_MS, liveFeedReducer, type LiveFeedState } from '../lib/live';
import { savedStore } from '../storage/savedDb';

export const liveFeedKey = (id: string) => ['live', 'feed', id] as const;
export const LIVE_HUB_KEY = ['live', 'hub'] as const;
export const LIVE_ARCHIVE_KEY = ['live', 'archive'] as const;

/** One fetch: full when nothing is known yet, otherwise only what changed since `prev.serverTime`, merged into `prev`. */
export async function fetchLiveFeed(id: string, prev: LiveFeedState | null | undefined, signal?: AbortSignal): Promise<LiveFeedState> {
  if (prev?.serverTime && prev.coverage?.id === id) {
    const delta = await endpoints.liveFeed(id, prev.serverTime, signal);
    return liveFeedReducer(prev, { type: 'delta', feed: delta, now: Date.now() })!;
  }
  const full = await endpoints.liveFeed(id, null, signal);
  return liveFeedReducer(null, { type: 'full', feed: full, now: Date.now() })!;
}

/**
 * Bring the offline snapshot of a saved live coverage up to date (after saving, after /sync refreshed the article,
 * after a bookmark download). Best effort: failures leave the previous snapshot in place.
 */
export async function refreshLiveSnapshot(id: string): Promise<boolean> {
  try {
    const prev = queryClient.getQueryData<LiveFeedState>(liveFeedKey(id)) ?? (await savedStore.get(id))?.live ?? null;
    const next = await fetchLiveFeed(id, prev);
    queryClient.setQueryData(liveFeedKey(id), next);
    return await savedStore.putLive(id, next);
  } catch {
    return false;
  }
}

/**
 * The feed for one coverage. Polls every LIVE_POLL_MS while `poll` is true (screen focused) and the coverage is
 * live; React Query pauses the interval while the app is in the background (focusManager ← AppState) and refetches
 * when it returns to the foreground.
 */
export function useLiveFeed(id: string, opts: { enabled: boolean; poll: boolean; saved?: boolean; fallback?: LiveFeedState | null }) {
  const qc = useQueryClient();
  const fallbackRef = useRef(opts.fallback);
  fallbackRef.current = opts.fallback;

  const q = useQuery({
    queryKey: liveFeedKey(id),
    enabled: opts.enabled,
    queryFn: ({ signal }) => fetchLiveFeed(id, qc.getQueryData<LiveFeedState>(liveFeedKey(id)) ?? fallbackRef.current ?? null, signal),
    staleTime: 10_000,
    refetchInterval: (query) => (opts.poll && query.state.data?.coverage.state === 'live' ? LIVE_POLL_MS : false),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const data: LiveFeedState | null = q.data ?? opts.fallback ?? null;

  // keep the saved (offline) copy's updates current — only when something visible changed
  const stored = useRef<{ updates: unknown; coverage: unknown; related: unknown } | null>(null);
  useEffect(() => {
    if (!opts.saved || !q.data) return;
    const s = stored.current;
    if (s && s.updates === q.data.updates && s.coverage === q.data.coverage && s.related === q.data.relatedArticles) return;
    stored.current = { updates: q.data.updates, coverage: q.data.coverage, related: q.data.relatedArticles };
    void savedStore.putLive(id, q.data).catch(() => {});
  }, [id, opts.saved, q.data]);

  const markSeen = useCallback(() => {
    qc.setQueryData<LiveFeedState>(liveFeedKey(id), (s) => (s && s.unseenIds.length ? (liveFeedReducer(s, { type: 'seen' }) ?? s) : s));
  }, [id, qc]);

  return { query: q, data, fromSnapshot: !q.data && !!opts.fallback, markSeen };
}
