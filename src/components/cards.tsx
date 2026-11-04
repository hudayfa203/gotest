import { LinearGradient } from 'expo-linear-gradient';
import { View, useWindowDimensions, type ViewStyle } from 'react-native';
import { formatDuration, timeAgo, typeKicker } from '../lib/format';
import { displayLabels, liveBadge } from '../lib/live';
import { openArticle } from '../lib/navigation';
import { useTheme } from '../state/theme';
import type { ArticleSummary } from '../types';
import { ArticleImage } from './ArticleImage';
import { Icon } from './Icon';
import { DemoBadge, StatusLabels } from './Labels';
import { Tap } from './Tap';
import { Txt } from './Txt';

export const MAX_FEED_WIDTH = 720;
export function useFeedWidth(padding = 16) {
  const { width } = useWindowDimensions();
  const w = Math.min(width, MAX_FEED_WIDTH);
  return { screen: width, content: w - padding * 2, full: w };
}

const A11Y_LABEL: Record<string, string> = { live: 'Live now', ended: 'Live coverage ended', fact_check: 'Fact check' };
function a11yLabel(a: ArticleSummary) {
  const labels = displayLabels(a).map((l) => A11Y_LABEL[l] ?? l);
  const kicker = a.type === 'live' ? null : typeKicker(a.type);
  const parts = [labels.length ? labels.join(', ') : null, kicker, a.headline, a.isDemo ? 'Demo content' : null, timeAgo(a.publishedAt)];
  return parts.filter(Boolean).join('. ');
}

export function Kicker({ a, color }: { a: ArticleSummary; color?: string }) {
  const { c } = useTheme();
  const k = typeKicker(a.type);
  return (
    <Txt variant="kicker" size={11} color={color ?? (a.type === 'opinion' ? c.accent : c.link)} numberOfLines={1}>
      {k && a.type !== 'live' ? `${k} · ${a.category.name}` : a.category.name}
    </Txt>
  );
}

export function Meta({ a, color, showReading = false }: { a: ArticleSummary; color?: string; showReading?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Txt variant="ui" size={12} color={color ?? c.textMuted}>
        {timeAgo(a.publishedAt)}
        {showReading ? ` · ${a.readingTimeMinutes} min read` : ''}
      </Txt>
      {a.isDemo ? <DemoBadge onDark={color ? true : undefined} /> : null}
    </View>
  );
}

/** Lead story: full-bleed image with the headline set on a navy gradient. */
export function LeadCard({ a }: { a: ArticleSummary }) {
  const { c } = useTheme();
  const { full } = useFeedWidth();
  const imgH = Math.round(full * 1.0);
  return (
    <Tap onPress={() => openArticle(a.id)} accessibilityLabel={a11yLabel(a)} accessibilityRole="link" pressScale={0.985} style={{ marginBottom: 8 }}>
      <View style={{ width: full, height: imgH, backgroundColor: '#061A40' }}>
        <ArticleImage image={a.image} width={full} ratio={full / imgH} priority="high" accessible={false} />
        <LinearGradient colors={['rgba(6,26,64,0)', 'rgba(6,26,64,0.55)', 'rgba(6,26,64,0.96)']} locations={[0.25, 0.55, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: imgH * 0.78 }} />
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 18, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <StatusLabels a={a} />
            {a.isDemo ? <DemoBadge onDark /> : null}
          </View>
          <Txt variant="display" size={29} lineHeight={34} color="#FFFFFF" numberOfLines={4}>
            {a.headline}
          </Txt>
          <Txt variant="ui" size={12.5} color="rgba(255,255,255,0.82)">
            {a.category.name} · {timeAgo(a.publishedAt)}
          </Txt>
        </View>
      </View>
      {a.standfirst ? (
        <Txt variant="serif" size={16.5} lineHeight={25} color={c.text} style={{ paddingHorizontal: 16, paddingTop: 14 }} numberOfLines={3}>
          {a.standfirst}
        </Txt>
      ) : null}
    </Tap>
  );
}

