import { View } from 'react-native';
import { shortDateTime, timeAgo } from '../../lib/format';
import { coverageDuration, updateCountText } from '../../lib/live';
import { openArticle } from '../../lib/navigation';
import { useTheme } from '../../state/theme';
import type { LiveCoverage } from '../../types';
import { ArticleImage } from '../ArticleImage';
import { useFeedWidth } from '../cards';
import { Icon } from '../Icon';
import { DemoBadge, LabelChip } from '../Labels';
import { Tap } from '../Tap';
import { Txt } from '../Txt';

/** LIVE (pulsing) while state is 'live', ENDED afterwards — nothing else ever claims to be live. */
export function CoverageStatusChip({ c }: { c: Pick<LiveCoverage, 'state' | 'archived'> }) {
  return <LabelChip label={c.state === 'live' ? 'live' : 'ended'} />;
}

/** One line of facts: "Updated 8 min ago · 4 updates" (live) or "Ended 3 Nov, 06:25 · 5 updates" (+ "ran 6 hrs" when `long`). */
export function coverageMeta(c: LiveCoverage, now = Date.now(), long = false) {
  if (c.state === 'live') {
    return [c.lastUpdateAt ? `Updated ${timeAgo(c.lastUpdateAt, now).toLowerCase()}` : c.startedAt ? `Started ${shortDateTime(c.startedAt, now)}` : null, updateCountText(c.updateCount)]
      .filter(Boolean)
      .join(' · ');
  }
  const ran = long ? coverageDuration(c) : '';
  return [c.endedAt ? `Ended ${shortDateTime(c.endedAt, now)}` : 'Ended', ran ? `ran ${ran}` : null, updateCountText(c.updateCount)].filter(Boolean).join(' · ');
}

function a11y(c: LiveCoverage, now: number) {
  return [c.state === 'live' ? 'Live now' : c.archived ? 'Archived live coverage, ended' : 'Live coverage, ended', c.headline, c.isDemo ? 'Demo content' : null, coverageMeta(c, now, true)]
    .filter(Boolean)
    .join('. ');
}

/** Hub lead: the most recently updated ongoing coverage, with a preview of its latest update. */
export function LiveLeadCard({ c, now }: { c: LiveCoverage; now: number }) {
  const t = useTheme();
  const { content } = useFeedWidth();
  // tablets: a wider crop keeps the headline and latest update above the fold
  const ratio = content > 500 ? 2.2 : 16 / 9;
  return (
    <Tap onPress={() => openArticle(c.id)} accessibilityRole="link" accessibilityLabel={a11y(c, now)} pressScale={0.985} style={{ gap: 10 }}>
      {c.image ? (
        <View>
          <ArticleImage image={c.image} width={content} ratio={ratio} radius={14} priority="high" accessible={false} recyclingKey={c.id} />
          <View style={{ position: 'absolute', left: 12, top: 12, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <CoverageStatusChip c={c} />
            {c.isDemo ? <DemoBadge onDark style={{ backgroundColor: 'rgba(6,26,64,0.75)' }} /> : null}
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <CoverageStatusChip c={c} />
          {c.isDemo ? <DemoBadge /> : null}
        </View>
      )}
      <Txt variant="kicker" size={11} color={t.c.link} numberOfLines={1} style={{ marginTop: 4 }}>
        {c.category.name}
        {c.location?.name ? ` · ${c.location.name}` : ''}
      </Txt>
      <Txt variant="display" size={23} lineHeight={28} numberOfLines={4}>
        {c.headline}
      </Txt>
      {c.standfirst ? (
        <Txt variant="serif" size={15.5} lineHeight={23} muted numberOfLines={2}>
          {c.standfirst}
        </Txt>
      ) : null}
      {c.latestUpdate ? (
        <View style={{ backgroundColor: t.c.surface, borderRadius: 12, overflow: 'hidden', flexDirection: 'row' }}>
          <View style={{ width: 3, backgroundColor: t.c.live }} />
          <View style={{ flex: 1, padding: 14, gap: 6 }}>
            <Txt variant="kicker" size={10.5} color={t.c.live}>
              Latest{c.lastUpdateAt ? ` · ${timeAgo(c.lastUpdateAt, now)}` : ''}
            </Txt>
            {c.latestUpdate.headline ? (
              <Txt variant="headline" size={15.5} lineHeight={20} numberOfLines={2}>
                {c.latestUpdate.headline}
              </Txt>
            ) : null}
            <Txt variant="serif" size={15} lineHeight={22} color={t.c.text} numberOfLines={3}>
              {c.latestUpdate.text}
            </Txt>
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Txt variant="ui" size={12.5} muted>
          {[c.startedAt ? `Started ${shortDateTime(c.startedAt, now)}` : null, updateCountText(c.updateCount)].filter(Boolean).join(' · ')}
        </Txt>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Txt variant="uiBold" size={13} color={t.c.link}>
            Follow live
          </Txt>
          <Icon name="chevron-right" size={16} color={t.c.link} />
        </View>
      </View>
    </Tap>
  );
}

/** Compact coverage row: status chip, headline, facts, thumbnail. Used for further live, recently ended and archive. */
export function LiveCoverageRow({ c, now, divider = true }: { c: LiveCoverage; now: number; divider?: boolean }) {
  const t = useTheme();
  return (
    <Tap
      onPress={() => openArticle(c.id)}
      accessibilityRole="link"
      accessibilityLabel={a11y(c, now)}
      pressScale={0.985}
      style={{ flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: divider ? 1 : 0, borderBottomColor: t.c.border }}
    >
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <CoverageStatusChip c={c} />
          <Txt variant="kicker" size={10.5} color={t.c.link} numberOfLines={1} style={{ flexShrink: 1 }}>
            {c.category.name}
          </Txt>
        </View>
        <Txt variant="headline" size={16} lineHeight={21} numberOfLines={3}>
          {c.headline}
        </Txt>
        {c.state === 'live' && c.latestUpdate ? (
          <Txt variant="ui" size={13} lineHeight={18} muted numberOfLines={2}>
            {c.latestUpdate.headline ? `${c.latestUpdate.headline}: ` : ''}
            {c.latestUpdate.text}
          </Txt>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Txt variant="ui" size={12} muted style={{ flexShrink: 1 }}>
            {coverageMeta(c, now)}
          </Txt>
          {c.isDemo ? <DemoBadge /> : null}
        </View>
      </View>
      {c.image ? <ArticleImage image={c.image} width={104} ratio={4 / 3} radius={10} accessible={false} recyclingKey={c.id} /> : null}
    </Tap>
  );
}
