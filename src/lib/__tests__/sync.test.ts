import { INITIAL_CURSOR, planBookmarkMerge, runSync, staleSavedIds, type SyncDeps } from '../sync';
import type { Article, SyncChanges, Tombstone } from '../../types';

const art = (id: string, revision: number) => ({ id, revision, headline: id, body: [] }) as unknown as Article;
const tomb = (id: string): Tombstone => ({ id, state: 'withdrawn', withdrawnAt: '2026-11-03T12:00:00Z', notice: `Withdrawn ${id}` });

function harness(pages: SyncChanges[], saved: Record<string, number>, opts: { cursor?: string | null; refetch?: (id: string) => Promise<any> } = {}) {
  const store = { ...saved };
  const calls = { fetch: [] as string[], refetch: [] as string[], replaced: [] as string[], deleted: [] as string[], withdrawnHooks: [] as string[], cursors: [] as string[] };
  let cursor = opts.cursor ?? null;
  let page = 0;
  const deps: SyncDeps = {
    fetchChanges: async (c) => {
      calls.fetch.push(c);
      return pages[page++] ?? { cursor: c, updated: [], withdrawn: [], hasMore: false };
    },
    getCursor: async () => cursor,
    setCursor: async (c) => {
      cursor = c;
      calls.cursors.push(c);
    },
    savedRevisions: async () => Object.entries(store).map(([id, revision]) => ({ id, revision })),
    refetchArticle:
      opts.refetch ??
      (async (id) => {
        calls.refetch.push(id);
        return { kind: 'article', article: art(id, 99) };
      }),
    replaceSaved: async (a) => {
      calls.replaced.push(a.id);
      store[a.id] = a.revision;
    },
    deleteSaved: async (id) => {
      calls.deleted.push(id);
      delete store[id];
    },
    onWithdrawn: (id) => {
      calls.withdrawnHooks.push(id);
    },
  };
  return { deps, calls, store, getCursor: () => cursor };
}

describe('staleSavedIds', () => {
  it('returns only saved ids whose server revision is newer', () => {
    const updated = [
      { id: 'aaaaaaaaaa', revision: 3, updatedAt: '' },
      { id: 'bbbbbbbbbb', revision: 1, updatedAt: '' },
      { id: 'cccccccccc', revision: 5, updatedAt: '' },
      { id: 'aaaaaaaaaa', revision: 4, updatedAt: '' },
    ];
    expect(staleSavedIds(updated, [{ id: 'aaaaaaaaaa', revision: 2 }, { id: 'bbbbbbbbbb', revision: 1 }])).toEqual(['aaaaaaaaaa']);
  });
});

