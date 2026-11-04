/**
 * Explicit offline sync (docs/API.md "Sync for the apps") — pure and unit-tested.
 *
 *   GET /sync?cursor=<stored>  → { cursor, updated[{id, revision}], withdrawn[Tombstone], hasMore }
 *   - updated id that is saved offline with an OLDER revision → refetch /articles/{id} and replace the copy
 *     (a 410 on refetch means it was withdrawn in the meantime → delete)
 *   - withdrawn id → delete the offline copy (and the server bookmark when signed in)
 *   - store the returned cursor only after the page was fully applied, so a failure is retried next time
 *
 * Pushes and caches are not guaranteed, so the app runs this on launch and every time it returns to the foreground.
 */
import type { Article, SyncChanges, Tombstone } from '../types';

export type RefetchResult = { kind: 'article'; article: Article } | { kind: 'gone'; tombstone: Tombstone | null };

export interface SyncDeps {
  fetchChanges(cursor: string): Promise<SyncChanges>;
  getCursor(): Promise<string | null>;
  setCursor(cursor: string): Promise<void>;
  /** id → revision of every offline (saved) copy */
  savedRevisions(): Promise<{ id: string; revision: number }[]>;
  refetchArticle(id: string): Promise<RefetchResult>;
  replaceSaved(article: Article): Promise<void>;
  deleteSaved(id: string): Promise<void>;
  /** optional side effects for withdrawn content (e.g. DELETE /me/bookmarks/{id}, cache eviction) */
  onWithdrawn?(id: string, tombstone: Tombstone | null): Promise<void> | void;
  onUpdated?(article: Article): Promise<void> | void;
}

export interface SyncResult {
  cursor: string;
  pages: number;
  refreshed: string[];
  removed: string[];
  failed: string[];
  /** true when all pages were applied (hasMore=false reached) */
  complete: boolean;
}

export const INITIAL_CURSOR = '0';

/** Which saved ids need refetching: saved locally AND the server revision is newer. Pure. */
export function staleSavedIds(updated: SyncChanges['updated'], saved: { id: string; revision: number }[]): string[] {
  const local = new Map(saved.map((s) => [s.id, s.revision]));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of updated) {
    const rev = local.get(u.id);
    if (rev !== undefined && u.revision > rev && !seen.has(u.id)) {
      out.push(u.id);
      seen.add(u.id);
    }
  }
  return out;
}

export async function runSync(deps: SyncDeps, opts: { maxPages?: number } = {}): Promise<SyncResult> {
  const maxPages = opts.maxPages ?? 20;
  let cursor = (await deps.getCursor()) || INITIAL_CURSOR;
  const result: SyncResult = { cursor, pages: 0, refreshed: [], removed: [], failed: [], complete: false };

  for (let page = 0; page < maxPages; page++) {
    const changes = await deps.fetchChanges(cursor);
    result.pages++;
    const saved = await deps.savedRevisions();
    const savedIds = new Set(saved.map((s) => s.id));
    let pageOk = true;

    // 1) withdrawals first: content that must disappear wins over any update in the same page
    const withdrawnIds = new Set<string>();
    for (const t of changes.withdrawn) {
      withdrawnIds.add(t.id);
      if (savedIds.has(t.id)) {
        await deps.deleteSaved(t.id);
        if (!result.removed.includes(t.id)) result.removed.push(t.id);
      }
      await deps.onWithdrawn?.(t.id, t);
    }

    // 2) refresh stale offline copies
    const stale = staleSavedIds(changes.updated, saved).filter((id) => !withdrawnIds.has(id));
    for (const id of stale) {
      try {
        const r = await deps.refetchArticle(id);
        if (r.kind === 'article') {
          await deps.replaceSaved(r.article);
          await deps.onUpdated?.(r.article);
          if (!result.refreshed.includes(id)) result.refreshed.push(id);
        } else {
          await deps.deleteSaved(id);
          await deps.onWithdrawn?.(id, r.tombstone);
          if (!result.removed.includes(id)) result.removed.push(id);
        }
      } catch {
        // transient (offline, 5xx): keep the old copy and do NOT advance the cursor past this page
        pageOk = false;
        if (!result.failed.includes(id)) result.failed.push(id);
      }
    }

    if (!pageOk) return result;
    cursor = changes.cursor;
    await deps.setCursor(cursor);
    result.cursor = cursor;
    if (!changes.hasMore) {
      result.complete = true;
      return result;
    }
  }
  return result;
}

/**
 * Signed-in readers: merge on-device saved articles with server bookmarks (union).
 * Returns which ids to download (server-only) and which to upload (device-only). Pure.
 */
export function planBookmarkMerge(localIds: string[], serverIds: string[], pendingDeletes: string[] = []) {
  const local = new Set(localIds);
  const server = new Set(serverIds);
  const deleted = new Set(pendingDeletes);
  return {
    download: serverIds.filter((id) => !local.has(id) && !deleted.has(id)),
    upload: localIds.filter((id) => !server.has(id)),
    deleteRemote: pendingDeletes.filter((id) => server.has(id)),
  };
}
