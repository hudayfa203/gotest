/**
 * BUILT-IN DEMO CONTENT (test builds only).
 *
 * Until a Garowe World server is online, test APKs can show a fixed set of clearly labelled demonstration stories
 * (every item carries isDemo → "Demo" badges, plus the demo notice on Home). The stories, live coverage, alerts and
 * media were exported from the platform's demo seed by scripts/export-app-demo.mjs and are answered here as if they
 * came from the API, so every screen runs its normal code path.
 *
 * - Timestamps are shifted so the snapshot looks current: "captured at" becomes "now" when the app starts.
 * - Media files are bundled in the app (src/demo/media) and referenced as `gwdemo-media:<file>`.
 * - Nothing is ever sent anywhere: device registration, sign-in, notifications and bookmarks sync answer
 *   "not available with the built-in demo stories"; analytics events are dropped (reported as 0 accepted).
 */
import { Asset } from 'expo-asset';
import { DEMO_MEDIA } from './media';
import snapshotJson from './snapshot.json';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;
const snap: Json = snapshotJson;

export const DEMO_CAPTURED_AT: string = snap.capturedAt;
const ISO = /"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z)"/g;
const MEDIA = /gwdemo-media:([a-z0-9._]+)/g;

let offsetMs: number | null = null;
/** ms to add to every snapshot timestamp so the capture moment maps to the start of this app session */
function offset() {
  if (offsetMs === null) offsetMs = Math.max(0, Date.now() - Date.parse(DEMO_CAPTURED_AT));
  return offsetMs;
}
/** a snapshot-time ISO string for "now" (it is shifted on the way out like every other timestamp) */
const snapshotNow = () => new Date(Date.now() - offset()).toISOString();

let mediaUris: Record<string, string> = {};
let preparing: Promise<void> | null = null;
/** Resolve bundled media to file URIs once (expo-asset copies them out of the APK on first use). */
export function prepareDemoMedia(): Promise<void> {
  preparing ??= (async () => {
    const entries = Object.entries(DEMO_MEDIA);
    const uris = await Promise.all(
      entries.map(async ([, mod]) => {
        const a = Asset.fromModule(mod);
        try {
          await a.downloadAsync();
        } catch {
          /* fall back to the asset uri */
        }
        return a.localUri ?? a.uri;
      }),
    );
    mediaUris = Object.fromEntries(entries.map(([name], i) => [name, uris[i]]));
  })();
  return preparing;
}

export const DEMO_UNAVAILABLE_MESSAGE =
  'Not available with the built-in demo stories. Connect the app to a Garowe World server in Settings → Content source.';

type Out = { status: number; body?: Json };
const ok = (body: Json): Out => ({ status: 200, body });
const notFound = (message = 'This content could not be found.'): Out => ({ status: 404, body: { error: { code: 'NOT_FOUND', message } } });
const unavailable = (): Out => ({ status: 403, body: { error: { code: 'DEMO_CONTENT', message: DEMO_UNAVAILABLE_MESSAGE } } });

function query(qs: string) {
  const q: Record<string, string> = {};
  for (const part of qs.split('&')) {
    if (!part) continue;
    const [k, v = ''] = part.split('=');
    try {
      q[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
      q[k] = v;
    }
  }
  return q;
}

function page<T>(items: T[], cursor: string | undefined, size: number) {
  const start = Math.max(0, Number.parseInt(cursor ?? '0', 10) || 0);
  const end = start + size;
  return { items: items.slice(start, end), nextCursor: end < items.length ? String(end) : null, start };
}
const sizeOf = (q: Record<string, string>, d = 20) => Math.min(50, Math.max(1, Number.parseInt(q.pageSize ?? '', 10) || d));
const byNewest = (a: Json, b: Json) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt);

function articles(q: Record<string, string>): Out {
  let items: Json[] = [...snap.summaries];
  if (q.category) {
    const ids = new Set<string>(snap.categoryIndex[q.category] ?? []);
    items = items.filter((s) => ids.has(s.id));
  }
  if (q.type) items = items.filter((s) => s.type === q.type);
  if (q.label) items = items.filter((s) => (s.labels ?? []).includes(q.label));
  if (q.author) items = items.filter((s) => (s.authors ?? []).some((a: Json) => a.slug === q.author));
  if (q.tag) items = items.filter((s) => (snap.articles[s.id]?.tags ?? []).some((t: Json) => t.slug === q.tag));
  items.sort(byNewest);
  const size = sizeOf(q);
  const p = page(items, q.cursor, size);
  return ok({ items: p.items, page: Math.floor(p.start / size) + 1, pageSize: size, total: items.length, nextCursor: p.nextCursor });
}

