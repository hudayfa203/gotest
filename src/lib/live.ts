/**
 * Live coverage — pure logic (unit-tested in __tests__/live.test.ts).
 *
 * Live coverage (GET /live, /live/{id}) and breaking-news alerts (GET /home `breaking`) are SEPARATE
 * features: nothing here ever reads alerts, and the alert banner never reads live coverage.
 *
 * The feed reducer turns GET /live/{id} responses into the screen state:
 *   - full load (no `since`): replaces everything
 *   - incremental load (`?since=<serverTime of the previous response>`): upserts new + edited updates,
 *     drops `removedIds`, and keeps the order pinned → newest
 */
import type { ArticleSummary, Label, LiveCoverage, LiveFeed, LiveState, LiveUpdate } from '../types';

/** Poll interval while coverage is live, the screen is focused and the app is in the foreground. */
export const LIVE_POLL_MS = 20_000;
/** Feed data older than this (while coverage is live) is shown as "not refreshed since …", never as LIVE. */
export const LIVE_STALE_MS = 3 * LIVE_POLL_MS;
/** The home LIVE UPDATES entry is hidden when the home data is older than this (offline/persisted cache). */
export const LIVE_ENTRY_MAX_AGE_MS = 15 * 60_000;
/** An update counts as "edited" when updatedAt is at least this much later than its publication time. */
const EDIT_THRESHOLD_MS = 60_000;

// ------------------------------------------------------------------------------------------- ordering

const ts = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/** Pinned first, then newest first (ties: id, so the order is stable across refreshes). */
export function compareLiveUpdates(a: LiveUpdate, b: LiveUpdate): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  const d = ts(b.at) - ts(a.at);
  if (d !== 0) return d;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

export function sortLiveUpdates(updates: LiveUpdate[]): LiveUpdate[] {
  return [...updates].sort(compareLiveUpdates);
}

/** Upsert `incoming` into `existing` by id (incoming copy wins — it may be an edit), then order pinned → newest. */
export function mergeLiveUpdates(existing: LiveUpdate[], incoming: LiveUpdate[]): LiveUpdate[] {
  const byId = new Map<string, LiveUpdate>();
  for (const u of existing) byId.set(u.id, u);
  for (const u of incoming) byId.set(u.id, u);
  return sortLiveUpdates(Array.from(byId.values()));
}

/** Newest publication time among updates (ISO), or undefined for an empty list. */
export function newestUpdateAt(updates: LiveUpdate[]): string | undefined {
  let best: number | null = null;
  for (const u of updates) {
    const t = Date.parse(u.at);
    if (!Number.isNaN(t) && (best === null || t > best)) best = t;
  }
  return best === null ? undefined : new Date(best).toISOString();
}

/** Updates in `incoming` whose id is not in `known` (for the "N new updates" pill). */
export function countNewUpdates(known: LiveUpdate[], incoming: LiveUpdate[]) {
  const ids = new Set(known.map((u) => u.id));
  return incoming.filter((u) => !ids.has(u.id)).length;
}

/** "Key updates" (pinned, shown first) and the timeline (everything else, newest first). */
export function splitPinned(updates: LiveUpdate[]): { key: LiveUpdate[]; timeline: LiveUpdate[] } {
  const sorted = sortLiveUpdates(updates);
  return { key: sorted.filter((u) => u.pinned), timeline: sorted.filter((u) => !u.pinned) };
}

export function isEdited(u: Pick<LiveUpdate, 'at' | 'updatedAt'>): boolean {
  return !!u.updatedAt && ts(u.updatedAt) - ts(u.at) >= EDIT_THRESHOLD_MS;
}

// ------------------------------------------------------------------------------------------- feed reducer

export interface LiveFeedState {
  coverage: LiveCoverage;
  /** pinned → newest */
  updates: LiveUpdate[];
  relatedArticles: ArticleSummary[];
  /** server clock of the last response — sent back as `?since=` (never the device clock) */
  serverTime: string;
  /** device time of the last successful response — only used to say how fresh the screen is */
  fetchedAt: number;
  /** ids added by incremental refreshes that the reader has not been shown yet */
  unseenIds: string[];
}

