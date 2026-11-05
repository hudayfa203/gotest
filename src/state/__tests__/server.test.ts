import { createApiClient } from '../../api/client';
import { checkServer, normalizeApiUrl } from '../server';

describe('normalizeApiUrl (test-build server setting)', () => {
  it('adds https:// and /api/v1 to a bare host', () => {
    expect(normalizeApiUrl('staging.example.com')).toEqual({ ok: true, url: 'https://staging.example.com/api/v1' });
    expect(normalizeApiUrl('  https://staging.example.com/  ')).toEqual({ ok: true, url: 'https://staging.example.com/api/v1' });
  });
  it('keeps an explicit API path and port', () => {
    expect(normalizeApiUrl('https://x.example.com:8443/api/v1/')).toEqual({ ok: true, url: 'https://x.example.com:8443/api/v1' });
    expect(normalizeApiUrl('https://x.example.com/news/api/v2')).toEqual({ ok: true, url: 'https://x.example.com/news/api/v2' });
  });
  it('rejects http, empty, junk and query strings', () => {
    expect(normalizeApiUrl('http://staging.example.com').ok).toBe(false);
    expect(normalizeApiUrl('').ok).toBe(false);
    expect(normalizeApiUrl('localhost').ok).toBe(false);
    expect(normalizeApiUrl('https://x.example.com/api/v1?debug=1').ok).toBe(false);
    expect(normalizeApiUrl('ftp://x.example.com').ok).toBe(false);
  });
});

describe('checkServer', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  it('accepts a server whose /config looks like Garowe World', async () => {
    globalThis.fetch = jest.fn(async () => new Response(JSON.stringify({ siteName: 'Garowe World', tagline: 'Breaking News. Beyond Borders.' }), { status: 200 })) as typeof fetch;
    const r = await checkServer('https://s.example.com/api/v1');
    expect(r.ok).toBe(true);
    expect((globalThis.fetch as jest.Mock).mock.calls[0][0]).toBe('https://s.example.com/api/v1/config');
  });
  it('reports HTTP errors and foreign servers honestly', async () => {
    globalThis.fetch = jest.fn(async () => new Response('nope', { status: 404 })) as typeof fetch;
    expect(await checkServer('https://s.example.com/api/v1')).toMatchObject({ ok: false, message: expect.stringContaining('404') });
    globalThis.fetch = jest.fn(async () => new Response(JSON.stringify({ hello: 'world' }), { status: 200 })) as typeof fetch;
    expect(await checkServer('https://s.example.com/api/v1')).toMatchObject({ ok: false });
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    expect(await checkServer('https://s.example.com/api/v1')).toMatchObject({ ok: false, message: expect.stringContaining('Could not connect') });
  });
});

describe('api client base URL', () => {
  it('reads a function base URL on every request, so a server switch applies immediately', async () => {
    let base = 'https://a.example.com/api/v1';
    const f = jest.fn(async () => new Response('{}', { status: 200 }));
    const api = createApiClient({ baseUrl: () => base, fetch: f as unknown as typeof fetch });
    await api.request('/home');
    base = 'https://b.example.com/api/v1';
    await api.request('/home');
    expect((f.mock.calls as unknown[][]).map((c) => c[0])).toEqual(['https://a.example.com/api/v1/home', 'https://b.example.com/api/v1/home']);
    expect(api.baseUrl).toBe('https://b.example.com/api/v1');
  });
});
