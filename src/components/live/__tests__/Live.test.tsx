import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { feedFromFull } from '../../../lib/live';
import type { LiveCoverage, LiveFeed, LiveUpdate } from '../../../types';
import { LiveStatusBanner, LiveTimeline } from '../LiveTimeline';
import { LiveUpdatesEntry } from '../LiveUpdatesEntry';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../../lib/navigation', () => ({ openArticleLink: jest.fn(), openExternal: jest.fn(async () => {}), openArticle: jest.fn(), openWebUrl: jest.fn() }));
jest.mock('../../article/Lightbox', () => ({ Lightbox: () => null }));
jest.mock('expo-video', () => ({ useVideoPlayer: jest.fn(), VideoView: () => null }));
jest.mock('../../../api', () => ({ endpoints: { article: jest.fn(() => new Promise(() => {})), ads: jest.fn(async () => ({ placement: 'x', ad: null })), adEvent: jest.fn() } }));

const router = (jest.requireMock('expo-router') as { router: { push: jest.Mock } }).router;
const NOW = Date.parse('2026-11-03T10:10:00Z');
const ID = 'p68a3knpc3';

async function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return await render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}
const text = (t: string) => [{ type: 'paragraph' as const, children: [{ type: 'text' as const, text: t }] }];
const cov = (x: Partial<LiveCoverage> = {}): LiveCoverage => ({
  id: ID, url: 'https://goworld.news/world/live-forum-p68a3knpc3', path: '/world/live-forum-p68a3knpc3', headline: 'Live: regional transport forum', category: { slug: 'world', name: 'World' },
  state: 'live', archived: false, startedAt: '2026-11-03T08:00:00Z', endedAt: null, lastUpdateAt: '2026-11-03T10:02:00Z', updateCount: 3, isDemo: false, ...x,
});
const upd = (id: string, at: string, x: Partial<LiveUpdate> = {}): LiveUpdate => ({ id, articleId: ID, at, pinned: false, body: text(`Body of ${id}`), ...x });
const feedOf = (updates: LiveUpdate[], c = cov()): LiveFeed => ({ coverage: c, updates, removedIds: [], serverTime: '2026-11-03T10:09:55Z', relatedArticles: [] });

describe('<LiveStatusBanner>', () => {
  it('says LIVE with the last update time only while live and fresh', async () => {
    await wrap(<LiveStatusBanner status="live" coverage={cov()} fetchedAt={NOW - 5000} now={NOW} offline={false} />);
    expect(screen.getByText('Live · updated 8 min ago')).toBeTruthy();
    expect(screen.getByLabelText(/^Live coverage\. Live · updated 8 min ago\./)).toBeTruthy();
  });
  it('stale: no LIVE claim, says when it was last refreshed', async () => {
    await wrap(<LiveStatusBanner status="stale" coverage={cov()} fetchedAt={NOW - 10 * 60_000} now={NOW} offline />);
    expect(screen.queryByText(/^Live/)).toBeNull();
    expect(screen.getByText(/^Not refreshed since/)).toBeTruthy();
    expect(screen.getByText(/You’re offline/)).toBeTruthy();
  });
  it('ended and archived coverage say so, with times', async () => {
    const ended = cov({ state: 'ended', endedAt: '2026-11-03T09:00:00Z', updateCount: 5 });
    await wrap(<LiveStatusBanner status="ended" coverage={ended} fetchedAt={NOW} now={NOW} offline={false} />);
    expect(screen.queryByText(/^Live/)).toBeNull();
    expect(screen.getByText('This live coverage has ended')).toBeTruthy();
    expect(screen.getByText(/ran 1 hr · 5 updates$/)).toBeTruthy();
    await wrap(<LiveStatusBanner status="archived" coverage={{ ...ended, archived: true } as LiveCoverage} fetchedAt={NOW} now={NOW} offline={false} />);
    expect(screen.getByText('From the live archive')).toBeTruthy();
  });
});

