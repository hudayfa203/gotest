import {
  LIVE_ENTRY_MAX_AGE_MS, LIVE_STALE_MS, applyLiveDelta, archiveItems, articleLiveState, compareLiveUpdates, coverageDuration, coverageStatus,
  displayLabels, feedFromFull, formatSpan, isEdited, isLiveCoverageArticle, liveBadge, liveEntryItems, liveFeedReducer, resolveLiveState,
  sortLiveUpdates, splitPinned, updateCountText, type LiveFeedState,
} from '../live';
import type { LiveCoverage, LiveFeed, LiveUpdate } from '../../types';

const ID = 'p68a3knpc3';
const u = (id: string, at: string, extra: Partial<LiveUpdate> = {}): LiveUpdate => ({
  id, articleId: ID, at, pinned: false, body: [{ type: 'paragraph', children: [{ type: 'text', text: `update ${id}` }] }], ...extra,
});
const coverage = (extra: Partial<LiveCoverage> = {}): LiveCoverage => ({
  id: ID, url: `https://goworld.news/world/live-forum-${ID}`, path: `/world/live-forum-${ID}`, headline: 'Live: forum', category: { slug: 'world', name: 'World' },
  state: 'live', archived: false, startedAt: '2026-11-03T08:00:00.000Z', endedAt: null, lastUpdateAt: '2026-11-03T10:00:00.000Z', updateCount: 3, isDemo: false, ...extra,
});
const feed = (updates: LiveUpdate[], extra: Partial<LiveFeed> = {}): LiveFeed => ({
  coverage: coverage(), updates, removedIds: [], serverTime: '2026-11-03T10:00:05.000Z', relatedArticles: [], ...extra,
});

