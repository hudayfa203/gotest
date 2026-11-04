import { articleIdFromPath, isPublicId, parseLink, rewriteIncomingPath, routeForTarget, targetFromWebPath } from '../deeplink';

const opts = { hosts: ['goworld.news', 'www.goworld.news', 'localhost:3100'] };

describe('articleIdFromPath', () => {
  it('takes the last 10 chars of the last segment after a hyphen', () => {
    expect(articleIdFromPath('/africa/new-direct-flights-to-link-three-east-african-capitals-a3p8pdt61j')).toBe('a3p8pdt61j');
    expect(articleIdFromPath('/podcasts/the-world-briefing-episode-1-demo-4qpm60nrjy')).toBe('4qpm60nrjy');
    expect(articleIdFromPath('/podcasts/series-slug/episode-one-4qpm60nrjy/')).toBe('4qpm60nrjy');
  });
  it('rejects section fronts, non-Crockford ids and missing separators', () => {
    expect(articleIdFromPath('/africa')).toBeNull();
    expect(articleIdFromPath('/africa/some-story-A3P8PDT61J')).toBe('a3p8pdt61j'); // URLs are case-insensitive
    expect(articleIdFromPath('/africa/some-story-uuuuuuuuuu')).toBeNull(); // u is not Crockford base32
    expect(articleIdFromPath('/africa/storya3p8pdt61j')).toBeNull();
  });
  it('ignores query strings and fragments', () => {
    expect(articleIdFromPath('/world/live-forum-p68a3knpc3?utm=x#update-3')).toBe('p68a3knpc3');
  });
});

describe('parseLink', () => {
  it('parses custom-scheme article and auth links', () => {
    expect(parseLink('goworldnews://article/a3p8pdt61j', opts)).toEqual({ kind: 'article', id: 'a3p8pdt61j' });
    expect(parseLink('goworldnews:///article/a3p8pdt61j', opts)).toEqual({ kind: 'article', id: 'a3p8pdt61j' });
    expect(parseLink('goworldnews://auth?token=abc123xyz789', opts)).toEqual({ kind: 'auth', token: 'abc123xyz789' });
    expect(parseLink('goworldnews://auth', opts)).toBeNull();
  });
  it('parses universal links to articles, sections, authors and topics', () => {
    expect(parseLink('https://goworld.news/africa/new-direct-flights-a3p8pdt61j', opts)).toEqual({ kind: 'article', id: 'a3p8pdt61j' });
    expect(parseLink('https://www.goworld.news/video/watch-wave-energy-g7enk41x1d', opts)).toEqual({ kind: 'article', id: 'g7enk41x1d' });
    expect(parseLink('https://goworld.news/africa', opts)).toEqual({ kind: 'section', slug: 'africa' });
    expect(parseLink('https://goworld.news/author/amina-warsame-demo', opts)).toEqual({ kind: 'author', slug: 'amina-warsame-demo' });
    expect(parseLink('https://goworld.news/tag/transport', opts)).toEqual({ kind: 'topic', slug: 'transport' });
    expect(parseLink('https://goworld.news/', opts)).toEqual({ kind: 'tab', tab: 'home' });
    expect(parseLink('https://goworld.news/video', opts)).toEqual({ kind: 'tab', tab: 'video' });
    expect(parseLink('https://goworld.news/search?q=ports', opts)).toEqual({ kind: 'search', q: 'ports' });
    expect(parseLink('https://goworld.news/standards', opts)).toEqual({ kind: 'page', page: 'editorialStandards' });
  });
  it('sends unknown site paths to /resolve and other hosts to the browser', () => {
    expect(parseLink('https://goworld.news/2019/old/story/path', opts)).toEqual({ kind: 'resolve', path: '/2019/old/story/path' });
    expect(parseLink('https://example.com/a/b-a3p8pdt61j', opts)).toEqual({ kind: 'external', url: 'https://example.com/a/b-a3p8pdt61j' });
    expect(parseLink('https://goworld.news/newsletters', opts)).toEqual({ kind: 'external', url: 'https://goworld.news/newsletters' });
    expect(parseLink('https://goworld.news/media/2026/11/x.jpg', opts)?.kind).toBe('external');
    expect(parseLink('mailto:tips@goworld.news', opts)).toEqual({ kind: 'external', url: 'mailto:tips@goworld.news' });
  });
  it('treats the configured API host as our site (development)', () => {
    expect(parseLink('http://localhost:3100/world/live-forum-p68a3knpc3', opts)).toEqual({ kind: 'article', id: 'p68a3knpc3' });
  });
  it('handles bare paths and garbage', () => {
    expect(parseLink('/africa/a-story-a3p8pdt61j', opts)).toEqual({ kind: 'article', id: 'a3p8pdt61j' });
    expect(parseLink('', opts)).toBeNull();
    expect(parseLink('not a url', opts)).toBeNull();
  });
});

