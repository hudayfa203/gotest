/**
 * Deep link + website URL parsing (pure, unit-tested).
 *
 * Handles:
 *   goworldnews://article/{id}                      → article
 *   goworldnews://live, goworldnews://live/{id}     → Live hub / that live coverage (article screen)
 *   goworldnews://auth?token=…                      → reader sign-in verification
 *   https://goworld.news/{section}/{slug}-{id}      → article (id = last 10 chars, Crockford base32)
 *   https://goworld.news/video/{slug}-{id}          → article
 *   https://goworld.news/podcasts/{series}/{ep}-{id}→ article
 *   https://goworld.news/live, /live/archive        → Live hub (live coverage itself has article URLs)
 *   https://goworld.news/author/{slug}, /tag/{slug}, /{section}, /video, /search …
 *   other goworld.news paths                        → resolve via GET /resolve?path=
 *   other hosts                                     → external (in-app browser)
 */

export const PUBLIC_ID_RE = /^[0-9a-hjkmnp-tv-z]{10}$/;
export const APP_SCHEME = 'goworldnews';

export type TabName = 'home' | 'latest' | 'explore' | 'video' | 'saved';
export type InfoPage = 'about' | 'editorialStandards' | 'privacy' | 'terms';

export type LinkTarget =
  | { kind: 'article'; id: string }
  | { kind: 'auth'; token: string }
  | { kind: 'section'; slug: string }
  | { kind: 'author'; slug: string }
  | { kind: 'topic'; slug: string }
  | { kind: 'tab'; tab: TabName }
  | { kind: 'live' }
  | { kind: 'search'; q?: string }
  | { kind: 'settings' }
  | { kind: 'page'; page: InfoPage }
  | { kind: 'resolve'; path: string }
  | { kind: 'external'; url: string };

export function isPublicId(s: string | null | undefined): s is string {
  return !!s && PUBLIC_ID_RE.test(s);
}

/** `/{section}/{slug}-{id}` (or any path whose last segment ends in `-{id}` or is exactly an id) → id. */
export function articleIdFromPath(path: string): string | null {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '');
  const segs = clean.split('/').filter(Boolean);
  if (segs.length < 2) return null; // a single segment is a section front, never an article
  const last = decodeURIComponent(segs[segs.length - 1]).toLowerCase();
  if (last.length > 11 && last[last.length - 11] === '-') {
    const id = last.slice(-10);
    if (PUBLIC_ID_RE.test(id)) return id;
  }
  return null;
}

const INFO_PAGES: Record<string, InfoPage> = {
  about: 'about',
  standards: 'editorialStandards',
  'editorial-standards': 'editorialStandards',
  privacy: 'privacy',
  terms: 'terms',
};

/** Map a goworld.news website path to an in-app target (no network). */
export function targetFromWebPath(rawPath: string, search = ''): LinkTarget {
  const path = rawPath.split('#')[0] || '/';
  const segs = path.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (segs.length === 0) return { kind: 'tab', tab: 'home' };
  const id = articleIdFromPath(path);
  if (id) return { kind: 'article', id };
  const [first, second] = segs;
  if (segs.length === 1) {
    if (first === 'latest') return { kind: 'tab', tab: 'latest' };
    if (first === 'live') return { kind: 'live' };
    if (first === 'video') return { kind: 'tab', tab: 'video' };
    if (first === 'search') return { kind: 'search', q: params.get('q') ?? undefined };
    if (first === 'saved' || first === 'account') return { kind: 'tab', tab: 'saved' };
    if (INFO_PAGES[first]) return { kind: 'page', page: INFO_PAGES[first] };
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(first)) return { kind: 'section', slug: first };
  }
  if (first === 'live' && segs.length === 2 && second) {
    if (second === 'archive') return { kind: 'live' };
    if (isPublicId(second.toLowerCase())) return { kind: 'article', id: second.toLowerCase() };
  }
  if (segs.length === 2 && second && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(second)) {
    if (first === 'author') return { kind: 'author', slug: second };
    if (first === 'tag' || first === 'topic') return { kind: 'topic', slug: second };
    if (first === 'section') return { kind: 'section', slug: second };
  }
  return { kind: 'resolve', path: segs.length ? `/${segs.join('/')}` : '/' };
}

export interface ParseOptions {
  /** hosts treated as "our website" (goworld.news, www.goworld.news, the dev API host…) */
  hosts: string[];
  scheme?: string;
}

