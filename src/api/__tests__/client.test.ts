import { ApiError, buildUrl, createApiClient, describeError, GoneError, isGone, isNetworkError, NetworkError } from '../client';

type Call = { url: string; init: RequestInit };
function mockFetch(responses: Array<(call: Call) => Response | Promise<Response>>) {
  const calls: Call[] = [];
  let i = 0;
  const fn = jest.fn(async (url: string, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    const r = responses[Math.min(i++, responses.length - 1)];
    return r(call);
  });
  return { fn: fn as unknown as typeof fetch, calls };
}
const json = (status: number, body: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('buildUrl', () => {
  it('joins base, path and non-empty query params', () => {
    expect(buildUrl('https://goworld.news/api/v1/', '/articles', { category: 'africa', cursor: null, pageSize: 20, tag: undefined, q: '' })).toBe('https://goworld.news/api/v1/articles?category=africa&pageSize=20');
    expect(buildUrl('https://x/api/v1', 'search', { q: 'a&b c' })).toBe('https://x/api/v1/search?q=a%26b%20c');
  });
});

describe('headers', () => {
  it('sends only Accept on anonymous GETs (CDN-cacheable, CORS-simple)', async () => {
    const f = mockFetch([() => json(200, { ok: 1 })]);
    const api = createApiClient({ baseUrl: 'https://a/api/v1', fetch: f.fn, getDeviceToken: async () => 'dev', getSessionToken: async () => 'ses' });
    await api.request('/home');
    expect(f.calls[0].init.headers).toEqual({ Accept: 'application/json' });
    expect(f.calls[0].init.method).toBe('GET');
  });
  it('adds X-Device-Token, Bearer session and JSON content type when asked', async () => {
    const f = mockFetch([() => json(200, {})]);
    const api = createApiClient({ baseUrl: 'https://a/api/v1', fetch: f.fn, getDeviceToken: async () => 'dev-1', getSessionToken: async () => 'ses-1' });
    await api.request('/auth/verify', { method: 'POST', body: { token: 't', app: true }, auth: 'device+reader' });
    expect(f.calls[0].init.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json', 'X-Device-Token': 'dev-1', Authorization: 'Bearer ses-1' });
    expect(f.calls[0].init.body).toBe(JSON.stringify({ token: 't', app: true }));
  });
  it('omits auth headers when no token is stored', async () => {
    const f = mockFetch([() => json(200, {})]);
    const api = createApiClient({ baseUrl: 'https://a/api/v1', fetch: f.fn, getDeviceToken: async () => null, getSessionToken: async () => null });
    await api.request('/me', { auth: 'reader' });
    expect(f.calls[0].init.headers).toEqual({ Accept: 'application/json' });
  });
});

describe('responses and error mapping', () => {
  it('returns parsed JSON and undefined for 204', async () => {
    const f = mockFetch([() => json(200, { a: 1 }), () => new Response(null, { status: 204 })]);
    const api = createApiClient({ baseUrl: 'https://a/api/v1', fetch: f.fn });
    await expect(api.request('/x')).resolves.toEqual({ a: 1 });
    await expect(api.request('/y', { method: 'DELETE' })).resolves.toBeUndefined();
  });
  it('maps the error envelope to ApiError with status, code and requestId', async () => {
    const f = mockFetch([() => json(404, { error: { code: 'NOT_FOUND', message: 'Article not found', requestId: 'req-1' } })]);
    const api = createApiClient({ baseUrl: 'https://a/api/v1', fetch: f.fn });
    const e: any = await api.request('/articles/zzzzzzzzzz').catch((x: any) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Article not found', requestId: 'req-1' });
    expect(describeError(e)).toBe('This content could not be found.');
  });
  it('maps 410 to GoneError carrying the tombstone', async () => {
    const tombstone = { id: 'a3p8pdt61j', state: 'withdrawn', withdrawnAt: '2026-11-03T12:00:00Z', notice: 'Withdrawn for legal reasons.' };
    const f = mockFetch([() => json(410, { error: { code: 'GONE', message: 'Withdrawn for legal reasons.', requestId: '' }, tombstone })]);
    const api = createApiClient({ baseUrl: 'https://a/api/v1', fetch: f.fn });
    const e: any = await api.request('/articles/a3p8pdt61j').catch((x: any) => x);
    expect(e).toBeInstanceOf(GoneError);
    expect(isGone(e)).toBe(true);
    expect(e.status).toBe(410);
    expect(e.tombstone).toEqual(tombstone);
  });
  it('rejects a 2xx that is not JSON (captive Wi-Fi page, parked domain, wrong server)', async () => {
    const f = mockFetch([() => new Response('<html><body>Sign in to Wi-Fi</body></html>', { status: 200, headers: { 'Content-Type': 'text/html' } })]);
    const api = createApiClient({ baseUrl: 'https://a/api/v1', fetch: f.fn });
    const err = (await api.request('/home').catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('INVALID_RESPONSE');
    expect(describeError(err)).toMatch(/not GO World News data/);
  });
  it('handles non-JSON error bodies', async () => {
    const f = mockFetch([() => new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' })]);
    const api = createApiClient({ baseUrl: 'https://a/api/v1', fetch: f.fn });
    const e: any = await api.request('/home').catch((x: any) => x);
    expect(e).toMatchObject({ status: 502, code: 'HTTP_502' });
    expect(describeError(e)).toMatch(/having a problem/);
  });
  it('wraps fetch failures as NetworkError', async () => {
    const f = mockFetch([() => Promise.reject(new TypeError('Network request failed'))]);
    const api = createApiClient({ baseUrl: 'https://a/api/v1', fetch: f.fn });
    const e: any = await api.request('/home').catch((x: any) => x);
    expect(e).toBeInstanceOf(NetworkError);
    expect(isNetworkError(e)).toBe(true);
    expect(describeError(e)).toMatch(/offline/);
  });
  it('times out slow requests', async () => {
    const f = mockFetch([({ init }) => new Promise<Response>((_res, rej) => init.signal?.addEventListener('abort', () => rej(new Error('aborted'))))]);
    const api = createApiClient({ baseUrl: 'https://a/api/v1', fetch: f.fn, defaultTimeoutMs: 20 });
    const e: any = await api.request('/home').catch((x: any) => x);
    expect(e).toBeInstanceOf(NetworkError);
    expect(e.timedOut).toBe(true);
  });
});

describe('device re-registration', () => {
  it('re-registers once on 401 for device endpoints and retries with the fresh token', async () => {
    const f = mockFetch([() => json(401, { error: { code: 'UNAUTHORIZED', message: 'A valid device token is required', requestId: 'r' } }), () => json(200, { notificationsEnabled: true })]);
    const onDeviceUnauthorized = jest.fn(async () => 'fresh-token');
    const api = createApiClient({ baseUrl: 'https://a/api/v1', fetch: f.fn, getDeviceToken: async () => 'stale', onDeviceUnauthorized });
    await expect(api.request('/devices/me/preferences', { auth: 'device' })).resolves.toEqual({ notificationsEnabled: true });
    expect(onDeviceUnauthorized).toHaveBeenCalledTimes(1);
    expect((f.calls[1].init.headers as Record<string, string>)['X-Device-Token']).toBe('fresh-token');
  });
  it('does not retry reader 401s', async () => {
    const f = mockFetch([() => json(401, { error: { code: 'UNAUTHORIZED', message: 'Sign in required', requestId: 'r' } })]);
    const onDeviceUnauthorized = jest.fn(async () => 'x');
    const api = createApiClient({ baseUrl: 'https://a/api/v1', fetch: f.fn, getSessionToken: async () => 'old', onDeviceUnauthorized });
    await expect(api.request('/me/bookmarks', { auth: 'reader' })).rejects.toMatchObject({ status: 401 });
    expect(onDeviceUnauthorized).not.toHaveBeenCalled();
  });
});
