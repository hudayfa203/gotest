import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

/** Writes PNGs to docs/screenshots/mobile (web preview of the native app at 390×844). */
const OUT = path.resolve(__dirname, '../../../docs/screenshots/mobile');
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

async function settle(page: Page, ms = 1200) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

/** Visible text only: screens lower in the navigation stack stay mounted (hidden) on the web. */
const vis = (page: Page, text: string | RegExp, exact = false) => page.getByText(text, { exact }).filter({ visible: true }).first();

/** Scroll the main (largest visible) scroll container by `px` — virtualised lists render rows as they come into view. */
async function scrollBy(page: Page, px: number) {
  await page.evaluate((dy) => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((e) => e.scrollHeight > e.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.getBoundingClientRect().width > 0 && e.offsetParent !== null);
    els.sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth);
    if (els[0]) els[0].scrollTop += dy; // (element.scrollTo is a no-op on react-native-web scroll views)
  }, px);
  await page.waitForTimeout(450);
}

/** Scroll until `text` is attached, then place it just below the fixed header. */
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
  await page.waitForTimeout(1300); // let lazily-loaded images arrive
}

test.describe('light', () => {
  test.use({ colorScheme: 'light' });

  test('home', async ({ page }) => {
    await page.goto('/');
    await expect(vis(page, 'Top stories')).toBeVisible();
    await settle(page, 1800);
    await shot(page, '01-home-light');
    await scrollTo(page, 'Top stories', 110);
    await shot(page, '01b-home-top-stories-light');
    await scrollTo(page, /^Advertisement$/, 300);
    await shot(page, '01c-home-region-ad-light');
    await scrollTo(page, /^Watch$/, 60);
    await shot(page, '01d-home-video-light');
    await scrollTo(page, 'Opinion & analysis', 60);
    await shot(page, '01e-home-opinion-newsletter-light');
    await scrollTo(page, 'Recent stories', 110);
    await shot(page, '01f-home-trending-podcasts-light');
  });

  test('latest', async ({ page }) => {
    await page.goto('/latest');
    await expect(vis(page, 'Every story, newest first')).toBeVisible();
    await settle(page);
    await shot(page, '03-latest');
  });

  test('explore + search', async ({ page }) => {
    await page.goto('/explore');
    await expect(vis(page, 'Sections')).toBeVisible();
    await settle(page);
    await shot(page, '04a-explore');
    await page.getByLabel('Search stories').fill('port');
    await expect(vis(page, /results? for/)).toBeVisible({ timeout: 15_000 });
    await settle(page);
    await shot(page, '04b-explore-search');
  });

  test('video', async ({ page }) => {
    await page.goto('/video');
    await expect(vis(page, 'Watch and listen')).toBeVisible();
    await settle(page, 1500);
    await shot(page, '05-video');
  });

  test('article: regular', async ({ page }) => {
    await page.goto('/article/a3p8pdt61j');
    await expect(vis(page, 'New direct flights to link three East African capitals')).toBeVisible();
    await settle(page, 1500);
    await shot(page, '06a-article-regular');
    await scrollTo(page, /^By /, 60);
    await shot(page, '06b-article-regular-body');
  });

  test('article: live', async ({ page }) => {
    await page.goto('/article/p68a3knpc3');
    await expect(vis(page, 'Live updates')).toBeVisible({ timeout: 15_000 });
    await settle(page, 1500);
    await shot(page, '07a-article-live');
    await scrollTo(page, 'Live updates', 70);
    await shot(page, '07b-article-live-updates');
  });

  test('article: video', async ({ page }) => {
    await page.goto('/article/g7enk41x1d');
    await expect(page.getByLabel(/Play video/).filter({ visible: true }).first()).toBeVisible();
    await settle(page, 1500);
    await shot(page, '08-article-video');
  });

  test('article: correction', async ({ page }) => {
    await page.goto('/article/ydxp3tgefb');
    await expect(page.getByText('Correction', { exact: true })).toBeAttached({ timeout: 15_000 });
    await settle(page, 1200);
    await scrollTo(page, 'Correction', 220);
    await shot(page, '09-article-correction');
  });

  test('article: every block type (demo showcase)', async ({ page }) => {
    const r = await page.request.get('http://localhost:3100/api/v1/articles?pageSize=50');
    const items: { id: string; headline: string }[] = (await r.json()).items;
    const showcase = items.find((a) => /Block showcase/i.test(a.headline));
    test.skip(!showcase, 'no block-showcase demo article in this database');
    await page.goto(`/article/${showcase!.id}`);
    await expect(vis(page, showcase!.headline)).toBeVisible();
    await settle(page, 1500);
    await scrollTo(page, 'A second-level heading', 90);
    await shot(page, '10a-blocks-text-quote-list');
    await scrollTo(page, 'Numbered steps', 90);
    await shot(page, '10b-blocks-image-table');
    await scrollTo(page, 'Embedded media', 90);
    await shot(page, '10c-blocks-video-embeds');
    await scrollTo(page, 'Related', 90);
    await shot(page, '10d-blocks-related-newsletter');
  });

  test('saved (after saving an article)', async ({ page }) => {
    await page.goto('/article/ydxp3tgefb');
    await expect(vis(page, 'Port upgrade promises faster turnaround for regional shipping')).toBeVisible();
    await settle(page, 800);
    await page.getByLabel('Save for offline reading').filter({ visible: true }).last().click();
    await expect(vis(page, 'Saved offline')).toBeVisible();
    await page.goto('/article/p68a3knpc3');
    await expect(vis(page, 'Live updates')).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Save for offline reading').filter({ visible: true }).last().click();
    await page.goto('/saved');
    await expect(vis(page, 'Swipe left to delete')).toBeVisible();
    await settle(page, 1200);
    await shot(page, '11-saved');

    // airplane mode: the saved copy opens with no network at all
    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    await vis(page, 'Port upgrade promises faster turnaround for regional shipping').click();
    await expect(vis(page, 'Reading the copy saved on this device')).toBeVisible({ timeout: 15_000 });
    await settle(page, 600);
    await shot(page, '11b-saved-article-offline');
    await page.context().setOffline(false);
  });

  test('settings + sign-in', async ({ page }) => {
    await page.goto('/settings');
    await expect(vis(page, 'Sign in with email')).toBeVisible();
    await settle(page);
    await shot(page, '12a-settings');
    await scrollTo(page, 'Appearance', 60);
    await shot(page, '12b-settings-appearance-privacy');
    await page.goto('/settings/sign-in');
    await expect(vis(page, 'Sign in to sync your saved stories')).toBeVisible();
    await page.getByLabel('Email address').fill('reader@example.com');
    await settle(page, 600);
    await shot(page, '13-sign-in');
  });
});

