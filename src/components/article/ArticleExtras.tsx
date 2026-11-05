import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Linking, View } from 'react-native';
import { endpoints } from '../../api';
import { track } from '../../lib/analytics';
import { useTheme } from '../../state/theme';
import { fonts } from '../../theme';
import type { Article, Block } from '../../types';
import { StoryRow, TrendingRow } from '../cards';
import { Icon, type IconName } from '../Icon';
import { RedBlock } from '../SectionHeader';
import { Tap } from '../Tap';
import { Txt } from '../Txt';

/**
 * Inside-the-article ad (app_article_inline_1): editors can place an ad slot block in the story; when they have not,
 * one goes after the third paragraph of stories long enough to carry it.
 */
export function withInlineAd(body: Block[]): Block[] {
  if (body.some((b) => b.type === 'ad_slot')) return body;
  const paragraphs = body.reduce<number[]>((acc, b, i) => (b.type === 'paragraph' ? [...acc, i] : acc), []);
  if (paragraphs.length < 3) return body;
  const after = paragraphs[Math.min(2, paragraphs.length - 2)];
  return [...body.slice(0, after + 1), { type: 'ad_slot', slot: 'app_article_inline_1' }, ...body.slice(after + 1)];
}

function Heading({ title }: { title: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <RedBlock w={20} h={11} />
      <Txt variant="display" size={19} color={c.heading} style={{ fontFamily: fonts.display900Italic, flex: 1 }} accessibilityRole="header">
        {title}
      </Txt>
    </View>
  );
}

/** Home / World / Africa — as on the website. */
export function Breadcrumb({ a }: { a: Article }) {
  const { c } = useTheme();
  const cats = useQuery({ queryKey: ['categories'], queryFn: ({ signal }) => endpoints.categories(signal), staleTime: 30 * 60_000 });
  const parentSlug = a.category.parentSlug ?? cats.data?.find((x) => x.slug === a.category.slug)?.parentSlug ?? null;
  const parent = parentSlug ? cats.data?.find((x) => x.slug === parentSlug) : null;
  const crumbs: [string, string][] = [['Home', '/'], ...(parent ? ([[parent.name, `/section/${parent.slug}`]] as [string, string][]) : []), [a.category.name, `/section/${a.category.slug}`]];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }} accessibilityRole="toolbar" accessibilityLabel="You are here">
      {crumbs.map(([label, href], i) => (
        <View key={href} style={{ flexDirection: 'row', alignItems: 'center' }}>
          {i > 0 ? (
            <Txt variant="ui" size={13} color="#E1141E" style={{ marginHorizontal: 7 }}>
              /
            </Txt>
          ) : null}
          <Tap onPress={() => (href === '/' ? router.navigate('/' as Href) : router.push(href as Href))} accessibilityRole="link" hitSlop={8}>
            <Txt variant={i === crumbs.length - 1 ? 'uiStrong' : 'ui'} size={13} color={i === crumbs.length - 1 ? c.link : c.textMuted}>
              {label}
            </Txt>
          </Tap>
        </View>
      ))}
    </View>
  );
}

const SHARE: { key: string; label: string; icon: IconName; url: (u: string, t: string) => string }[] = [
  { key: 'whatsapp', label: 'WhatsApp', icon: 'chat', url: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}` },
  { key: 'telegram', label: 'Telegram', icon: 'send', url: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { key: 'x', label: 'X', icon: 'external', url: (u, t) => `https://x.com/intent/post?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}` },
  { key: 'facebook', label: 'Facebook', icon: 'external', url: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { key: 'email', label: 'Email', icon: 'mail', url: (u, t) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(`${t}\n${u}`)}` },
];

/** "Share this story" row (the website's share bar) — opens each app's share page; "More" is the system sheet. */
export function ShareRow({ a, onMore }: { a: Article; onMore: () => void }) {
  const { c } = useTheme();
  return (
    <View>
      <Heading title="Share this story" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SHARE.map((s) => (
          <Tap
            key={s.key}
            haptics
            onPress={() => {
              track('share', { articleId: a.id, props: { method: s.key } });
              void Linking.openURL(s.url(a.url, a.headline)).catch(() => onMore());
            }}
            accessibilityRole="link"
            accessibilityLabel={`Share on ${s.label}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: c.border }}
          >
            <Icon name={s.icon} size={15} color={c.heading} />
            <Txt variant="uiBold" size={13}>
              {s.label}
            </Txt>
          </Tap>
        ))}
        <Tap haptics onPress={onMore} accessibilityRole="button" accessibilityLabel="More ways to share" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: c.border }}>
          <Icon name="share" size={15} color={c.heading} />
          <Txt variant="uiBold" size={13}>
            More
          </Txt>
        </Tap>
      </View>
    </View>
  );
}

/** "More from Africa": the section's latest stories, without this one or the related stories already shown. */
export function MoreFromSection({ a, exclude }: { a: Article; exclude: Set<string> }) {
  const { c } = useTheme();
  const q = useQuery({
    queryKey: ['section-more', a.category.slug],
    queryFn: ({ signal }) => endpoints.articles({ category: a.category.slug, pageSize: 8 }, signal),
    staleTime: 2 * 60_000,
  });
  const items = (q.data?.items ?? []).filter((x) => x.id !== a.id && !exclude.has(x.id)).slice(0, 4);
  if (!items.length) return null;
  return (
    <View>
      <Heading title={`More from ${a.category.name}`} />
      <Tap onPress={() => router.push(`/section/${a.category.slug}` as Href)} accessibilityRole="link">
        <Txt variant="uiStrong" size={13.5} color={c.link}>
          All {a.category.name} stories
        </Txt>
      </Tap>
      {items.map((x, i) => (
        <StoryRow key={x.id} a={x} divider={i < items.length - 1} />
      ))}
    </View>
  );
}

/** "Most read" from the Home feed's trending list (already cached; no extra request when Home was opened). */
export function MostRead({ excludeId }: { excludeId: string }) {
  const home = useQuery({ queryKey: ['home'], queryFn: ({ signal }) => endpoints.home(signal), staleTime: 3 * 60_000 });
  const items = (home.data?.sections.find((s) => s.layout === 'trending')?.items ?? []).filter((x) => x.id !== excludeId).slice(0, 5);
  if (!items.length) return null;
  return (
    <View>
      <Heading title="Most read" />
      {items.map((x, i) => (
        <TrendingRow key={x.id} a={x} rank={i + 1} last={i === items.length - 1} />
      ))}
    </View>
  );
}
