import { QueryClient } from '@tanstack/react-query';
import type { LiveFeed } from '../../types';

jest.mock('../../api', () => ({ endpoints: { liveFeed: jest.fn() } }));
jest.mock('../../api/queryClient', () => {
  const { QueryClient: QC } = jest.requireActual('@tanstack/react-query');
  return { queryClient: new QC() };
});
jest.mock('../../storage/savedDb', () => ({ savedStore: { get: jest.fn(async () => null), putLive: jest.fn(async () => true) } }));

// eslint-disable-next-line import/first
import { fetchLiveFeed, liveFeedKey, refreshLiveSnapshot } from '../live';

const api = (jest.requireMock('../../api') as { endpoints: { liveFeed: jest.Mock } }).endpoints;
const qc = (jest.requireMock('../../api/queryClient') as { queryClient: QueryClient }).queryClient;
const store = (jest.requireMock('../../storage/savedDb') as { savedStore: { get: jest.Mock; putLive: jest.Mock } }).savedStore;

const ID = 'p68a3knpc3';
const feed = (x: Partial<LiveFeed> = {}): LiveFeed => ({
  coverage: { id: ID, url: 'u', path: '/p', headline: 'h', category: { slug: 'world', name: 'World' }, state: 'live', archived: false, startedAt: null, endedAt: null, lastUpdateAt: null, updateCount: 1, isDemo: false },
  updates: [{ id: 'a', articleId: ID, at: '2026-11-03T10:00:00Z', pinned: false, body: [] }],
  removedIds: [], serverTime: '2026-11-03T10:00:05Z', relatedArticles: [], ...x,
});

describe('fetchLiveFeed (GET /live/{id})', () => {
  beforeEach(() => jest.clearAllMocks());
  afterAll(() => qc.clear()); // drops the cache's garbage-collection timers so Jest can exit
  it('loads everything first, then asks only for changes since the previous serverTime', async () => {
    api.liveFeed.mockResolvedValueOnce(feed());
    const first = await fetchLiveFeed(ID, null);
    expect(api.liveFeed).toHaveBeenLastCalledWith(ID, null, undefined);
    api.liveFeed.mockResolvedValueOnce(feed({ updates: [{ id: 'b', articleId: ID, at: '2026-11-03T10:01:00Z', pinned: false, body: [] }], serverTime: '2026-11-03T10:01:05Z' }));
    const next = await fetchLiveFeed(ID, first);
    expect(api.liveFeed).toHaveBeenLastCalledWith(ID, '2026-11-03T10:00:05Z', undefined);
    expect(next.updates.map((u) => u.id)).toEqual(['b', 'a']);
    expect(next.unseenIds).toEqual(['b']);
    expect(next.serverTime).toBe('2026-11-03T10:01:05Z');
  });
  it('never merges a feed of another coverage', async () => {
    api.liveFeed.mockResolvedValueOnce(feed());
    const other = await fetchLiveFeed(ID, null);
    api.liveFeed.mockResolvedValueOnce(feed());
    await fetchLiveFeed('xv17qcd8fd', other);
    expect(api.liveFeed).toHaveBeenLastCalledWith('xv17qcd8fd', null, undefined);
  });
  it('refreshLiveSnapshot updates the cache and the saved offline copy, and survives failures', async () => {
    api.liveFeed.mockResolvedValueOnce(feed());
    expect(await refreshLiveSnapshot(ID)).toBe(true);
    expect(store.putLive).toHaveBeenCalledWith(ID, expect.objectContaining({ serverTime: '2026-11-03T10:00:05Z' }));
    expect(qc.getQueryData(liveFeedKey(ID))).toBeTruthy();
    api.liveFeed.mockRejectedValueOnce(new Error('offline'));
    expect(await refreshLiveSnapshot(ID)).toBe(false);
  });
});
