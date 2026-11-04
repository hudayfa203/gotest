import { __demo, DEMO_CAPTURED_AT, demoFetch } from '..';

const get = async (path: string) => {
  const r = await demoFetch(`https://goworld.news/api/v1${path}`);
  return { status: r.status, body: r.status === 204 ? null : await r.json() };
};

describe('built-in demo content', () => {
  beforeEach(() => __demo.resetClock());

  it('contains only demonstration items', () => {
    const { snap } = __demo;
    expect(snap.summaries.length).toBeGreaterThanOrEqual(20);
    expect(snap.summaries.every((s: { isDemo: boolean }) => s.isDemo)).toBe(true);
    expect(snap.home.breaking.every((b: { headline: string; isDemo: boolean }) => b.isDemo && b.headline.startsWith('Demo:'))).toBe(true);
    expect(JSON.stringify(snap)).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  it('shifts every timestamp so the snapshot looks current', async () => {
    const { body } = await get('/home');
    expect(Math.abs(Date.parse(body.generatedAt) - Date.now())).toBeLessThan(5_000);
    expect(body.breaking.length).toBeGreaterThanOrEqual(2);
    expect(body.liveNow.length).toBeGreaterThanOrEqual(2);
    const shift = Date.now() - Date.parse(DEMO_CAPTURED_AT);
    const original = __demo.snap.home.liveNow[0].lastUpdateAt;
    expect(Math.abs(Date.parse(body.liveNow[0].lastUpdateAt) - (Date.parse(original) + shift))).toBeLessThan(5_000);
  });

  it('pages, filters and searches articles like the API', async () => {
    const all = await get('/articles?pageSize=10');
    expect(all.body.items).toHaveLength(10);
    expect(all.body.nextCursor).toBe('10');
    const next = await get('/articles?pageSize=10&cursor=10');
    expect(next.body.items[0].id).not.toBe(all.body.items[0].id);
    const africa = await get('/articles?category=africa');
    expect(africa.body.items.length).toBeGreaterThan(0);
    const video = await get('/articles?type=video');
    expect(video.body.items.every((s: { type: string }) => s.type === 'video')).toBe(true);
    const found = await get('/search?q=port&pageSize=20');
    expect(found.body.total).toBeGreaterThan(0);
    expect(found.body.items[0].headline.toLowerCase()).toContain('port');
    expect((await get('/search?q=zzzz-nothing')).body.total).toBe(0);
  });

  it('serves full articles, live feeds (incremental polls are empty) and resolves paths', async () => {
    const id = __demo.snap.summaries[0].id;
    const a = await get(`/articles/${id}`);
    expect(a.body.id).toBe(id);
    expect(Array.isArray(a.body.body)).toBe(true);
    const liveId = __demo.snap.liveHub.active[0].id;
    const feed = await get(`/live/${liveId}`);
    expect(feed.body.updates.length).toBeGreaterThan(0);
    const poll = await get(`/live/${liveId}?since=${encodeURIComponent(feed.body.serverTime)}`);
    expect(poll.body.updates).toEqual([]);
    expect((await get(`/resolve?path=${encodeURIComponent(a.body.path)}`)).body).toMatchObject({ kind: 'article', articleId: id });
    expect((await get('/articles/nope')).status).toBe(404);
  });

  it('never pretends to have a server for device, account or notification features', async () => {
    for (const [method, path] of [['POST', '/devices'], ['GET', '/devices/me/preferences'], ['POST', '/auth/request'], ['GET', '/me/bookmarks']]) {
      const r = await demoFetch(`https://goworld.news/api/v1${path}`, { method });
      expect(r.status).toBe(403);
      expect((await r.json()).error.code).toBe('DEMO_CONTENT');
    }
    const ev = await demoFetch('https://goworld.news/api/v1/events', { method: 'POST' });
    expect(await ev.json()).toEqual({ accepted: 0 });
  });

  it('points media at bundled files', async () => {
    const { body } = await get('/home');
    expect(JSON.stringify(body)).not.toContain('gwdemo-media:');
  });
});
