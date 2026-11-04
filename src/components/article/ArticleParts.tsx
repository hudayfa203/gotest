import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { endpoints } from '../../api';
import { formatDate, formatDateTime, typeKicker } from '../../lib/format';
import { openExternal } from '../../lib/navigation';
import { useTheme } from '../../state/theme';
import type { Article, Correction, LiveState, Tombstone } from '../../types';
import { Avatar } from '../cards';
import { Icon } from '../Icon';
import { DemoBadge, StatusLabels } from '../Labels';
import { AudioPlayer } from '../media/AudioPlayer';
import { Tap } from '../Tap';
import { Txt } from '../Txt';

export function DemoNotice() {
  const { isDark } = useTheme();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Demo content. This story is demonstration material for the GO World News platform and does not describe real events."
      style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 10, padding: 12, backgroundColor: isDark ? 'rgba(242,193,78,0.12)' : '#FFF6DF', borderWidth: 1, borderColor: isDark ? '#F2C14E' : '#E3C27A' }}
    >
      <DemoBadge />
      <Txt variant="ui" size={13} lineHeight={18} color={isDark ? '#F6DCA0' : '#5C3D00'} style={{ flex: 1 }}>
        Demonstration content for the GO World News platform. It does not describe real events.
      </Txt>
    </View>
  );
}

/**
 * `liveState` overrides the article's own live state with the freshest one known (the polled feed); `null` hides
 * the status chip (e.g. while the page could not be refreshed — the status banner explains instead).
 */
export function ArticleHeaderText({ a, scale, liveState }: { a: Article; scale: number; liveState?: LiveState | null }) {
  const { c } = useTheme();
  const kicker = typeKicker(a.type);
  const s = Math.min(scale, 1.3);
  const labelSource = liveState === undefined ? a : { labels: a.labels, live: liveState ? { state: liveState } : null };
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <StatusLabels a={labelSource} max={3} />
        <Tap onPress={() => router.push(`/section/${a.category.slug}` as Href)} accessibilityRole="link" accessibilityLabel={`${a.category.name} section`} hitSlop={10}>
          <Txt variant="kicker" size={11.5} color={a.type === 'opinion' ? c.accent : c.link}>
            {kicker && a.type !== 'live' ? `${kicker} · ` : ''}
            {a.category.name}
          </Txt>
        </Tap>
      </View>
      <Txt variant="display" size={30 * s} lineHeight={Math.round(36 * s)} accessibilityRole="header">
        {a.headline}
      </Txt>
      {a.subheadline ? (
        <Txt variant="title" size={18 * s} lineHeight={Math.round(24 * s)} muted>
          {a.subheadline}
        </Txt>
      ) : null}
      {a.standfirst ? (
        <Txt variant="serif" size={19 * s} lineHeight={Math.round(28 * s)} color={c.textMuted}>
          {a.standfirst}
        </Txt>
      ) : null}
    </View>
  );
}