/** Medium card: wide image, headline, standfirst. */
export function StoryCard({ a, width, style }: { a: ArticleSummary; width?: number; style?: ViewStyle }) {
  const { content } = useFeedWidth();
  const w = width ?? content;
  return (
    <Tap onPress={() => openArticle(a.id)} accessibilityLabel={a11yLabel(a)} accessibilityRole="link" style={[{ width: w, gap: 8 }, style]}>
      <View>
        <ArticleImage image={a.image} width={w} ratio={16 / 9} radius={12} accessible={false} recyclingKey={a.id} />
        {a.type === 'video' ? <PlayBadge duration={a.video?.durationSeconds} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <StatusLabels a={a} max={1} />
        <View style={{ flex: 1 }}>
          <Kicker a={a} />
        </View>
      </View>
      <Txt variant="headline" size={19} lineHeight={24} numberOfLines={3}>
        {a.headline}
      </Txt>
      {a.standfirst ? (
        <Txt variant="body" size={14.5} lineHeight={21} muted numberOfLines={2}>
          {a.standfirst}
        </Txt>
      ) : null}
      <Meta a={a} />
    </Tap>
  );
}

/** Compact row: text left, thumbnail right. */
export function StoryRow({ a, hideImage, divider = true }: { a: ArticleSummary; hideImage?: boolean; divider?: boolean }) {
  const { c } = useTheme();
  return (
    <Tap onPress={() => openArticle(a.id)} accessibilityLabel={a11yLabel(a)} accessibilityRole="link" pressScale={0.985} style={{ flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: divider ? 1 : 0, borderBottomColor: c.border }}>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StatusLabels a={a} max={1} />
          <View style={{ flex: 1 }}>
            <Kicker a={a} />
          </View>
        </View>
        <Txt variant="headline" size={16} lineHeight={21} numberOfLines={3}>
          {a.headline}
        </Txt>
        <Meta a={a} />
      </View>
      {!hideImage && a.image ? (
        <View>
          <ArticleImage image={a.image} width={108} ratio={4 / 3} radius={10} accessible={false} recyclingKey={a.id} />
          {a.type === 'video' ? <PlayBadge small /> : null}
        </View>
      ) : null}
    </Tap>
  );
}

/** "Latest" timeline row: time, headline, labels. */
export function LatestRow({ a, last }: { a: ArticleSummary; last?: boolean }) {
  const { c } = useTheme();
  // red only while coverage is actually live (never for ended coverage or a stale 'live' label)
  const isLive = liveBadge(a) === 'live';
  return (
    <Tap onPress={() => openArticle(a.id)} accessibilityLabel={a11yLabel(a)} accessibilityRole="link" pressScale={0.985} style={{ flexDirection: 'row', gap: 12, minHeight: 64 }}>
      <View style={{ width: 14, alignItems: 'center' }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: isLive || a.labels.includes('breaking') ? c.breaking : c.brand, marginTop: 5 }} />
        {!last ? <View style={{ flex: 1, width: 2, backgroundColor: c.border, marginTop: 4 }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 4, paddingBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt variant="uiBold" size={12} color={isLive ? c.breaking : c.link}>
            {timeAgo(a.publishedAt)}
          </Txt>
          <Txt variant="ui" size={12} muted>
            {a.category.name}
          </Txt>
          {a.isDemo ? <DemoBadge /> : null}
        </View>
        <Txt variant="headline" size={16} lineHeight={21} numberOfLines={3}>
          {a.headline}
        </Txt>
        <StatusLabels a={a} style={{ marginTop: 2 }} />
      </View>
    </Tap>
  );
}

export function PlayBadge({ duration, small }: { duration?: number; small?: boolean }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(6,26,64,0.82)', borderRadius: 999, paddingHorizontal: small ? 6 : 10, paddingVertical: small ? 4 : 6 }}>
      <Icon name="play" size={small ? 11 : 13} color="#FFFFFF" />
      {duration && !small ? (
        <Txt variant="uiBold" size={12} color="#FFFFFF">
          {formatDuration(duration)}
        </Txt>
      ) : null}
    </View>
  );
}

/** Video strip card (on deep navy). */
export function VideoCard({ a, width }: { a: ArticleSummary; width: number }) {
  return (
    <Tap onPress={() => openArticle(a.id)} accessibilityLabel={`Video. ${a11yLabel(a)}`} accessibilityRole="link" style={{ width, gap: 10 }}>
      <View>
        <ArticleImage image={a.image} width={width} ratio={16 / 9} radius={12} accessible={false} />
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#E1141E', alignItems: 'center', justifyContent: 'center', paddingLeft: 4 }}>
            <Icon name="play" size={24} color="#FFFFFF" />
          </View>
        </View>
        {a.video?.durationSeconds ? (
          <View style={{ position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Txt variant="uiBold" size={11.5} color="#FFFFFF">
              {formatDuration(a.video.durationSeconds)}
            </Txt>
          </View>
        ) : null}
      </View>
      <Txt variant="headline" size={17} lineHeight={22} color="#FFFFFF" numberOfLines={3}>
        {a.headline}
      </Txt>
      <Meta a={a} color="rgba(255,255,255,0.75)" />
    </Tap>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function Avatar({ name, url, size = 36 }: { name: string; url?: string; size?: number }) {
  const { c, isDark } = useTheme();
  if (url) return <ArticleImage image={{ url, width: size * 3, height: size * 3, alt: name }} width={size} ratio={1} radius={size / 2} accessible={false} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: isDark ? c.surfaceRaised : '#E3E9F4', alignItems: 'center', justifyContent: 'center' }}>
      <Txt variant="title" size={size * 0.38} color={c.heading}>
        {initials(name)}
      </Txt>
    </View>
  );
}

/** Opinion: big red quote mark, columnist name. */
export function OpinionCard({ a }: { a: ArticleSummary }) {
  const { c } = useTheme();
  const author = a.authors[0];
  return (
    <Tap onPress={() => openArticle(a.id)} accessibilityLabel={`Opinion by ${author?.name}. ${a11yLabel(a)}`} accessibilityRole="link" style={{ backgroundColor: c.surface, borderRadius: 14, padding: 16, gap: 10, borderLeftWidth: 4, borderLeftColor: c.accent }}>
      <Txt variant="display" size={44} lineHeight={36} color={c.accent} style={{ marginBottom: -8 }} accessibilityElementsHidden>
        “
      </Txt>
      <Txt variant="serifStrong" size={20} lineHeight={27} color={c.heading} numberOfLines={4}>
        {a.headline}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
        {author ? <Avatar name={author.name} url={author.avatar?.url} size={34} /> : null}
        <View style={{ flex: 1 }}>
          <Txt variant="uiBold" size={13.5}>
            {author?.name}
          </Txt>
          <Txt variant="ui" size={12} muted numberOfLines={1}>
            {author?.role ?? 'Opinion'}
          </Txt>
        </View>
        {a.isDemo ? <DemoBadge /> : null}
      </View>
    </Tap>
  );
}

export function PodcastCard({ a }: { a: ArticleSummary }) {
  const { c } = useTheme();
  return (
    <Tap onPress={() => openArticle(a.id)} accessibilityLabel={`Podcast. ${a11yLabel(a)}`} accessibilityRole="link" style={{ flexDirection: 'row', gap: 14, backgroundColor: c.surface, borderRadius: 14, padding: 12, alignItems: 'center' }}>
      <View>
        <ArticleImage image={a.image} width={84} ratio={1} radius={10} accessible={false} />
        <View style={{ position: 'absolute', right: -6, bottom: -6, width: 32, height: 32, borderRadius: 16, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.surface }}>
          <Icon name="headphones" size={16} color="#FFFFFF" />
        </View>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Txt variant="kicker" size={10.5} color={c.link}>
          Podcast
        </Txt>
        <Txt variant="headline" size={16} lineHeight={21} numberOfLines={3}>
          {a.headline}
        </Txt>
        <Meta a={a} />
      </View>
    </Tap>
  );
}

export function TrendingRow({ a, rank, last }: { a: ArticleSummary; rank: number; last?: boolean }) {
  const { c } = useTheme();
  return (
    <Tap onPress={() => openArticle(a.id)} accessibilityLabel={`${rank}. ${a11yLabel(a)}`} accessibilityRole="link" pressScale={0.985} style={{ flexDirection: 'row', gap: 14, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border, alignItems: 'flex-start' }}>
      <Txt variant="display" size={34} lineHeight={36} color={rank === 1 ? c.accent : c.heading} style={{ width: 34, fontFamily: 'Montserrat-900-Italic' }}>
        {rank}
      </Txt>
      <View style={{ flex: 1, gap: 4 }}>
        <Txt variant="headline" size={16} lineHeight={21} numberOfLines={3}>
          {a.headline}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Txt variant="ui" size={12} muted>
            {a.category.name}
          </Txt>
          {a.isDemo ? <DemoBadge /> : null}
        </View>
      </View>
    </Tap>
  );
}