export type LiveFeedAction =
  | { type: 'full'; feed: LiveFeed; now?: number }
  | { type: 'delta'; feed: LiveFeed; now?: number }
  | { type: 'seen' };

export interface LiveDeltaResult {
  state: LiveFeedState;
  added: string[];
  edited: string[];
  removed: string[];
  /** coverage switched between live and ended (or was archived) */
  statusChanged: boolean;
}

export function feedFromFull(feed: LiveFeed, now: number = Date.now()): LiveFeedState {
  return {
    coverage: feed.coverage,
    updates: sortLiveUpdates(feed.updates ?? []),
    relatedArticles: feed.relatedArticles ?? [],
    serverTime: feed.serverTime,
    fetchedAt: now,
    unseenIds: [],
  };
}

function sameUpdate(a: LiveUpdate, b: LiveUpdate) {
  return a.updatedAt === b.updatedAt && a.pinned === b.pinned && a.at === b.at && a.headline === b.headline && JSON.stringify(a.body) === JSON.stringify(b.body);
}

/** Merge an incremental response (`?since=`) into the current state. */
export function applyLiveDelta(prev: LiveFeedState, delta: LiveFeed, now: number = Date.now()): LiveDeltaResult {
  const known = new Map(prev.updates.map((u) => [u.id, u]));
  const added: string[] = [];
  const edited: string[] = [];
  for (const u of delta.updates ?? []) {
    const old = known.get(u.id);
    if (!old) added.push(u.id);
    else if (!sameUpdate(old, u)) edited.push(u.id);
  }
  const removedSet = new Set((delta.removedIds ?? []).filter((id) => known.has(id) || added.includes(id)));
  const merged = mergeLiveUpdates(prev.updates, delta.updates ?? []).filter((u) => !removedSet.has(u.id));
  const addedKept = added.filter((id) => !removedSet.has(id));
  const unseen = [...prev.unseenIds.filter((id) => !removedSet.has(id)), ...addedKept.filter((id) => !prev.unseenIds.includes(id))];
  const statusChanged = prev.coverage.state !== delta.coverage.state || prev.coverage.archived !== delta.coverage.archived;
  return {
    state: {
      coverage: delta.coverage,
      updates: merged,
      relatedArticles: delta.relatedArticles ?? prev.relatedArticles,
      serverTime: delta.serverTime || prev.serverTime,
      fetchedAt: now,
      unseenIds: unseen,
    },
    added: addedKept,
    edited: edited.filter((id) => !removedSet.has(id)),
    removed: Array.from(removedSet).filter((id) => known.has(id)),
    statusChanged,
  };
}

/** Reducer for the live coverage screen (also used inside the React Query fetcher). */
export function liveFeedReducer(state: LiveFeedState | null, action: LiveFeedAction): LiveFeedState | null {
  switch (action.type) {
    case 'full':
      return feedFromFull(action.feed, action.now);
    case 'delta':
      // an incremental response without a base to merge into cannot be complete — treat it as nothing known
      return state ? applyLiveDelta(state, action.feed, action.now).state : null;
    case 'seen':
      return state && state.unseenIds.length ? { ...state, unseenIds: [] } : state;
    default:
      return state;
  }
}

// ------------------------------------------------------------------------------------------- status

export type CoverageStatus = 'live' | 'stale' | 'ended' | 'archived';

/**
 * What the coverage screen may claim. `stale` = live at the last successful check, but that check is too old
 * (offline, server unreachable) — the UI then says "not refreshed since …" instead of showing LIVE.
 */
export function coverageStatus(c: Pick<LiveCoverage, 'state' | 'archived'>, fetchedAt: number | null | undefined, now: number = Date.now()): CoverageStatus {
  if (c.state === 'ended') return c.archived ? 'archived' : 'ended';
  if (!fetchedAt || now - fetchedAt > LIVE_STALE_MS) return 'stale';
  return 'live';
}

