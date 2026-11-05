import { withInlineAd } from '../../components/article/ArticleExtras';
import { navRoute } from '../../components/AppHeader';
import { buildHomeRows } from '../home/rows';
import { cluster, project } from '../pulse/projection';
import type { Block, HomepageSection } from '../../types';

const sec = (key: string, layout: HomepageSection['layout'], n = 2): HomepageSection => ({ key, layout, title: key, items: Array.from({ length: n }, (_, i) => ({ id: `${key}${i}` })) } as unknown as HomepageSection);

describe('home rows', () => {
  const sections = [sec('lead', 'lead', 1), sec('top', 'top_stories'), sec('latest', 'latest'), sec('africa', 'region'), sec('inv', 'investigations'), sec('video', 'video'), sec('op', 'opinion'), sec('biz', 'region'), sec('trend', 'trending'), sec('pods', 'podcasts')];
  it('puts the top ad under the lead, World Pulse after Latest, and two mid-feed ads', () => {
    const rows = buildHomeRows(sections, true);
    const keys = rows.map((r) => r.key);
    expect(keys.indexOf('ad-app_home_top')).toBe(keys.indexOf('lead') + 1);
    expect(keys.indexOf('pulse')).toBe(keys.indexOf('latest') + 1);
    expect(keys).toContain('ad-app_feed_3');
    expect(keys).toContain('ad-app_feed_6');
    expect(keys.indexOf('ad-app_feed_3')).toBeLessThan(keys.indexOf('ad-app_feed_6'));
  });
  it('uses editor-placed ad sections instead of default slots, and drops ads when ads are off', () => {
    const withAd = buildHomeRows([...sections.slice(0, 3), sec('slot', 'ad', 0), ...sections.slice(3)], true);
    expect(withAd.filter((r) => r.kind === 'ad').map((r) => (r as { placement: string }).placement)).toEqual(['app_home_top', 'app_feed_3']);
    expect(buildHomeRows(sections, false).some((r) => r.kind === 'ad')).toBe(false);
  });
});

describe('inline article ad', () => {
  const p = (t: string): Block => ({ type: 'paragraph', children: [{ type: 'text', text: t }] } as unknown as Block);
  it('goes after the third paragraph of long enough stories, never twice', () => {
    const body = [p('a'), p('b'), p('c'), p('d'), p('e')];
    const out = withInlineAd(body);
    expect(out[3]).toEqual({ type: 'ad_slot', slot: 'app_article_inline_1' });
    expect(withInlineAd(out)).toBe(out);
    expect(withInlineAd([p('a'), p('b')])).toHaveLength(2);
  });
});

describe('navigation routes', () => {
  it('maps website menu links to app screens', () => {
    expect(navRoute('/africa')).toBe('/section/africa');
    expect(navRoute('https://goworld.news/world/')).toBe('/section/world');
    expect(navRoute('/latest')).toBe('/latest');
    expect(navRoute('/live')).toBe('/live');
    expect(navRoute('/podcasts')).toBe('/video');
    expect(navRoute('/about/team')).toBe('/link?path=%2Fabout%2Fteam');
  });
});

describe('World Pulse map', () => {
  it('projects like the website (Equal Earth, values from d3-geo)', () => {
    expect(project(45.3, 2.04)).toEqual({ x: expect.closeTo(625.8, 1), y: expect.closeTo(233.76, 1) });
    expect(project(-74, 40.7)).toEqual({ x: expect.closeTo(318.62, 1), y: expect.closeTo(96.04, 1) });
  });
  it('clusters markers that would overlap', () => {
    const c = cluster([{ x: 10, y: 10, item: 'a' }, { x: 14, y: 12, item: 'b' }, { x: 200, y: 100, item: 'c' }], 20);
    expect(c.map((x) => x.items)).toEqual([['a', 'b'], ['c']]);
  });
});
