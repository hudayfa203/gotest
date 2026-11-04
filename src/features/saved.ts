/**
 * Saved articles: on-device for everyone (SQLite, full body → readable offline),
 * mirrored to the reader's server bookmarks when signed in (GET/PUT/DELETE /me/bookmarks).
 */
import { endpoints, getSessionToken } from '../api';
import { isGone, isNetworkError } from '../api/client';
import { isLiveCoverageArticle } from '../lib/live';
import { planBookmarkMerge } from '../lib/sync';
import { kv, KV_KEYS } from '../storage/kv';
import { savedStore } from '../storage/savedDb';
import type { Article } from '../types';
import { refreshLiveSnapshot } from './live';

type Pending = { add: string[]; remove: string[] };

async function pending(): Promise<Pending> {
  return kv.get<Pending>(KV_KEYS.pendingBookmarkOps, { add: [], remove: [] });
}
async function setPending(p: Pending) {
  await kv.set(KV_KEYS.pendingBookmarkOps, { add: Array.from(new Set(p.add)), remove: Array.from(new Set(p.remove)) });
}

export async function isSaved(id: string) {
  return !!(await savedStore.get(id));
}

export async function saveArticle(article: Article) {
  await savedStore.put(article);
  // live coverage: keep the updates as fetched now, so the saved copy shows them offline
  if (isLiveCoverageArticle(article)) void refreshLiveSnapshot(article.id);
  if (await getSessionToken()) {
    try {
      await endpoints.addBookmark(article.id);
    } catch {
      const p = await pending();
      await setPending({ add: [...p.add, article.id], remove: p.remove.filter((x) => x !== article.id) });
    }
  }
}

export async function unsaveArticle(id: string, opts: { remote?: boolean } = {}) {
  await savedStore.remove(id);
  if (opts.remote !== false && (await getSessionToken())) {
    try {
      await endpoints.removeBookmark(id);
    } catch {
      const p = await pending();
      await setPending({ add: p.add.filter((x) => x !== id), remove: [...p.remove, id] });
    }
  }
}

/**
 * Two-way merge for signed-in readers (run after sign-in and on launch):
 * server-only bookmarks are downloaded (full article stored offline), device-only saves are uploaded,
 * and deletions made while offline are replayed.
 */
export async function mergeBookmarks(): Promise<{ downloaded: number; uploaded: number } | null> {
  if (!(await getSessionToken())) return null;
  const server = await endpoints.bookmarks();
  const local = await savedStore.revisions();
  const p = await pending();
  const plan = planBookmarkMerge(local.map((l) => l.id), server.map((b) => b.article.id), p.remove);
  let downloaded = 0;
  let uploaded = 0;
  for (const id of plan.deleteRemote) {
    await endpoints.removeBookmark(id).catch(() => {});
  }
  for (const id of plan.download) {
    try {
      const article = await endpoints.article(id);
      const savedAt = server.find((b) => b.article.id === id)?.savedAt;
      await savedStore.put(article, savedAt);
      if (isLiveCoverageArticle(article)) await refreshLiveSnapshot(article.id);
      downloaded++;
    } catch (e) {
      if (isGone(e)) await endpoints.removeBookmark(id).catch(() => {});
      else if (isNetworkError(e)) break;
    }
  }
  for (const id of Array.from(new Set([...plan.upload, ...p.add]))) {
    try {
      await endpoints.addBookmark(id);
      uploaded++;
    } catch {
      /* retried next merge */
    }
  }
  await setPending({ add: [], remove: [] });
  return { downloaded, uploaded };
}