/**
 * The article (GET /articles/{id}) and the feed (GET /live/{id}) both report the coverage state. The polled feed is
 * the authority: once it says 'ended', an article response fetched later (possibly a cached copy) cannot bring LIVE
 * back. Otherwise the newer response wins (an old cached feed vs. a fresh article). Null when neither knows.
 */
export function resolveLiveState(
  article: { state?: LiveState; at?: number } | null | undefined,
  feed: { state?: LiveState; at?: number } | null | undefined,
): LiveState | null {
  const a = article?.state ? article : null;
  const f = feed?.state ? feed : null;
  if (f?.state === 'ended') return 'ended';
  if (a && f) return (f.at ?? 0) >= (a.at ?? 0) ? f.state! : a.state!;
  return f?.state ?? a?.state ?? null;
}

/** State of an Article's live block, tolerating offline copies saved before `state` existed. */
export function articleLiveState(a: { live?: { state?: LiveState; status?: LiveState } } | null | undefined): LiveState | null {
  return a?.live?.state ?? a?.live?.status ?? null;
}

export function isLiveCoverageArticle(a: { type?: string; live?: unknown } | null | undefined): boolean {
  return !!a && (a.type === 'live' || !!a.live);
}

// ------------------------------------------------------------------------------------------- badges / labels

export type DisplayLabel = Label | 'ended';

/**
 * Status badge for cards: LIVE only while `live.state === 'live'`, ENDED for ended coverage, nothing otherwise.
 * (A bare 'live' label without live state is never shown as LIVE.)
 */
export function liveBadge(a: { live?: { state?: LiveState; status?: LiveState } | null }): 'live' | 'ended' | null {
  const s = a.live?.state ?? a.live?.status;
  return s === 'live' ? 'live' : s === 'ended' ? 'ended' : null;
}

/** Labels to render on a card/header: the live status badge first, the editorial 'live' label removed. */
export function displayLabels(a: { labels?: Label[]; live?: { state?: LiveState; status?: LiveState } | null }): DisplayLabel[] {
  const badge = liveBadge(a);
  const rest = (a.labels ?? []).filter((l) => l !== 'live');
  return badge ? [badge, ...rest] : rest;
}

// ------------------------------------------------------------------------------------------- home entry + hub

/**
 * Coverage for the home LIVE UPDATES entry: only state 'live', most recently updated first, and nothing at all
 * when the home data is too old to vouch for it (e.g. a cache restored while offline).
 */
export function liveEntryItems(liveNow: LiveCoverage[] | undefined, dataUpdatedAt: number, now: number = Date.now()): LiveCoverage[] {
  if (!liveNow?.length) return [];
  if (!dataUpdatedAt || now - dataUpdatedAt > LIVE_ENTRY_MAX_AGE_MS) return [];
  return liveNow
    .filter((c) => c.state === 'live')
    .sort((a, b) => ts(b.lastUpdateAt ?? b.startedAt) - ts(a.lastUpdateAt ?? a.startedAt));
}

/** Archive pages flattened, deduplicated, without coverage already shown in the hub's other sections. */
export function archiveItems(pages: { items: LiveCoverage[] }[] | undefined, exclude: Iterable<string> = []): LiveCoverage[] {
  const seen = new Set<string>(exclude);
  const out: LiveCoverage[] = [];
  for (const p of pages ?? []) {
    for (const c of p.items) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------------- text

/** Compact span: "45 min", "6 hrs", "2 days". */
export function formatSpan(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${Math.max(1, m)} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hr${h === 1 ? '' : 's'}`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'}`;
}

/** "6 hrs" between startedAt and endedAt (or '' when either is unknown). */
export function coverageDuration(c: Pick<LiveCoverage, 'startedAt' | 'endedAt'>): string {
  if (!c.startedAt || !c.endedAt) return '';
  return formatSpan(ts(c.endedAt) - ts(c.startedAt));
}

export function updateCountText(n: number): string {
  return `${n} ${n === 1 ? 'update' : 'updates'}`;
}
