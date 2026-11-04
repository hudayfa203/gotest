import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { formatDateTime, formatTime, shortDateTime, timeAgo } from '../../lib/format';
import { LIVE_POLL_MS, coverageDuration, isEdited, splitPinned, updateCountText, type CoverageStatus, type LiveFeedState } from '../../lib/live';
import { useTheme } from '../../state/theme';
import type { LiveCoverage, LiveUpdate } from '../../types';
import { Blocks } from '../article/Blocks';
import { Icon } from '../Icon';
import { LivePulse } from '../LivePulse';
import { Button } from '../StateViews';
import { Tap } from '../Tap';
import { Txt } from '../Txt';

const PAGE = 25;

// ------------------------------------------------------------------------------------------- status banner

/**
 * LIVE / ENDED / archived banner with times. `stale` (live at the last check, but that check is old — offline or the
 * server unreachable) never shows LIVE: it says when the page was last refreshed instead.
 */
export function LiveStatusBanner({
  status, coverage, fetchedAt, now, offline,
}: {
  status: CoverageStatus;
  coverage: Pick<LiveCoverage, 'startedAt' | 'endedAt' | 'lastUpdateAt' | 'updateCount'>;
  fetchedAt: number | null;
  now: number;
  offline: boolean;
}) {
  const { c, isDark } = useTheme();
  const started = coverage.startedAt ? shortDateTime(coverage.startedAt, now) : null;
  const ended = coverage.endedAt ? shortDateTime(coverage.endedAt, now) : null;
  const ran = coverageDuration(coverage);
  const count = updateCountText(coverage.updateCount);

  let title: string;
  let detail: string;
  let tone: 'live' | 'muted' = 'muted';
  switch (status) {
    case 'live':
      tone = 'live';
      title = coverage.lastUpdateAt ? `Live · updated ${timeAgo(coverage.lastUpdateAt, now).toLowerCase()}` : 'Live · coverage under way';
      detail = [started ? `Started ${started}` : null, count, `New updates appear automatically`].filter(Boolean).join(' · ');
      break;
    case 'stale':
      title = fetchedAt ? `Not refreshed since ${formatTime(new Date(fetchedAt).toISOString())}` : 'Live coverage';
      detail = offline ? 'You’re offline. New updates load when you reconnect.' : 'GO World News couldn’t be reached. Retrying automatically.';
      break;
    case 'ended':
      title = 'This live coverage has ended';
      detail = [ended ? `Ended ${ended}` : null, ran ? `ran ${ran}` : null, count].filter(Boolean).join(' · ');
      break;
    case 'archived': {
      title = 'From the live archive';
      const sameDay = !!coverage.startedAt && !!coverage.endedAt && new Date(coverage.startedAt).toDateString() === new Date(coverage.endedAt).toDateString();
      const span = started && ended ? `Ran ${started} – ${sameDay ? formatTime(coverage.endedAt!) : ended}` : ended ? `Ended ${ended}` : null;
      detail = [span, count].filter(Boolean).join(' · ');
      break;
    }
  }

  const bg = tone === 'live' ? (isDark ? 'rgba(255,90,95,0.12)' : '#FDF0F0') : c.surface;
  const accent = tone === 'live' ? c.live : status === 'stale' ? c.warning : isDark ? '#3A4A66' : '#8A96AB';
  const a11y = status === 'live' ? `Live coverage. ${title}. ${detail}` : `${title}. ${detail}`;
  // the status chip (LIVE / ENDED) sits next to the headline; the banner adds the times without repeating it
  const icon = status === 'archived' ? 'archive' : status === 'stale' ? 'offline' : 'clock';
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={a11y}
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: bg, borderRadius: 12, overflow: 'hidden', flexDirection: 'row' }}
    >
      <View style={{ width: 4, backgroundColor: accent }} />
      <View style={{ flex: 1, paddingVertical: 12, paddingLeft: 12, paddingRight: 14, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          {status === 'live' ? <LivePulse color={c.live} size={9} /> : <Icon name={icon} size={16} color={status === 'stale' ? c.warning : c.textMuted} />}
          <Txt variant="uiBold" size={14} color={tone === 'live' ? c.live : c.heading} style={{ flex: 1 }} numberOfLines={2}>
            {title}
          </Txt>
        </View>
        {detail ? (
          <Txt variant="ui" size={12.5} lineHeight={17} muted style={{ paddingLeft: 25 }}>
            {detail}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------------------------------- timeline

export function LiveTimeline({
  articleId, feed, status, loading, failed, width, scale, now, newIds,
}: {
  articleId: string;
  feed: LiveFeedState | null;
  status: CoverageStatus | null;
  loading: boolean;
  failed: boolean;
  width: number;
  scale: number;
  now: number;
  newIds: Set<string>;
}) {
  const { c } = useTheme();
  const [visible, setVisible] = useState(PAGE);
  const live = status === 'live';
  const { key, timeline } = splitPinned(feed?.updates ?? []);
  const shown = timeline.slice(0, visible);
  const hidden = timeline.length - shown.length;
  const coverage = feed?.coverage;

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottomWidth: 3, borderBottomColor: live ? c.live : c.border }}>
        {live ? <LivePulse color={c.live} size={10} /> : <Icon name={status === 'stale' ? 'offline' : 'clock'} size={16} color={c.textMuted} />}
        <Txt variant="headline" size={18} style={{ flex: 1 }} accessibilityRole="header">
          Live updates
        </Txt>
        {feed ? (
          <Txt
            variant="ui"
            size={11.5}
            muted
            accessibilityLabel={live ? `Last checked at ${formatTime(new Date(feed.fetchedAt).toISOString())}. Refreshes automatically every ${LIVE_POLL_MS / 1000} seconds.` : undefined}
          >
            {live ? `Auto-refresh · ${formatTime(new Date(feed.fetchedAt).toISOString())}` : updateCountText(feed.updates.length)}
          </Txt>
        ) : null}
      </View>

      {!feed && loading ? (
        <Txt variant="ui" size={14} muted style={{ paddingVertical: 16 }}>
          Loading updates…
        </Txt>
      ) : null}
      {!feed && !loading && failed ? (
        <Txt variant="ui" size={14} muted style={{ paddingVertical: 16 }}>
          Live updates couldn’t be loaded. {status === 'live' || status === 'stale' ? 'They will retry automatically.' : 'Pull down or reopen this page to try again.'}
        </Txt>
      ) : null}
      {feed && !feed.updates.length ? (
        <Txt variant="ui" size={14} muted style={{ paddingVertical: 16 }}>
          {live ? 'No updates yet — they will appear here as soon as they are published.' : 'This coverage has no updates.'}
        </Txt>
      ) : null}

      {key.length ? (
        <View style={{ gap: 10, paddingTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="pin" size={14} color={c.heading} />
            <Txt variant="kicker" size={11.5} color={c.heading} accessibilityRole="header">
              Key {key.length === 1 ? 'update' : 'updates'}
            </Txt>
          </View>
          {key.map((u) => (
            <Animated.View key={u.id} entering={FadeInDown.duration(320)} layout={LinearTransition.duration(240)}>
              <KeyUpdateCard u={u} articleId={articleId} width={width} scale={scale} now={now} isNew={newIds.has(u.id)} />
            </Animated.View>
          ))}
        </View>
      ) : null}

      {coverage && coverage.state === 'ended' && coverage.endedAt && feed?.updates.length ? (
        <Marker icon="clock" text={`Coverage ended · ${formatDateTime(coverage.endedAt)}`} strong />
      ) : null}

      <View style={{ paddingTop: 6 }}>
        {shown.map((u, i) => (
          <Animated.View key={u.id} entering={FadeInDown.duration(380)} layout={LinearTransition.duration(260)}>
            <UpdateItem u={u} articleId={articleId} width={width} scale={scale} now={now} first={i === 0} last={i === shown.length - 1 && !hidden} pulse={live && i === 0} live={live} isNew={newIds.has(u.id)} />
          </Animated.View>
        ))}
      </View>

      {hidden > 0 ? (
        <Button kind="secondary" title={`Show ${Math.min(hidden, PAGE)} earlier ${Math.min(hidden, PAGE) === 1 ? 'update' : 'updates'}`} onPress={() => setVisible((v) => v + PAGE)} style={{ marginTop: 8 }} accessibilityHint={`${hidden} earlier updates are not shown yet`} />
      ) : coverage?.startedAt && feed?.updates.length ? (
        <Marker icon="broadcast" text={`Coverage started · ${formatDateTime(coverage.startedAt)}`} />
      ) : null}
    </View>
  );
}

function Marker({ icon, text, strong }: { icon: 'clock' | 'broadcast'; text: string; strong?: boolean }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="text" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
      <View style={{ width: 16, alignItems: 'center' }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={12} color={c.textMuted} />
        </View>
      </View>
      <Txt variant={strong ? 'uiBold' : 'uiStrong'} size={12.5} color={strong ? c.heading : c.textMuted}>
        {text}
      </Txt>
    </View>
  );
}

function UpdateMeta({ u, now, isNew, color }: { u: LiveUpdate; now: number; isNew: boolean; color?: string }) {
  const { c } = useTheme();
  const recent = now - Date.parse(u.at) < 86_400_000;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Txt variant="uiBold" size={13} color={color ?? c.live} accessibilityLabel={`Posted ${formatDateTime(u.at)}`}>
        {recent ? formatTime(u.at) : shortDateTime(u.at, now)}
      </Txt>
      {recent ? (
        <Txt variant="ui" size={12} muted>
          {timeAgo(u.at, now)}
        </Txt>
      ) : null}
      {isNew ? (
        <View style={{ borderWidth: 1, borderColor: c.live, borderRadius: 4, paddingHorizontal: 5 }}>
          <Txt variant="kicker" size={9} color={c.live}>
            New
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

function UpdateFooter({ u }: { u: LiveUpdate }) {
  const { c } = useTheme();
  const edited = isEdited(u);
  if (!u.author && !edited) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
      {u.author ? (
        u.author.slug ? (
          <Tap onPress={() => router.push(`/author/${u.author!.slug}` as Href)} accessibilityRole="link" accessibilityLabel={`By ${u.author.name}. Open author page.`} hitSlop={8} style={{ minHeight: 28, justifyContent: 'center' }}>
            <Txt variant="uiStrong" size={12.5} color={c.link}>
              {u.author.name}
            </Txt>
          </Tap>
        ) : (
          <Txt variant="uiStrong" size={12.5} muted>
            {u.author.name}
          </Txt>
        )
      ) : null}
      {edited && u.updatedAt ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessible accessibilityLabel={`Edited ${formatDateTime(u.updatedAt)}`}>
          <Icon name="pencil" size={12} color={c.textMuted} />
          <Txt variant="ui" size={12} muted>
            Edited {formatTime(u.updatedAt)}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

function KeyUpdateCard({ u, articleId, width, scale, now, isNew }: { u: LiveUpdate; articleId: string; width: number; scale: number; now: number; isNew: boolean }) {
  const { c } = useTheme();
  const s = Math.min(scale, 1.3);
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 14, padding: 16, gap: 8, borderWidth: 1, borderColor: c.border }}>
      <UpdateMeta u={u} now={now} isNew={isNew} color={c.heading} />
      {u.headline ? (
        <Txt variant="headline" size={18 * s} lineHeight={Math.round(23 * s)}>
          {u.headline}
        </Txt>
      ) : null}
      <Blocks blocks={u.body} ctx={{ width: width - 34, scale: scale * 0.94, articleId }} />
      <UpdateFooter u={u} />
    </View>
  );
}

function UpdateItem({ u, articleId, width, scale, now, first, last, pulse, live, isNew }: { u: LiveUpdate; articleId: string; width: number; scale: number; now: number; first: boolean; last: boolean; pulse: boolean; live: boolean; isNew: boolean }) {
  const { c } = useTheme();
  const s = Math.min(scale, 1.3);
  const RAIL = 16;
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: RAIL, alignItems: 'center' }}>
        <View style={{ width: 2, height: 6, backgroundColor: first ? 'transparent' : c.border }} />
        {pulse ? (
          <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
            <LivePulse color={c.live} size={10} />
          </View>
        ) : (
          <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: isNew ? c.live : c.textMuted, backgroundColor: c.bg, marginVertical: 1 }} />
        )}
        {!last ? <View style={{ flex: 1, width: 2, backgroundColor: c.border }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 8, paddingBottom: 22 }}>
        {/* red times only while the coverage is live */}
        <UpdateMeta u={u} now={now} isNew={isNew} color={live ? undefined : c.heading} />
        {u.headline ? (
          <Txt variant="headline" size={17 * s} lineHeight={Math.round(22 * s)}>
            {u.headline}
          </Txt>
        ) : null}
        <Blocks blocks={u.body} ctx={{ width: width - RAIL - 12, scale: scale * 0.94, articleId }} />
        <UpdateFooter u={u} />
      </View>
    </View>
  );
}
