/**
 * TanStack Query setup: offline-aware (NetInfo → onlineManager), refetch on app foreground
 * (AppState → focusManager), and the query cache persisted to AsyncStorage so the last home feed,
 * lists, opened articles and live coverage feeds are readable offline after a restart.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { AppState, Platform } from 'react-native';
import { APP_VERSION, getApiUrl, isDemoMode } from '../config';
import { subscribeNetwork } from '../lib/network';
import { isGone, isNetworkError, ApiError } from './client';

onlineManager.setEventListener((setOnline) => subscribeNetwork(setOnline));

focusManager.setEventListener((handleFocus) => {
  if (Platform.OS === 'web') return undefined;
  const sub = AppState.addEventListener('change', (s) => handleFocus(s === 'active'));
  return () => sub.remove();
});

const DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 7 * DAY, // ≥ persister maxAge so restored queries are not collected early
      retry: (count, err) => {
        if (isGone(err)) return false;
        if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429) return false;
        return count < 2 && !isNetworkError(err);
      },
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'offlineFirst' },
  },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'gw.query-cache.v1', throttleTime: 2000 });

/** Persist only successful, explicitly cacheable content queries (never reader/device data). */
const PERSISTED_ROOTS = new Set(['home', 'latest', 'article', 'config', 'navigation', 'categories', 'section', 'videos', 'podcasts', 'live']);

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: 7 * DAY,
  // a cache restored after a restart must come from the same app version *and* the same source (test builds can switch)
  get buster() {
    return `${APP_VERSION}|${isDemoMode() ? 'demo' : getApiUrl()}`;
  },
  dehydrateOptions: {
    shouldDehydrateQuery: (q) => q.state.status === 'success' && PERSISTED_ROOTS.has(String(q.queryKey[0])),
  },
};

/** Drop every cached query, in memory and on disk (used when a test build switches servers). */
export async function clearAllCachedContent() {
  await queryClient.cancelQueries();
  queryClient.clear();
  await persister.removeClient();
}
