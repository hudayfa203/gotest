/** Wires the pure sync module (lib/sync.ts) to the API, SQLite and the query cache. */
import { endpoints, getSessionToken } from '../api';
import { isGone } from '../api/client';
import { queryClient } from '../api/queryClient';
import { isLiveCoverageArticle } from '../lib/live';
import { runSync, type SyncResult } from '../lib/sync';
import { kv, KV_KEYS } from '../storage/kv';
import { savedStore } from '../storage/savedDb';
import { refreshLiveSnapshot } from './live';

let running: Promise<SyncResult | null> | null = null;
let lastRun = 0;

export async function syncNow(opts: { minIntervalMs?: number } = {}): Promise<SyncResult | null> {
  const min = opts.minIntervalMs ?? 0;
  if (running) return running;
  if (Date.now() - lastRun < min) return null;
  running = (async () => {
    try {
      const result = await runSync({
        fetchChanges: (cursor) => endpoints.sync(cursor),
        getCursor: () => kv.getString(KV_KEYS.syncCursor),
        setCursor: (c) => kv.setString(KV_KEYS.syncCursor, c),
        savedRevisions: () => savedStore.revisions(),
        refetchArticle: async (id) => {
          try {
            return { kind: 'article', article: await endpoints.article(id) };
          } catch (e) {
            if (isGone(e)) return { kind: 'gone', tombstone: e.tombstone };
            throw e;
          }
        },
        replaceSaved: async (a) => {
          await savedStore.update(a);
          // a new revision of live coverage (e.g. it ended) → bring the saved updates up to date too
          if (isLiveCoverageArticle(a)) await refreshLiveSnapshot(a.id);
        },
        deleteSaved: async (id) => {
          await savedStore.remove(id);
        },
        onUpdated: (a) => {
          queryClient.setQueryData(['article', a.id], a);
        },
        onWithdrawn: async (id) => {
          queryClient.removeQueries({ queryKey: ['article', id] });
          if (await getSessionToken()) await endpoints.removeBookmark(id).catch(() => {});
        },
      });
      lastRun = Date.now();
      await kv.set(KV_KEYS.lastSyncAt, new Date().toISOString());
      if (result.removed.length || result.refreshed.length) {
        void queryClient.invalidateQueries({ queryKey: ['saved'] });
      }
      return result;
    } catch {
      return null; // offline — next foreground retries
    } finally {
      running = null;
    }
  })();
  return running;
}