describe('routes', () => {
  it('maps targets to Expo Router hrefs', () => {
    expect(routeForTarget({ kind: 'article', id: 'a3p8pdt61j' })).toBe('/article/a3p8pdt61j');
    expect(routeForTarget({ kind: 'auth', token: 'a b' })).toBe('/auth?token=a%20b');
    expect(routeForTarget({ kind: 'tab', tab: 'home' })).toBe('/');
    expect(routeForTarget({ kind: 'tab', tab: 'latest' })).toBe('/latest');
    expect(routeForTarget({ kind: 'resolve', path: '/x/y' })).toBe('/link?path=%2Fx%2Fy');
    expect(routeForTarget({ kind: 'page', page: 'privacy' })).toBe('/settings/page/privacy');
  });
  it('rewrites incoming system paths for +native-intent', () => {
    expect(rewriteIncomingPath('https://goworld.news/africa/new-direct-flights-a3p8pdt61j', opts)).toBe('/article/a3p8pdt61j');
    expect(rewriteIncomingPath('goworldnews://article/a3p8pdt61j', opts)).toBe('/article/a3p8pdt61j');
    expect(rewriteIncomingPath('goworldnews://auth?token=tok_123', opts)).toBe('/auth?token=tok_123');
    expect(rewriteIncomingPath('/article/a3p8pdt61j', opts)).toBe('/article/a3p8pdt61j');
    expect(rewriteIncomingPath('article/a3p8pdt61j', opts)).toBe('/article/a3p8pdt61j');
    expect(rewriteIncomingPath('/africa/new-direct-flights-a3p8pdt61j', opts)).toBe('/article/a3p8pdt61j');
    expect(rewriteIncomingPath('https://goworld.news/2019/old/path', opts)).toBe('/link?path=%2F2019%2Fold%2Fpath');
    expect(rewriteIncomingPath('', opts)).toBe('/');
  });
  it('targetFromWebPath handles nav hrefs from GET /navigation', () => {
    expect(targetFromWebPath('/science-health')).toEqual({ kind: 'section', slug: 'science-health' });
    expect(isPublicId('a3p8pdt61j')).toBe(true);
    expect(isPublicId('A3P8PDT61J')).toBe(false);
  });
});

describe('live coverage links', () => {
  it('opens the Live hub for /live, /live/archive and goworldnews://live', () => {
    expect(parseLink('https://goworld.news/live', opts)).toEqual({ kind: 'live' });
    expect(parseLink('https://goworld.news/live/archive?cursor=abc', opts)).toEqual({ kind: 'live' });
    expect(parseLink('goworldnews://live', opts)).toEqual({ kind: 'live' });
    expect(routeForTarget({ kind: 'live' })).toBe('/live');
    expect(rewriteIncomingPath('https://goworld.news/live', opts)).toBe('/live');
    expect(rewriteIncomingPath('goworldnews://live', opts)).toBe('/live');
    expect(rewriteIncomingPath('/live', opts)).toBe('/live');
  });
  it('opens one live coverage (article URL, goworldnews://live/{id}, /live/{id}) on the coverage screen', () => {
    expect(rewriteIncomingPath('https://goworld.news/world/live-regional-transport-forum-day-one-p68a3knpc3', opts)).toBe('/article/p68a3knpc3');
    expect(parseLink('goworldnews://live/p68a3knpc3', opts)).toEqual({ kind: 'article', id: 'p68a3knpc3' });
    expect(rewriteIncomingPath('goworldnews://live/p68a3knpc3', opts)).toBe('/article/p68a3knpc3');
    expect(rewriteIncomingPath('/live/p68a3knpc3', opts)).toBe('/article/p68a3knpc3');
    expect(rewriteIncomingPath('https://goworld.news/live/p68a3knpc3', opts)).toBe('/article/p68a3knpc3');
  });
});