/**
 * States the demo database does not contain, produced by intercepting the API response in the test
 * (never shipped in the app): a 410 withdrawal and a forced "update required" config.
 */
test.describe('simulated API states', () => {
  test.use({ colorScheme: 'light' });

  test('withdrawn article (410) removes the saved copy', async ({ page }) => {
    await page.goto('/article/n4drt3xvd4');
    await expect(page.getByLabel('Save for offline reading').filter({ visible: true }).last()).toBeVisible();
    await page.getByLabel('Save for offline reading').filter({ visible: true }).last().click();
    await expect(vis(page, 'Saved offline')).toBeVisible();
    await page.route('**/api/v1/articles/n4drt3xvd4', (route) =>
      route.fulfill({
        status: 410,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: { code: 'GONE', message: 'Simulated withdrawal notice (test only).', requestId: '' },
          tombstone: { id: 'n4drt3xvd4', state: 'withdrawn', withdrawnAt: new Date().toISOString(), notice: 'Simulated withdrawal notice (test only): this article was withdrawn by the editors.' },
        }),
      }),
    );
    await page.evaluate(() => localStorage.removeItem('gw.query-cache.v1'));
    await page.reload();
    await expect(vis(page, 'This article has been withdrawn')).toBeVisible({ timeout: 15_000 });
    await settle(page, 800);
    await shot(page, '14-article-withdrawn-simulated');
    const saved = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('gw.saved.v1') || '{}')));
    expect(saved).not.toContain('n4drt3xvd4');
  });

  test('update required gate', async ({ page }) => {
    await page.route('**/api/v1/config', async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      await route.fulfill({ response: res, body: JSON.stringify({ ...body, minSupportedAppVersion: '9.0.0' }) });
    });
    await page.goto('/');
    await expect(vis(page, 'Update required')).toBeVisible({ timeout: 15_000 });
    await settle(page, 600);
    await shot(page, '15-update-required-simulated');
  });
});

test.describe('dark', () => {
  test.use({ colorScheme: 'dark' });

  test('home dark', async ({ page }) => {
    await page.goto('/');
    await expect(vis(page, 'Top stories')).toBeVisible();
    await settle(page, 1800);
    await shot(page, '02-home-dark');
    await scrollTo(page, 'Top stories', 110);
    await shot(page, '02b-home-dark-top-stories');
  });

  test('article dark', async ({ page }) => {
    await page.goto('/article/a3p8pdt61j');
    await expect(vis(page, 'New direct flights to link three East African capitals')).toBeVisible();
    await settle(page, 1500);
    await scrollTo(page, /^By /, 60);
    await shot(page, '06c-article-dark');
  });
});