describe('runSync', () => {
  it('starts from cursor 0, refetches stale saved copies only, stores the new cursor', async () => {
    const h = harness([{ cursor: '24', hasMore: false, withdrawn: [], updated: [{ id: 'aaaaaaaaaa', revision: 2, updatedAt: '' }, { id: 'zzzzzzzzzz', revision: 7, updatedAt: '' }, { id: 'bbbbbbbbbb', revision: 1, updatedAt: '' }] }], { aaaaaaaaaa: 1, bbbbbbbbbb: 1 });
    const r = await runSync(h.deps);
    expect(h.calls.fetch).toEqual([INITIAL_CURSOR]);
    expect(h.calls.refetch).toEqual(['aaaaaaaaaa']); // zzz not saved, bbb up to date
    expect(h.calls.replaced).toEqual(['aaaaaaaaaa']);
    expect(h.store.aaaaaaaaaa).toBe(99);
    expect(h.getCursor()).toBe('24');
    expect(r).toMatchObject({ cursor: '24', complete: true, refreshed: ['aaaaaaaaaa'], removed: [], failed: [], pages: 1 });
  });

  it('resumes from the stored cursor', async () => {
    const h = harness([{ cursor: '30', hasMore: false, withdrawn: [], updated: [] }], {}, { cursor: '24' });
    await runSync(h.deps);
    expect(h.calls.fetch).toEqual(['24']);
    expect(h.getCursor()).toBe('30');
  });

  it('deletes withdrawn articles (and runs the withdrawn hook) even if also listed as updated', async () => {
    const h = harness([{ cursor: '5', hasMore: false, withdrawn: [tomb('wwwwwwwwww'), tomb('nnnnnnnnnn')], updated: [{ id: 'wwwwwwwwww', revision: 9, updatedAt: '' }] }], { wwwwwwwwww: 1 });
    const r = await runSync(h.deps);
    expect(h.calls.deleted).toEqual(['wwwwwwwwww']);
    expect(h.calls.refetch).toEqual([]);
    expect(h.calls.withdrawnHooks).toEqual(['wwwwwwwwww', 'nnnnnnnnnn']);
    expect(r.removed).toEqual(['wwwwwwwwww']);
    expect(h.store).toEqual({});
  });

  it('treats a 410 on refetch as withdrawn', async () => {
    const h = harness([{ cursor: '8', hasMore: false, withdrawn: [], updated: [{ id: 'gggggggggg', revision: 2, updatedAt: '' }] }], { gggggggggg: 1 }, { refetch: async () => ({ kind: 'gone', tombstone: tomb('gggggggggg') }) });
    const r = await runSync(h.deps);
    expect(h.calls.deleted).toEqual(['gggggggggg']);
    expect(r.removed).toEqual(['gggggggggg']);
    expect(h.getCursor()).toBe('8');
  });

  it('follows hasMore across pages', async () => {
    const h = harness(
      [
        { cursor: '200', hasMore: true, withdrawn: [], updated: [{ id: 'aaaaaaaaaa', revision: 2, updatedAt: '' }] },
        { cursor: '260', hasMore: false, withdrawn: [tomb('bbbbbbbbbb')], updated: [] },
      ],
      { aaaaaaaaaa: 1, bbbbbbbbbb: 1 },
    );
    const r = await runSync(h.deps);
    expect(h.calls.fetch).toEqual(['0', '200']);
    expect(h.calls.cursors).toEqual(['200', '260']);
    expect(r).toMatchObject({ pages: 2, complete: true, refreshed: ['aaaaaaaaaa'], removed: ['bbbbbbbbbb'] });
  });

  it('does not advance the cursor when a refetch fails (retried next time) and keeps the old copy', async () => {
    const h = harness([{ cursor: '50', hasMore: false, withdrawn: [], updated: [{ id: 'aaaaaaaaaa', revision: 2, updatedAt: '' }] }], { aaaaaaaaaa: 1 }, {
      cursor: '40',
      refetch: async () => {
        throw new Error('offline');
      },
    });
    const r = await runSync(h.deps);
    expect(r).toMatchObject({ complete: false, failed: ['aaaaaaaaaa'], cursor: '40' });
    expect(h.getCursor()).toBe('40');
    expect(h.store.aaaaaaaaaa).toBe(1);
  });

  it('propagates a failed /sync request without touching the cursor', async () => {
    const h = harness([], {}, { cursor: '7' });
    h.deps.fetchChanges = async () => {
      throw new Error('network');
    };
    await expect(runSync(h.deps)).rejects.toThrow('network');
    expect(h.getCursor()).toBe('7');
  });

  it('stops after maxPages', async () => {
    const pages = Array.from({ length: 5 }, (_, i) => ({ cursor: String((i + 1) * 10), hasMore: true, withdrawn: [], updated: [] }));
    const h = harness(pages, {});
    const r = await runSync(h.deps, { maxPages: 3 });
    expect(r).toMatchObject({ pages: 3, complete: false, cursor: '30' });
  });
});

describe('planBookmarkMerge', () => {
  it('downloads server-only, uploads device-only, replays offline deletions', () => {
    expect(planBookmarkMerge(['a', 'b'], ['b', 'c', 'd'], ['d'])).toEqual({ download: ['c'], upload: ['a'], deleteRemote: ['d'] });
    expect(planBookmarkMerge([], [], [])).toEqual({ download: [], upload: [], deleteRemote: [] });
  });
});
