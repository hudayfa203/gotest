import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import type { Block } from '../../../types';
import { Blocks } from '../Blocks';

jest.mock('../../../lib/navigation', () => ({
  openArticleLink: jest.fn(),
  openExternal: jest.fn(async () => {}),
  openArticle: jest.fn(),
  openWebUrl: jest.fn(),
}));
// the pinch-zoom lightbox (gesture handler) is exercised on device, not in Jest
jest.mock('../Lightbox', () => ({ Lightbox: () => null }));
jest.mock('expo-video', () => ({ useVideoPlayer: jest.fn(), VideoView: () => null }));
jest.mock('../../../api', () => ({ endpoints: { article: jest.fn(() => new Promise(() => {})), ads: jest.fn(async () => ({ placement: 'x', ad: null })), adEvent: jest.fn() } }));

const nav = jest.requireMock('../../../lib/navigation') as { openArticleLink: jest.Mock; openExternal: jest.Mock };

async function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return await render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}
const ctx = { width: 350, scale: 1, articleId: 'a3p8pdt61j' };

describe('<Blocks> native renderer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders text blocks: paragraph with marks, headings, quotes, lists, tables', async () => {
    const blocks: Block[] = [
      { type: 'paragraph', children: [{ type: 'text', text: 'Plain and ' }, { type: 'text', text: 'bold', marks: ['bold'] }] },
      { type: 'heading', level: 2, children: [{ type: 'text', text: 'Section heading' }] },
      { type: 'quote', children: [{ type: 'text', text: 'A quoted line' }], attribution: 'A fictional editor' },
      { type: 'list', ordered: true, items: [[{ type: 'text', text: 'First step' }], [{ type: 'text', text: 'Second step' }]] },
      { type: 'table', caption: 'Demo table', header: ['City', 'Routes'], rows: [['Nairobi', '3']] },
    ];
    await wrap(<Blocks blocks={blocks} ctx={ctx} />);
    expect(screen.getByText('Section heading')).toBeTruthy();
    expect(screen.getByText('bold')).toBeTruthy();
    expect(screen.getByText('— A fictional editor')).toBeTruthy();
    expect(screen.getByText('2.', { includeHiddenElements: true })).toBeTruthy(); // marker is hidden from screen readers
    expect(screen.getByText('Second step')).toBeTruthy();
    expect(screen.getByText('Nairobi')).toBeTruthy();
    expect(screen.getByText('Demo table')).toBeTruthy();
  });

  it('renders a photo gallery with every photo, a counter and the per-photo caption', async () => {
    const img = (n: number) => ({ id: `g${n}`, url: `https://media.example/g${n}.jpg`, width: 1200, height: 800, alt: `Gallery photo ${n}`, caption: `Caption ${n}`, credit: 'Staff', variants: [] });
    await wrap(<Blocks blocks={[{ type: 'gallery', caption: 'In pictures: the harbour', images: [img(1), img(2), img(3)] }]} ctx={ctx} />);
    expect(screen.getByTestId('gallery')).toBeTruthy();
    expect(screen.getByLabelText(/Photo 1 of 3: Gallery photo 1/)).toBeTruthy();
    expect(screen.getByLabelText(/Photo 3 of 3: Gallery photo 3/)).toBeTruthy();
    expect(screen.getByText(/1 \/ 3/)).toBeTruthy();
    expect(screen.getByText(/Caption 1/)).toBeTruthy();
    expect(screen.getByText('In pictures: the harbour')).toBeTruthy();
  });

  it('makes links tappable and hands them to the link router', async () => {
    const link = { type: 'link' as const, href: 'https://goworld.news/africa/port-upgrade-ydxp3tgefb', text: 'port story' };
    await wrap(<Blocks blocks={[{ type: 'paragraph', children: [{ type: 'text', text: 'Read the ' }, link] }]} ctx={ctx} />);
    await fireEvent.press(screen.getByText('port story'));
    expect(nav.openArticleLink).toHaveBeenCalledWith(link);
  });

  it('renders embeds as link cards that open in the browser, and YouTube as an external player card', async () => {
    await wrap(
      <Blocks
        blocks={[
          { type: 'embed', provider: 'datawrapper', url: 'https://datawrapper.dwcdn.net/abcde/1/' },
          { type: 'video', provider: 'youtube', videoId: 'aqz-KE-bpKQ', title: 'A YouTube clip' },
        ]}
        ctx={ctx}
      />,
    );
    await fireEvent.press(screen.getByText('Interactive chart'));
    expect(nav.openExternal).toHaveBeenCalledWith('https://datawrapper.dwcdn.net/abcde/1/');
    await fireEvent.press(screen.getByText('Watch on YouTube'));
    expect(nav.openExternal).toHaveBeenCalledWith('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  });

  it('shows a play button (poster first) for file videos and the newsletter prompt', async () => {
    await wrap(
      <Blocks
        blocks={[
          { type: 'video', provider: 'file', videoId: 'v', url: 'https://m/v.mp4', title: 'Demo clip' },
          { type: 'newsletter_prompt', list: 'daily' },
        ]}
        ctx={ctx}
      />,
    );
    expect(screen.getByLabelText('Play video: Demo clip')).toBeTruthy();
    expect(screen.getByText('Sign up')).toBeTruthy();
  });

  it('skips the body video already shown as the hero', async () => {
    await wrap(<Blocks blocks={[{ type: 'video', provider: 'file', videoId: 'v', url: 'https://m/v.mp4', title: 'Hero clip' }]} ctx={{ ...ctx, skipVideoUrl: 'https://m/v.mp4' }} />);
    expect(screen.queryByLabelText('Play video: Hero clip')).toBeNull();
  });
});