describe('ordering', () => {
  it('puts pinned first, then newest first, with a stable tie-break', () => {
    const list = [u('a', '2026-11-03T09:00:00Z'), u('p', '2026-11-03T08:30:00Z', { pinned: true }), u('c', '2026-11-03T10:00:00Z'), u('b', '2026-11-03T10:00:00Z')];
    expect(sortLiveUpdates(list).map((x) => x.id)).toEqual(['p', 'c', 'b', 'a']);
    expect(compareLiveUpdates(list[0], list[0])).toBe(0);
  });
  it('splits key (pinned) updates from the timeline', () => {
    const { key, timeline } = splitPinned([u('a', '2026-11-03T09:00:00Z'), u('p', '2026-11-03T08:00:00Z', { pinned: true }), u('b', '2026-11-03T10:00:00Z')]);
    expect(key.map((x) => x.id)).toEqual(['p']);
    expect(timeline.map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('feed reducer', () => {
  const base = (): LiveFeedState => feedFromFull(feed([u('a', '2026-11-03T09:00:00Z'), u('b', '2026-11-03T09:30:00Z'), u('p', '2026-11-03T08:00:00Z', { pinned: true })]), 1000);

  it('a full load replaces everything, sorted, with nothing unseen', () => {
    const s = base();
    expect(s.updates.map((x) => x.id)).toEqual(['p', 'b', 'a']);
    expect(s.serverTime).toBe('2026-11-03T10:00:05.000Z');
    expect(s.fetchedAt).toBe(1000);
    expect(s.unseenIds).toEqual([]);
    const again = liveFeedReducer(s, { type: 'full', feed: feed([u('z', '2026-11-03T11:00:00Z')]), now: 2000 })!;
    expect(again.updates.map((x) => x.id)).toEqual(['z']);
  });

  it('merges new updates from ?since= and marks them unseen', () => {
    const r = applyLiveDelta(base(), feed([u('c', '2026-11-03T10:01:00Z')], { serverTime: '2026-11-03T10:01:30.000Z' }), 5000);
    expect(r.added).toEqual(['c']);
    expect(r.state.updates.map((x) => x.id)).toEqual(['p', 'c', 'b', 'a']);
    expect(r.state.unseenIds).toEqual(['c']);
    expect(r.state.serverTime).toBe('2026-11-03T10:01:30.000Z');
    expect(r.state.fetchedAt).toBe(5000);
  });

  it('replaces edited updates in place (not counted as new)', () => {
    const edit = u('a', '2026-11-03T09:00:00Z', { headline: 'Corrected', updatedAt: '2026-11-03T10:00:30Z' });
    const r = applyLiveDelta(base(), feed([edit]));
    expect(r.added).toEqual([]);
    expect(r.edited).toEqual(['a']);
    expect(r.state.updates.find((x) => x.id === 'a')?.headline).toBe('Corrected');
    expect(r.state.unseenIds).toEqual([]);
  });

  it('an update that becomes pinned joins the pinned group (pinned are newest first too)', () => {
    const r = applyLiveDelta(base(), feed([u('a', '2026-11-03T09:00:00Z', { pinned: true, updatedAt: '2026-11-03T10:00:30Z' })]));
    expect(r.edited).toEqual(['a']);
    expect(r.state.updates.map((x) => x.id)).toEqual(['a', 'p', 'b']);
  });

  it('drops removedIds (also from the unseen list) and ignores unknown ids', () => {
    const withNew = applyLiveDelta(base(), feed([u('c', '2026-11-03T10:01:00Z')])).state;
    const r = applyLiveDelta(withNew, feed([], { removedIds: ['c', 'b', 'never-seen'] }));
    expect(r.removed.sort()).toEqual(['b', 'c']);
    expect(r.state.updates.map((x) => x.id)).toEqual(['p', 'a']);
    expect(r.state.unseenIds).toEqual([]);
  });

  it('an identical re-sent update is neither new nor edited', () => {
    const s = base();
    const r = applyLiveDelta(s, feed([s.updates[1]]));
    expect(r.added).toEqual([]);
    expect(r.edited).toEqual([]);
  });

  it('reports when the coverage ends and keeps the last serverTime when the server omits it', () => {
    const r = applyLiveDelta(base(), feed([], { coverage: coverage({ state: 'ended', endedAt: '2026-11-03T10:05:00Z' }), serverTime: '' }));
    expect(r.statusChanged).toBe(true);
    expect(r.state.coverage.state).toBe('ended');
    expect(r.state.serverTime).toBe('2026-11-03T10:00:05.000Z');
    expect(applyLiveDelta(base(), feed([])).statusChanged).toBe(false);
  });

  it('"seen" clears unseen ids; a delta with no base yields nothing', () => {
    const s = applyLiveDelta(base(), feed([u('c', '2026-11-03T10:01:00Z')])).state;
    expect(liveFeedReducer(s, { type: 'seen' })!.unseenIds).toEqual([]);
    const clean = base();
    expect(liveFeedReducer(clean, { type: 'seen' })).toBe(clean);
    expect(liveFeedReducer(null, { type: 'delta', feed: feed([]) })).toBeNull();
  });

  it('isEdited needs at least a minute between publishing and the edit', () => {
    expect(isEdited({ at: '2026-11-03T10:00:00Z', updatedAt: '2026-11-03T10:00:20Z' })).toBe(false);
    expect(isEdited({ at: '2026-11-03T10:00:00Z', updatedAt: '2026-11-03T10:03:00Z' })).toBe(true);
    expect(isEdited({ at: '2026-11-03T10:00:00Z' })).toBe(false);
  });
});

describe('status (never LIVE when nothing is live)', () => {
  const now = Date.parse('2026-11-03T10:00:00Z');
  it('live only while state is live and the data is fresh', () => {
    expect(coverageStatus({ state: 'live', archived: false }, now - 5_000, now)).toBe('live');
    expect(coverageStatus({ state: 'live', archived: false }, now - LIVE_STALE_MS - 1, now)).toBe('stale');
    expect(coverageStatus({ state: 'live', archived: false }, null, now)).toBe('stale');
    expect(coverageStatus({ state: 'ended', archived: false }, now, now)).toBe('ended');
    expect(coverageStatus({ state: 'ended', archived: true }, now, now)).toBe('archived');
  });
  it('trusts the feed once it says ended, otherwise the newer of article and feed', () => {
    expect(resolveLiveState({ state: 'live', at: 1 }, { state: 'ended', at: 2 })).toBe('ended');
    // an article fetched after the feed ended (e.g. a cached copy) never brings LIVE back
    expect(resolveLiveState({ state: 'live', at: 5 }, { state: 'ended', at: 2 })).toBe('ended');
    expect(resolveLiveState({ state: 'ended', at: 3 }, { state: 'live', at: 2 })).toBe('ended');
    // reopened coverage: a newer live feed wins over an older ended article
    expect(resolveLiveState({ state: 'ended', at: 1 }, { state: 'live', at: 2 })).toBe('live');
    expect(resolveLiveState({ state: 'live', at: 1 }, null)).toBe('live');
    expect(resolveLiveState(null, undefined)).toBeNull();
  });
  it('reads article live state, tolerating copies saved before `state` existed', () => {
    expect(articleLiveState({ live: { status: 'ended' } })).toBe('ended');
    expect(articleLiveState({ live: { state: 'live', status: 'live' } })).toBe('live');
    expect(articleLiveState({})).toBeNull();
    expect(isLiveCoverageArticle({ type: 'live' })).toBe(true);
    expect(isLiveCoverageArticle({ type: 'news' })).toBe(false);
  });
  it('card badges: LIVE only for live state, ENDED for ended, a bare live label is dropped', () => {
    expect(liveBadge({ live: { state: 'live' } })).toBe('live');
    expect(liveBadge({ live: { state: 'ended' } })).toBe('ended');
    expect(liveBadge({})).toBeNull();
    expect(displayLabels({ labels: ['live', 'exclusive'], live: { state: 'ended' } })).toEqual(['ended', 'exclusive']);
    expect(displayLabels({ labels: ['live', 'breaking'] })).toEqual(['breaking']);
    expect(displayLabels({ labels: [], live: { state: 'live' } })).toEqual(['live']);
  });
});

describe('home entry and hub lists', () => {
  const now = Date.parse('2026-11-03T10:00:00Z');
  const a = coverage({ id: 'aaaaaaaaaa', lastUpdateAt: '2026-11-03T09:00:00Z' });
  const b = coverage({ id: 'bbbbbbbbbb', lastUpdateAt: '2026-11-03T09:50:00Z' });
  const ended = coverage({ id: 'cccccccccc', state: 'ended' });
  it('shows only live coverage, most recently updated first', () => {
    expect(liveEntryItems([a, ended, b], now - 1000, now).map((x) => x.id)).toEqual(['bbbbbbbbbb', 'aaaaaaaaaa']);
    expect(liveEntryItems([], now, now)).toEqual([]);
    expect(liveEntryItems(undefined, now, now)).toEqual([]);
  });
  it('hides the entry when the home data is too old to vouch for it', () => {
    expect(liveEntryItems([a], now - LIVE_ENTRY_MAX_AGE_MS - 1, now)).toEqual([]);
    expect(liveEntryItems([a], 0, now)).toEqual([]);
  });
  it('flattens archive pages without duplicates or coverage shown elsewhere', () => {
    const items = archiveItems([{ items: [ended, a] }, { items: [a, b] }], ['bbbbbbbbbb']);
    expect(items.map((x) => x.id)).toEqual(['cccccccccc', 'aaaaaaaaaa']);
    expect(archiveItems(undefined)).toEqual([]);
  });
});

describe('text helpers', () => {
  it('formats spans and counts', () => {
    expect(formatSpan(45 * 60_000)).toBe('45 min');
    expect(formatSpan(6 * 3_600_000)).toBe('6 hrs');
    expect(formatSpan(3_600_000)).toBe('1 hr');
    expect(formatSpan(3 * 86_400_000)).toBe('3 days');
    expect(formatSpan(-1)).toBe('');
    expect(coverageDuration({ startedAt: '2026-11-03T00:25:00Z', endedAt: '2026-11-03T06:25:00Z' })).toBe('6 hrs');
    expect(coverageDuration({ startedAt: '2026-11-03T00:25:00Z', endedAt: null })).toBe('');
    expect(updateCountText(1)).toBe('1 update');
    expect(updateCountText(4)).toBe('4 updates');
  });
});
