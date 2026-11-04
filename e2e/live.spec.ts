import { expect, test, type Page, type Route } from '@playwright/test';
import path from 'node:path';

/**
 * LIVE UPDATES visual check (web preview of the native app). Screenshots → docs/screenshots/mobile/live-*.png.
 * Demo data: LIVE p68a3knpc3, ENDED xv17qcd8fd, ARCHIVED z3h1gw5b2e, plus one ordinary breaking alert.
 * Tests in "simulated" blocks modify API responses in the test only (never in the app) to show states the demo
 * database cannot produce on demand (a new/edited/removed update arriving, coverage ending while open, nothing live).
 */
const OUT = path.resolve(__dirname, '../../../docs/screenshots/mobile');
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
const LIVE = 'p68a3knpc3';
const ENDED = 'xv17qcd8fd';
const ARCHIVED = 'z3h1gw5b2e';

async function settle(page: Page, ms = 1200) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}
const vis = (page: Page, text: string | RegExp, exact = false) => page.getByText(text, { exact }).filter({ visible: true }).first();

async function scrollBy(page: Page, px: number) {
  await page.evaluate((dy) => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((e) => e.scrollHeight > e.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.getBoundingClientRect().width > 0 && e.offsetParent !== null);
    els.sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth);
    if (els[0]) els[0].scrollTop += dy;
  }, px);
  await page.waitForTimeout(450);
}
async function scrollTo(page: Page, text: string | RegExp, offset = 130) {
  for (let i = 0; i < 25 && (await page.getByText(text).filter({ visible: true }).count()) === 0; i++) await scrollBy(page, 600);
  const el = vis(page, text);
  await el.waitFor({ state: 'attached' });
  await el.evaluate((node, off) => {
    let p: HTMLElement | null = node.parentElement;
    while (p && !(p.scrollHeight > p.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
    if (!p) return;
    const top = (node as HTMLElement).getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop;
    p.scrollTop = Math.max(0, top - (off as number));
  }, offset);
  await page.waitForTimeout(1300);
}
const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test.describe('live — light', () => {
  test.use({ colorScheme: 'light' });

  test('home: LIVE UPDATES entry under the breaking banner → Live hub', async ({ page }) => {
    await page.goto('/');
    await expect(vis(page, 'Live updates')).toBeVisible({ timeout: 15_000 });
    await expect(vis(page, /^Breaking/)).toBeVisible();
    await settle(page, 1800);
    await shot(page, 'live-01-home-entry-light');
    await page.getByRole('link', { name: /^Live updates\./ }).filter({ visible: true }).first().click();
    await expect(vis(page, 'Live now')).toBeVisible({ timeout: 15_000 });
  });

  test('Live hub: live now, recently ended, archive', async ({ page }) => {
    await page.goto('/live');
    await expect(vis(page, 'Live now')).toBeVisible({ timeout: 15_000 });
    await expect(vis(page, 'Recently ended')).toBeVisible();
    await settle(page, 1500);
    await shot(page, 'live-03-hub');
    await scrollTo(page, /^Archive$/, 90);
    await shot(page, 'live-04-hub-archive');
  });

  test('coverage: live', async ({ page }) => {
    await page.goto(`/article/${LIVE}`);
    await expect(vis(page, 'Live updates')).toBeVisible({ timeout: 15_000 });
    await expect(vis(page, /^Live · updated .* ago$/)).toBeVisible();
    await settle(page, 1500);
    await shot(page, 'live-05-coverage-live');
    await scrollTo(page, 'Live updates', 70);
    await shot(page, 'live-06-coverage-live-updates');
    await scrollTo(page, 'Related coverage', 160);
    await shot(page, 'live-07-coverage-related');
  });

  test('coverage: ended', async ({ page }) => {
    await page.goto(`/article/${ENDED}`);
    await expect(vis(page, 'This live coverage has ended')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/^Auto-refresh/).filter({ visible: true })).toHaveCount(0);
    await settle(page, 1500);
    await shot(page, 'live-08-coverage-ended');
    await scrollTo(page, 'Live updates', 70);
    await shot(page, 'live-09-coverage-ended-updates');
  });

  test('coverage: archived', async ({ page }) => {
    await page.goto(`/article/${ARCHIVED}`);
    await expect(vis(page, 'From the live archive')).toBeVisible({ timeout: 15_000 });
    await settle(page, 1500);
    await scrollTo(page, 'From the live archive', 260);
    await shot(page, 'live-10-coverage-archived');
  });

  test('saved live coverage shows its last fetched updates offline (never as LIVE)', async ({ page }) => {
    await page.goto(`/article/${LIVE}`);
    await expect(vis(page, 'Live updates')).toBeVisible({ timeout: 15_000 });
    await expect(vis(page, 'Afternoon session')).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Save for offline reading').filter({ visible: true }).last().click();
    await expect(vis(page, 'Saved offline')).toBeVisible();
    await expect.poll(() => page.evaluate((id) => !!JSON.parse(localStorage.getItem('gw.saved.v1') || '{}')[id]?.live?.updates?.length, LIVE), { timeout: 10_000 }).toBe(true);
    // only the saved copy may remain: drop the persisted query cache, then open from the Saved tab with no network
    await page.evaluate(() => localStorage.removeItem('gw.query-cache.v1'));
    await page.goto('/saved');
    await expect(vis(page, 'Swipe left to delete')).toBeVisible();
    await page.evaluate(() => localStorage.removeItem('gw.query-cache.v1'));
    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    await vis(page, 'Live: regional transport forum, day one').click();
    await expect(vis(page, /^Not refreshed since/)).toBeVisible({ timeout: 15_000 });
    await expect(vis(page, 'Afternoon session')).toBeAttached();
    await settle(page, 600);
    await shot(page, 'live-15-coverage-saved-offline');
    await page.context().setOffline(false);
  });
});

test.describe('live — dark', () => {
  test.use({ colorScheme: 'dark' });

  test('home entry dark', async ({ page }) => {
    await page.goto('/');
    await expect(vis(page, 'Live updates')).toBeVisible({ timeout: 15_000 });
    await settle(page, 1800);
    await shot(page, 'live-02-home-entry-dark');
  });

  test('hub + coverage dark', async ({ page }) => {
    await page.goto('/live');
    await expect(vis(page, 'Live now')).toBeVisible({ timeout: 15_000 });
    await settle(page, 3000); // let the lead image finish its fade-in
    await shot(page, 'live-03b-hub-dark');
    await page.goto(`/article/${LIVE}`);
    await expect(vis(page, 'Live updates')).toBeVisible({ timeout: 15_000 });
    await settle(page, 1200);
    await scrollTo(page, 'Live updates', 70);
    await shot(page, 'live-06b-coverage-live-updates-dark');
  });
});

test.describe('live — simulated API states (test only)', () => {
  test.use({ colorScheme: 'light' });

  test('incremental refresh: new + edited + removed updates, "new updates" pill', async ({ page }) => {
    let polls = 0;
    await page.route(new RegExp(`/api/v1/live/${LIVE}\\?since=`), async (route) => {
      polls++;
      const res = await route.fetch();
      const body = await res.json();
      if (polls === 1) {
        const full = await (await page.request.get(`http://localhost:3100/api/v1/live/${LIVE}`)).json();
        const edited = full.updates.find((u: { headline?: string }) => u.headline === 'Shared ticketing proposal');
        const removed = full.updates.find((u: { headline?: string }) => u.headline === 'Forum opens');
        body.updates = [
          {
            id: 'sim-new-1', articleId: LIVE, at: body.serverTime, pinned: false, headline: 'Delegates tour the new rail depot (simulated in the visual test)',
            body: [
              { type: 'paragraph', children: [{ type: 'text', text: 'This update was injected by the visual test to show how a new update with a photo and a link arrives. ' }, { type: 'link', href: 'https://goworld.news/africa/new-direct-flights-to-link-three-east-african-capitals-a3p8pdt61j', text: 'Related: new direct flights' }] },
              { type: 'image', image: { ...full.coverage.image, caption: 'Illustration (demo image)', credit: 'GO World News' } },
            ],
            author: { name: 'Maria Santos', slug: 'maria-santos-demo' },
          },
          ...(edited ? [{ ...edited, updatedAt: body.serverTime, body: [{ type: 'paragraph', children: [{ type: 'text', text: 'Delegates are discussing a single ticket valid on buses and trains across borders. (Edited by the visual test to show the “Edited” marker.)' }] }] }] : []),
        ];
        body.removedIds = removed ? [removed.id] : [];
        body.coverage = { ...body.coverage, updateCount: body.coverage.updateCount, lastUpdateAt: body.serverTime };
      }
      await json(route, body);
    });
    await page.goto(`/article/${LIVE}`);
    await expect(vis(page, 'Forum opens')).toBeVisible({ timeout: 15_000 });
    await settle(page, 800);
    // read further down: below the top of the feed, a pill announces new updates instead of moving the text
    await scrollTo(page, 'Forum opens', 300);
    await expect(vis(page, '1 new update')).toBeVisible({ timeout: 35_000 });
    await page.waitForTimeout(500);
    await shot(page, 'live-11-coverage-new-updates-pill-simulated');
    await vis(page, '1 new update').click();
    await page.waitForTimeout(1500);
    await expect(vis(page, /Delegates tour the new rail depot/)).toBeVisible();
    await expect(page.getByText('Forum opens')).toHaveCount(0);
    await shot(page, 'live-12-coverage-new-update-simulated');
    await scrollTo(page, 'Shared ticketing proposal', 140);
    await expect(vis(page, /^Edited /)).toBeVisible();
    await shot(page, 'live-12b-coverage-edited-update-simulated');
  });

  test('coverage ends while open: polling stops, banner switches to ENDED', async ({ page }) => {
    let ended = false;
    let pollsAfterEnd = 0;
    await page.route(new RegExp(`/api/v1/live/${LIVE}\\?since=`), async (route) => {
      if (ended) pollsAfterEnd++;
      const res = await route.fetch();
      const body = await res.json();
      body.coverage = { ...body.coverage, state: 'ended', endedAt: body.serverTime };
      ended = true;
      await json(route, body);
    });
    await page.goto(`/article/${LIVE}`);
    await expect(vis(page, /^Live · updated .* ago$/)).toBeVisible({ timeout: 15_000 });
    await expect(vis(page, 'This live coverage has ended')).toBeVisible({ timeout: 35_000 });
    await scrollTo(page, 'This live coverage has ended', 300);
    await shot(page, 'live-13-coverage-ended-while-open-simulated');
    await page.waitForTimeout(23_000);
    expect(pollsAfterEnd).toBe(0);
  });

  test('home with nothing live: no LIVE UPDATES entry, the breaking alert stays', async ({ page }) => {
    await page.route('**/api/v1/home', async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      await json(route, { ...body, liveNow: [] });
    });
    await page.goto('/');
    await expect(vis(page, /^Breaking/)).toBeVisible({ timeout: 15_000 });
    await settle(page, 1500);
    await expect(page.getByText('Live updates', { exact: true }).filter({ visible: true })).toHaveCount(0);
    await shot(page, 'live-14-home-nothing-live-simulated');
  });

  test('Live hub with nothing live (honest empty state)', async ({ page }) => {
    await page.route('**/api/v1/live', async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      await json(route, { ...body, active: [] });
    });
    await page.goto('/live');
    await expect(vis(page, 'Nothing is live right now')).toBeVisible({ timeout: 15_000 });
    await settle(page, 1200);
    await shot(page, 'live-14b-hub-nothing-live-simulated');
  });
});

test.describe('live — tablet 820×1180', () => {
  test.use({ colorScheme: 'light', viewport: { width: 820, height: 1180 } });

  test('tablet hub + coverage', async ({ page }) => {
    await page.goto('/');
    await expect(vis(page, 'Live updates')).toBeVisible({ timeout: 15_000 });
    await settle(page, 1500);
    await shot(page, 'live-16-tablet-home-entry');
    await page.goto('/live');
    await expect(vis(page, 'Live now')).toBeVisible({ timeout: 15_000 });
    await settle(page, 1500);
    await shot(page, 'live-17-tablet-hub');
    await page.goto(`/article/${LIVE}`);
    await expect(vis(page, 'Live updates')).toBeVisible({ timeout: 15_000 });
    await settle(page, 1200);
    await scrollTo(page, /^Live · updated .* ago$/, 120);
    await shot(page, 'live-18-tablet-coverage');
  });
});
