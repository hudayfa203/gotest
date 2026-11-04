import {
  aspectRatio, blocksToPlainText, countNewUpdates, embedLabel, headingSize, inlineText, linkAction, listMarker, markStyle, mergeLiveUpdates,
  newestUpdateAt, pickImageUrl, relatedIds, tableColumnWidths, videoSource,
} from '../blocks';
import type { Block, LiveUpdate } from '../../types';

const opts = { hosts: ['goworld.news', 'www.goworld.news'] };

describe('inline marks and text', () => {
  it('maps marks to style flags', () => {
    expect(markStyle(['bold', 'italic'])).toMatchObject({ bold: true, italic: true, underline: false, code: false });
    expect(markStyle(undefined)).toMatchObject({ bold: false, italic: false });
  });
  it('flattens inline children', () => {
    expect(inlineText([{ type: 'text', text: 'Hello ' }, { type: 'link', href: 'https://x.y', text: 'world' }, { type: 'linebreak' }, { type: 'text', text: '!' }])).toBe('Hello world\n!');
  });
});

describe('linkAction (tappable links inside articles)', () => {
  it('opens editor-marked internal articles in-app', () => {
    expect(linkAction({ href: 'https://goworld.news/anything', internalArticleId: 'a3p8pdt61j' }, opts)).toEqual({ kind: 'article', id: 'a3p8pdt61j' });
  });
  it('recognises goworld.news article URLs', () => {
    expect(linkAction({ href: 'https://goworld.news/africa/port-upgrade-ydxp3tgefb' }, opts)).toEqual({ kind: 'article', id: 'ydxp3tgefb' });
  });
  it('routes other goworld.news pages in-app or via /resolve', () => {
    expect(linkAction({ href: 'https://goworld.news/tag/transport' }, opts)).toEqual({ kind: 'in-app', target: { kind: 'topic', slug: 'transport' } });
    expect(linkAction({ href: 'https://goworld.news/2020/01/old-story' }, opts)).toEqual({ kind: 'resolve', path: '/2020/01/old-story' });
  });
  it('opens external links in the in-app browser and never acts on auth links in content', () => {
    expect(linkAction({ href: 'https://www.un.org/report' }, opts)).toEqual({ kind: 'external', url: 'https://www.un.org/report' });
    expect(linkAction({ href: 'goworldnews://auth?token=stolen' }, opts)).toEqual({ kind: 'external', url: 'goworldnews://auth?token=stolen' });
  });
});

describe('images', () => {
  const img = {
    url: 'https://m/x.jpg', width: 1600, height: 900,
    variants: [
      { width: 960, url: 'https://m/x-960.webp', format: 'webp' as const },
      { width: 480, url: 'https://m/x-480.webp', format: 'webp' as const },
      { width: 480, url: 'https://m/x-480.avif', format: 'avif' as const },
    ],
  };
  it('picks the smallest variant that covers the target width (no avif)', () => {
    expect(pickImageUrl(img, 300)).toBe('https://m/x-480.webp');
    expect(pickImageUrl(img, 700)).toBe('https://m/x-960.webp');
    expect(pickImageUrl(img, 1400)).toBe('https://m/x.jpg');
    expect(pickImageUrl({ url: 'https://m/o.jpg', width: 100, variants: [] }, 500)).toBe('https://m/o.jpg');
  });
  it('clamps aspect ratios', () => {
    expect(aspectRatio({ width: 1600, height: 900 })).toBeCloseTo(16 / 9);
    expect(aspectRatio({ width: 5000, height: 500 })).toBe(2.4);
    expect(aspectRatio(undefined)).toBeCloseTo(16 / 9);
  });
});

describe('video and embeds', () => {
  it('plays files natively and opens YouTube/Vimeo externally', () => {
    expect(videoSource({ provider: 'file', videoId: 'x', url: 'https://m/v.mp4' })).toEqual({ kind: 'file', url: 'https://m/v.mp4' });
    expect(videoSource({ provider: 'youtube', videoId: 'aqz-KE-bpKQ' })).toMatchObject({ kind: 'external', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' });
    expect(videoSource({ provider: 'vimeo', videoId: '123' })).toMatchObject({ kind: 'external', url: 'https://vimeo.com/123' });
    expect(videoSource({ provider: 'file', videoId: 'x' })).toEqual({ kind: 'unavailable' });
  });
  it('labels embeds', () => {
    expect(embedLabel('datawrapper')).toBe('Interactive chart');
    expect(embedLabel('x')).toBe('Post on X');
  });
});

describe('layout helpers', () => {
  it('sizes table columns within bounds', () => {
    const w = tableColumnWidths(['City', 'Routes'], [['Addis Ababa', '2'], ['A much longer city name that goes on and on', '3']]);
    expect(w).toHaveLength(2);
    expect(w[0]).toBe(260);
    expect(w[1]).toBe(96);
  });
  it('list markers and heading sizes', () => {
    expect(listMarker(true, 2)).toBe('3.');
    expect(listMarker(false, 0)).toBe('•');
    expect(headingSize(2)).toBeGreaterThan(headingSize(4));
  });
});

describe('block tree', () => {
  const blocks: Block[] = [
    { type: 'heading', level: 2, children: [{ type: 'text', text: 'Title' }] },
    { type: 'paragraph', children: [{ type: 'text', text: 'Body', marks: ['bold'] }] },
    { type: 'quote', children: [{ type: 'text', text: 'Quoted' }], attribution: 'Someone' },
    { type: 'list', ordered: true, items: [[{ type: 'text', text: 'one' }], [{ type: 'text', text: 'two' }]] },
    { type: 'table', header: ['A', 'B'], rows: [['1', '2']] },
    { type: 'related', articleIds: ['a3p8pdt61j', 'ydxp3tgefb'] },
    { type: 'related', articleIds: ['a3p8pdt61j'] },
    { type: 'ad_slot', slot: 'app_feed_3' },
    { type: 'newsletter_prompt', list: 'daily' },
  ];
  it('produces plain text for every text-bearing block', () => {
    expect(blocksToPlainText(blocks)).toBe('Title\n\nBody\n\n“Quoted” — Someone\n\n1. one\n\n2. two\n\nA | B\n\n1 | 2');
  });
  it('collects related ids without duplicates', () => {
    expect(relatedIds(blocks)).toEqual(['a3p8pdt61j', 'ydxp3tgefb']);
  });
});

describe('live updates', () => {
  const u = (id: string, at: string, pinned = false): LiveUpdate => ({ id, articleId: 'p68a3knpc3', at, pinned, body: [] });
  it('merges, dedupes and orders pinned first then newest', () => {
    const merged = mergeLiveUpdates([u('a', '2026-11-03T10:00:00Z'), u('p', '2026-11-03T09:00:00Z', true)], [u('b', '2026-11-03T11:00:00Z'), u('a', '2026-11-03T10:00:00Z')]);
    expect(merged.map((x) => x.id)).toEqual(['p', 'b', 'a']);
  });
  it('finds the newest timestamp and counts new updates', () => {
    expect(newestUpdateAt([u('a', '2026-11-03T10:00:00Z'), u('b', '2026-11-03T11:00:00Z')])).toBe('2026-11-03T11:00:00.000Z');
    expect(newestUpdateAt([])).toBeUndefined();
    expect(countNewUpdates([u('a', 'x')], [u('a', 'x'), u('b', 'y')])).toBe(1);
  });
});