/** Parse any incoming URL (custom scheme, universal link, or a link inside an article). */
export function parseLink(url: string, opts: ParseOptions): LinkTarget | null {
  const scheme = opts.scheme ?? APP_SCHEME;
  const trimmed = (url ?? '').trim();
  if (!trimmed) return null;

  // custom scheme: goworldnews://article/{id}, goworldnews:///article/{id}, goworldnews://auth?token=
  const schemePrefix = `${scheme}:`;
  if (trimmed.toLowerCase().startsWith(schemePrefix)) {
    const rest = trimmed.slice(schemePrefix.length).replace(/^\/+/, '');
    const [pathPart, query = ''] = rest.split('?');
    const segs = pathPart.split('/').filter(Boolean);
    const params = new URLSearchParams(query.split('#')[0]);
    const head = (segs[0] ?? '').toLowerCase();
    if (head === 'auth') {
      const token = params.get('token');
      return token ? { kind: 'auth', token } : null;
    }
    if (head === 'article' && isPublicId(segs[1]?.toLowerCase())) return { kind: 'article', id: segs[1].toLowerCase() };
    if (head === 'live') return isPublicId(segs[1]?.toLowerCase()) ? { kind: 'article', id: segs[1].toLowerCase() } : { kind: 'live' };
    if (head === 'section' && segs[1]) return { kind: 'section', slug: segs[1] };
    if (head === 'author' && segs[1]) return { kind: 'author', slug: segs[1] };
    if ((head === 'topic' || head === 'tag') && segs[1]) return { kind: 'topic', slug: segs[1] };
    if (head === 'settings') return { kind: 'settings' };
    if (head === '' ) return { kind: 'tab', tab: 'home' };
    return targetFromWebPath(`/${segs.join('/')}`, query ? `?${query}` : '');
  }

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    // a bare path such as "/africa/some-story-abc…" (e.g. from an internal href)
    if (trimmed.startsWith('/')) {
      const [p, q = ''] = trimmed.split('?');
      return targetFromWebPath(p, q ? `?${q}` : '');
    }
    return null;
  }
  if (u.protocol === 'mailto:' || u.protocol === 'tel:') return { kind: 'external', url: trimmed };
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { kind: 'external', url: trimmed };
  const host = u.host.toLowerCase();
  const ours = opts.hosts.map((h) => h.toLowerCase());
  if (!ours.includes(host)) return { kind: 'external', url: trimmed };
  // our own API/media/newsletter pages stay on the web
  if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/media/')) return { kind: 'external', url: trimmed };
  if (u.pathname.startsWith('/newsletters') || u.pathname.startsWith('/corrections') || u.pathname.startsWith('/contact') || u.pathname.startsWith('/advertise')) {
    return { kind: 'external', url: trimmed };
  }
  return targetFromWebPath(u.pathname, u.search);
}

/** Expo Router href for a target, or null when it must open outside the router (external / resolve / auth handled by screens). */
export function routeForTarget(t: LinkTarget): string {
  switch (t.kind) {
    case 'article':
      return `/article/${t.id}`;
    case 'auth':
      return `/auth?token=${encodeURIComponent(t.token)}`;
    case 'section':
      return `/section/${t.slug}`;
    case 'author':
      return `/author/${t.slug}`;
    case 'topic':
      return `/topic/${t.slug}`;
    case 'tab':
      return t.tab === 'home' ? '/' : `/${t.tab}`;
    case 'live':
      return '/live';
    case 'search':
      return t.q ? `/explore?q=${encodeURIComponent(t.q)}` : '/explore';
    case 'settings':
      return '/settings';
    case 'page':
      return `/settings/page/${t.page}`;
    case 'resolve':
      return `/link?path=${encodeURIComponent(t.path)}`;
    case 'external':
      return `/link?url=${encodeURIComponent(t.url)}`;
  }
}

/**
 * For `app/+native-intent.tsx`: rewrite an incoming system URL (universal link / custom scheme)
 * to an in-app route. Returns the original path when it already is an app route.
 */
export function rewriteIncomingPath(path: string, opts: ParseOptions): string {
  if (!path) return '/';
  const looksLikeUrl = /^[a-z][a-z0-9+.-]*:/i.test(path);
  if (!looksLikeUrl) {
    // already a router path ("/article/abc…", "article/abc…", "/auth?token=…")
    const p = path.startsWith('/') ? path : `/${path}`;
    if (/^\/(article|section|author|topic|settings|auth|link|latest|explore|video|saved)(\/|\?|$)/.test(p) || p === '/') return p;
    if (/^\/live\/?(\?|$)/.test(p)) return '/live';
    const t = parseLink(p, opts);
    return t ? routeForTarget(t) : p;
  }
  const t = parseLink(path, opts);
  if (!t) return '/';
  return routeForTarget(t);
}