/** `live`: live coverage shows when it started instead of a reading time (updates have their own times). */
export function Byline({ a, live = false }: { a: Article; live?: boolean }) {
  const { c } = useTheme();
  const updated = !live && Date.parse(a.updatedAt) - Date.parse(a.publishedAt) > 60_000;
  return (
    <View style={{ gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border, paddingVertical: 14 }}>
      {a.authors.map((au) => (
        <Tap key={au.id} onPress={() => router.push(`/author/${au.slug}` as Href)} accessibilityRole="link" accessibilityLabel={`${au.credit && au.credit !== 'author' ? au.credit : 'By'} ${au.name}${au.role ? `, ${au.role}` : ''}. Open author page.`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={au.name} url={au.avatar?.url} size={40} />
          <View style={{ flex: 1 }}>
            <Txt variant="uiBold" size={14.5}>
              {au.credit && au.credit !== 'author' ? `${au.credit[0].toUpperCase()}${au.credit.slice(1)}: ` : 'By '}
              <Txt variant="uiBold" size={14.5} color={c.link}>
                {au.name}
              </Txt>
            </Txt>
            {au.role ? (
              <Txt variant="ui" size={12.5} muted numberOfLines={1}>
                {au.role}
              </Txt>
            ) : null}
          </View>
          <Icon name="chevron-right" size={18} color={c.textMuted} />
        </Tap>
      ))}
      <View style={{ gap: 2 }}>
        <Txt variant="ui" size={12.5} muted>
          {live ? 'Live coverage from' : 'Published'} {formatDateTime(a.live?.startedAt ?? a.publishedAt)}
          {a.location ? ` · ${a.location.name}` : ''}
        </Txt>
        {updated ? (
          <Txt variant="uiStrong" size={12.5} color={c.text}>
            Updated {formatDateTime(a.updatedAt)}
          </Txt>
        ) : null}
        {!live ? (
          <Txt variant="ui" size={12.5} muted>
            {a.readingTimeMinutes} min read
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

export function SponsorBox({ a }: { a: Article }) {
  const { c } = useTheme();
  if (!a.sponsor) return null;
  return (
    <View style={{ borderRadius: 10, padding: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 4 }} accessibilityRole="text">
      <Txt variant="kicker" size={10.5} muted>
        Sponsored content · {a.sponsor.name}
      </Txt>
      <Txt variant="ui" size={13} lineHeight={18}>
        {a.sponsor.disclosure}
      </Txt>
    </View>
  );
}

export function CorrectionsBox({ corrections }: { corrections: Correction[] }) {
  const { c, isDark } = useTheme();
  if (!corrections.length) return null;
  return (
    <View accessibilityRole="summary" style={{ borderRadius: 12, padding: 16, gap: 10, backgroundColor: isDark ? 'rgba(242,193,78,0.08)' : '#FFF9EC', borderLeftWidth: 4, borderLeftColor: c.warning }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="info" size={18} color={c.warning} />
        <Txt variant="kicker" size={12} color={c.warning} accessibilityRole="header">
          {corrections.length === 1 ? 'Correction' : `Corrections (${corrections.length})`}
        </Txt>
      </View>
      {corrections.map((x, i) => (
        <View key={i} style={{ gap: 2 }}>
          <Txt variant="uiBold" size={12.5} muted>
            {formatDateTime(x.at)}
          </Txt>
          <Txt variant="serif" size={16} lineHeight={24}>
            {x.note}
          </Txt>
        </View>
      ))}
      <Tap onPress={() => router.push('/settings/page/editorialStandards' as Href)} accessibilityRole="link" style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}>
        <Txt variant="uiBold" size={12.5} color={c.link}>
          Our corrections policy
        </Txt>
      </Tap>
    </View>
  );
}

export function Sources({ sources }: { sources: Article['sources'] }) {
  const { c } = useTheme();
  if (!sources.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="kicker" size={12} color={c.heading} accessibilityRole="header">
        Sources
      </Txt>
      {sources.map((s, i) =>
        s.url ? (
          <Tap key={i} onPress={() => void openExternal(s.url!)} accessibilityRole="link" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 32 }}>
            <Icon name="external" size={15} color={c.link} />
            <Txt variant="ui" size={14} color={c.link} style={{ flex: 1 }}>
              {s.label}
            </Txt>
          </Tap>
        ) : (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.textMuted, marginHorizontal: 5 }} />
            <Txt variant="ui" size={14} muted style={{ flex: 1 }}>
              {s.label}
            </Txt>
          </View>
        ),
      )}
    </View>
  );
}

export function Tags({ tags }: { tags: Article['tags'] }) {
  const { c } = useTheme();
  if (!tags.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <Txt variant="kicker" size={12} color={c.heading} accessibilityRole="header">
        Topics
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tags.map((t) => (
          <Tap key={t.slug} onPress={() => router.push(`/topic/${t.slug}` as Href)} haptics accessibilityRole="link" accessibilityLabel={`Topic: ${t.name}`} style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: c.border, justifyContent: 'center', backgroundColor: c.surface }}>
            <Txt variant="uiStrong" size={13}>
              {t.name}
            </Txt>
          </Tap>
        ))}
      </View>
    </View>
  );
}

/** Podcast articles: find the episode's audio (GET /podcasts) and show the player. */
export function PodcastEpisodeSection({ articleId }: { articleId: string }) {
  const q = useQuery({ queryKey: ['podcasts'], queryFn: ({ signal }) => endpoints.podcasts(undefined, signal), staleTime: 10 * 60_000 });
  const ep = q.data?.find((e) => e.articleId === articleId);
  if (!ep) return null;
  return <AudioPlayer episode={ep} />;
}

export function TombstoneView({ tombstone, message }: { tombstone: Tombstone | null; message?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ padding: 24, gap: 14, alignItems: 'flex-start' }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="alert" size={26} color={c.danger} />
      </View>
      <Txt variant="display" size={26} accessibilityRole="header">
        This article has been withdrawn
      </Txt>
      <Txt variant="serif" size={17} lineHeight={26}>
        {tombstone?.notice || message || 'GO World News has withdrawn this article.'}
      </Txt>
      {tombstone?.withdrawnAt ? (
        <Txt variant="ui" size={13} muted>
          Withdrawn {formatDate(tombstone.withdrawnAt)}
        </Txt>
      ) : null}
      <Txt variant="ui" size={13} muted>
        Any offline copy on this device has been removed.
      </Txt>
    </View>
  );
}
