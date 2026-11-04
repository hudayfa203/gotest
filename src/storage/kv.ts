/** Small, non-secret preferences and app state (AsyncStorage; localStorage on web). */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const KV_KEYS = {
  settings: 'gw.settings.v1',
  syncCursor: 'gw.sync.cursor',
  lastSyncAt: 'gw.sync.lastAt',
  recentSearches: 'gw.search.recent',
  pendingBookmarkOps: 'gw.bookmarks.pending',
  handledPushIds: 'gw.push.handled',
  notificationPrefsCache: 'gw.notifications.cache',
} as const;

export const kv = {
  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  async set(key: string, value: unknown) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string) {
    await AsyncStorage.removeItem(key);
  },
  async getString(key: string) {
    return AsyncStorage.getItem(key);
  },
  async setString(key: string, value: string) {
    await AsyncStorage.setItem(key, value);
  },
};