describe('<LiveTimeline>', () => {
  const updates = [
    upd('k', '2026-11-03T08:30:00Z', { pinned: true, headline: 'Key moment' }),
    upd('a', '2026-11-03T09:00:00Z', { headline: 'Older update', author: { name: 'Maria Santos', slug: 'maria-santos' } }),
    upd('b', '2026-11-03T10:02:00Z', { headline: 'Newest update', updatedAt: '2026-11-03T10:06:00Z', body: [{ type: 'image', image: { id: 'i', url: 'https://m/x.jpg', width: 1600, height: 900, alt: 'Delegates at the forum' } }] }),
  ];
  it('renders key updates first, then the timeline newest first, with author, edit marker and media', async () => {
    await wrap(<LiveTimeline articleId={ID} feed={feedFromFull(feedOf(updates), NOW)} status="live" loading={false} failed={false} width={350} scale={1} now={NOW} newIds={new Set(['b'])} />);
    expect(screen.getByText('Live updates')).toBeTruthy();
    expect(screen.getByText('Key update')).toBeTruthy();
    const order = ['Key moment', 'Newest update', 'Older update'].map((t) => screen.getByText(t));
    expect(order).toHaveLength(3);
    const all = screen.getAllByText(/moment|update$/).map((n) => n.props.children);
    expect(all.indexOf('Key moment')).toBeLessThan(all.indexOf('Newest update'));
    expect(all.indexOf('Newest update')).toBeLessThan(all.indexOf('Older update'));
    expect(screen.getByText('Maria Santos')).toBeTruthy();
    expect(screen.getByText(/^Edited /)).toBeTruthy();
    expect(screen.getByLabelText('Delegates at the forum. Double-tap to view full screen.')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    await fireEvent.press(screen.getByText('Maria Santos'));
    expect(router.push).toHaveBeenCalledWith('/author/maria-santos');
  });
  it('ended coverage shows the end marker and no auto-refresh claim', async () => {
    const c = cov({ state: 'ended', endedAt: '2026-11-03T10:05:00Z' });
    await wrap(<LiveTimeline articleId={ID} feed={feedFromFull(feedOf(updates, c), NOW)} status="ended" loading={false} failed={false} width={350} scale={1} now={NOW} newIds={new Set()} />);
    expect(screen.getByText(/^Coverage ended · /)).toBeTruthy();
    expect(screen.queryByText(/^Auto-refresh/)).toBeNull();
    expect(screen.getByText(/^Coverage started · /)).toBeTruthy();
  });
  it('pages long feeds with a working "show earlier" button', async () => {
    const many = Array.from({ length: 30 }, (_, i) => upd(`u${i}`, new Date(Date.parse('2026-11-03T08:00:00Z') + i * 60_000).toISOString(), { headline: `Update number ${i}` }));
    await wrap(<LiveTimeline articleId={ID} feed={feedFromFull(feedOf(many), NOW)} status="live" loading={false} failed={false} width={350} scale={1} now={NOW} newIds={new Set()} />);
    expect(screen.getByText('Update number 29')).toBeTruthy();
    expect(screen.queryByText('Update number 0')).toBeNull();
    await fireEvent.press(screen.getByText('Show 5 earlier updates'));
    expect(screen.getByText('Update number 0')).toBeTruthy();
  });
});

describe('<LiveUpdatesEntry> (home)', () => {
  beforeEach(() => jest.clearAllMocks());
  it('renders nothing when nothing is live', async () => {
    await wrap(<LiveUpdatesEntry items={[]} />);
    expect(screen.queryByText('Live updates')).toBeNull();
  });
  it('shows LIVE UPDATES, the count when more than one and the top headline; opens the Live hub', async () => {
    await wrap(<LiveUpdatesEntry items={[cov(), cov({ id: 'bbbbbbbbbb', headline: 'Second coverage', isDemo: true })]} />);
    expect(screen.getByText('Live updates')).toBeTruthy();
    expect(screen.getByText('2 live')).toBeTruthy();
    expect(screen.getByText('Live: regional transport forum')).toBeTruthy();
    await fireEvent.press(screen.getByText('Live: regional transport forum'));
    expect(router.push).toHaveBeenCalledWith('/live');
  });
});