function search(q: Record<string, string>): Out {
  const terms = (q.q ?? '').toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  const scored: { s: Json; score: number }[] = [];
  for (const s of snap.summaries as Json[]) {
    if (q.type && s.type !== q.type) continue;
    if (q.category && !(snap.categoryIndex[q.category] ?? []).includes(s.id)) continue;
    const head = String(s.headline).toLowerCase();
    const rest = `${s.standfirst ?? ''} ${s.category?.name ?? ''} ${(snap.articles[s.id]?.tags ?? []).map((t: Json) => t.name).join(' ')}`.toLowerCase();
    let score = 0;
    let all = terms.length > 0;
    for (const t of terms) {
      const h = head.includes(t);
      const r = rest.includes(t);
      if (!h && !r) all = false;
      score += (h ? 3 : 0) + (r ? 1 : 0);
    }
    if (all) scored.push({ s, score });
  }
  scored.sort((a, b) => (q.sort === 'newest' ? byNewest(a.s, b.s) : b.score - a.score || byNewest(a.s, b.s)));
  const size = sizeOf(q);
  const pageNo = Math.max(1, Number.parseInt(q.page ?? '1', 10) || 1);
  const items = scored.slice((pageNo - 1) * size, pageNo * size).map((x) => x.s);
  return ok({ items, page: pageNo, pageSize: size, total: scored.length, nextCursor: null });
}

function liveFeed(id: string, q: Record<string, string>): Out {
  const feed = snap.liveFeeds[id];
  if (!feed) return notFound();
  if (q.since) return ok({ ...feed, updates: [], removedIds: [], serverTime: snapshotNow() });
  return ok({ ...feed, serverTime: snapshotNow() });
}

function resolvePath(path: string): Out {
  const p = (path || '/').replace(/\/+$/, '') || '/';
  const s = (snap.summaries as Json[]).find((x) => x.path === p);
  return s ? ok({ kind: 'article', canonicalPath: s.path, status: 200, articleId: s.id }) : notFound('No content at this path');
}

function routeGet(path: string, q: Record<string, string>): Out {
  const seg = path.split('/').filter(Boolean).map((x) => decodeURIComponent(x));
  switch (seg[0]) {
    case 'config': return ok(snap.config);
    case 'home': return ok({ ...snap.home, generatedAt: snapshotNow() });
    case 'alerts': return ok(snap.alerts);
    case 'pulse': return ok((snap.summaries as Json[]).filter((x) => x.location).sort(byNewest).slice(0, 40));
    case 'categories': return ok(snap.categories);
    case 'navigation': return ok(snap.navigation[q.menu] ?? []);
    case 'podcasts': return ok(snap.podcasts);
    case 'ads': return ok(snap.ads[q.placement] ?? { placement: q.placement, ad: null });
    case 'sync': return ok({ cursor: q.cursor || '0', updated: [], withdrawn: [], hasMore: false });
    case 'resolve': return resolvePath(q.path ?? '/');
    case 'search': return search(q);
    case 'articles': return seg[1] ? (snap.articles[seg[1]] ? ok(snap.articles[seg[1]]) : notFound()) : articles(q);
    case 'authors': return snap.authors[seg[1]] ? ok(snap.authors[seg[1]]) : notFound();
    case 'tags': return snap.tags[seg[1]] ? ok(snap.tags[seg[1]]) : notFound();
    case 'live': {
      if (!seg[1]) return ok(snap.liveHub);
      if (seg[1] === 'archive') {
        const p = page(snap.liveArchive.items, q.cursor, sizeOf(q));
        return ok({ items: p.items, nextCursor: p.nextCursor });
      }
      return liveFeed(seg[1], q);
    }
    default: return seg[0] === 'me' || seg[0] === 'devices' ? unavailable() : notFound();
  }
}

function route(method: string, path: string, q: Record<string, string>): Out {
  if (method === 'GET') return routeGet(path, q);
  if (method === 'POST' && path === '/events') return ok({ accepted: 0 }); // analytics are not recorded in demo mode
  if (method === 'POST' && (path === '/ads/event' || path === '/push/opened')) return { status: 204 };
  return unavailable();
}

function serialize(body: Json) {
  const shift = offset();
  return JSON.stringify(body)
    .replace(ISO, (_m, iso: string) => `"${new Date(Date.parse(iso) + shift).toISOString()}"`)
    .replace(MEDIA, (m, name: string) => mediaUris[name] ?? m);
}

/** fetch() replacement used by the API client while the built-in demo stories are selected. */
export async function demoFetch(url: string, init?: { method?: string }): Promise<Response> {
  await prepareDemoMedia();
  const noHash = url.split('#')[0];
  const qi = noHash.indexOf('?');
  const full = qi >= 0 ? noHash.slice(0, qi) : noHash;
  const i = full.indexOf('/api/v1');
  const path = i >= 0 ? full.slice(i + '/api/v1'.length) || '/' : full;
  const out = route((init?.method ?? 'GET').toUpperCase(), path, query(qi >= 0 ? noHash.slice(qi + 1) : ''));
  if (out.status === 204 || out.body === undefined) return new Response(null, { status: out.status === 200 ? 204 : out.status });
  return new Response(serialize(out.body), { status: out.status, headers: { 'Content-Type': 'application/json' } });
}

/** for tests */
export const __demo = { snap, route, serialize, resetClock: () => (offsetMs = null) };
