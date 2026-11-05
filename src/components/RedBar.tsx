import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { timeAgo } from '../lib/format';
import { openArticle, openWebUrl } from '../lib/navigation';
import { fonts } from '../theme';
import type { BreakingAlert, LiveCoverage } from '../types';
import { Icon } from './Icon';
import { DemoBadge } from './Labels';
import { LivePulse } from './LivePulse';
import { Tap } from './Tap';
import { Txt } from './Txt';

const LEVEL: Record<string, string> = { breaking: 'Breaking', developing: 'Developing', live: 'Breaking' };

/** "Demo: …" headlines show the Demo marker instead of the prefix (as on the website). */
function cleanHeadline(a: BreakingAlert) {
  const prefixed = /^demo:\s*/i.test(a.headline);
  const headline = prefixed ? a.headline.replace(/^demo:\s*/i, '').replace(/^./, (c) => c.toUpperCase()) : a.headline;
  return { headline, isDemo: !!a.isDemo || prefixed };
}

/**
 * The red bar from goworld.news, edge to edge under the header. Two separate editorial functions share it:
 *   row 1 — breaking-news alerts (rotating when there are several), slanted white "Breaking" tag;
 *   row 2 — LIVE UPDATES: ongoing live coverage → the Live tab.
 * Either row can appear without the other; nothing renders when both are empty.
 */
export function RedBar({ alerts, live }: { alerts: BreakingAlert[]; live: LiveCoverage[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (alerts.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % alerts.length), 6000);
    return () => clearInterval(t);
  }, [alerts.length]);
  if (!alerts.length && !live.length) return null;
  const a = alerts.length ? alerts[i % alerts.length] : null;
  const top = live[0];
  const when = top?.lastUpdateAt ? timeAgo(top.lastUpdateAt) : null;
  return (
    <View>
      {a ? <AlertRow a={a} index={i % alerts.length} count={alerts.length} /> : null}
      {top ? (
        <Tap
          onPress={() => router.navigate('/live' as Href)}
          haptics
          pressScale={0.99}
          accessibilityRole="link"
          accessibilityLabel={['Live updates', live.length > 1 ? `${live.length} live coverages` : null, top.headline, top.isDemo ? 'Demo content' : null, when ? `Updated ${when.toLowerCase()}` : null].filter(Boolean).join('. ')}
          accessibilityHint="Opens the Live tab"
          style={{ backgroundColor: '#A00D15', flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingLeft: 12, paddingRight: 10, gap: 10, minHeight: 50 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: 999, paddingLeft: 9, paddingRight: 11, paddingVertical: 4 }}>
            <LivePulse color="#E1141E" size={8} />
            <Txt variant="kicker" size={11} color="#C8101A" style={{ fontFamily: fonts.display900Italic, letterSpacing: 0.6 }} maxFontSizeMultiplier={1.25}>
              LIVE UPDATES
            </Txt>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="uiBold" size={14} lineHeight={18} color="#FFFFFF" numberOfLines={1}>
              {top.headline}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {live.length > 1 ? (
                <Txt variant="uiBold" size={11.5} color="#FFFFFF" maxFontSizeMultiplier={1.3}>
                  {live.length} live
                </Txt>
              ) : null}
              {when ? (
                <Txt variant="ui" size={11.5} color="rgba(255,255,255,0.8)" maxFontSizeMultiplier={1.3}>
                  Updated {when.toLowerCase()}
                </Txt>
              ) : null}
              {top.isDemo ? <DemoBadge onDark style={{ paddingVertical: 0 }} /> : null}
            </View>
          </View>
          <Icon name="chevron-right" size={20} color="#FFFFFF" />
        </Tap>
      ) : null}
    </View>
  );
}

function AlertRow({ a, index, count }: { a: BreakingAlert; index: number; count: number }) {
  const { headline, isDemo } = cleanHeadline(a);
  const label = LEVEL[a.level] ?? 'Breaking';
  const open = () => (a.articleId ? openArticle(a.articleId) : a.url ? openWebUrl(a.url) : undefined);
  const bg = a.level === 'developing' ? '#B4540A' : '#D0121B';
  return (
    <Tap
      onPress={open}
      disabled={!a.articleId && !a.url}
      haptics
      pressScale={0.99}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${headline}${isDemo ? '. Demo content' : ''}${count > 1 ? `. Alert ${index + 1} of ${count}` : ''}`}
      style={{ backgroundColor: bg, flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingLeft: 12, paddingRight: 10, gap: 12, minHeight: 58 }}
    >
      <View style={{ backgroundColor: '#FFFFFF', transform: [{ skewX: '-14deg' }], paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 4, height: 12, backgroundColor: bg }} />
        <Txt variant="kicker" size={13} color={bg} style={{ fontFamily: fonts.display900Italic, transform: [{ skewX: '14deg' }] }} maxFontSizeMultiplier={1.25}>
          {label}
        </Txt>
      </View>
      <Animated.View key={a.id} entering={FadeIn.duration(260)} exiting={FadeOut.duration(140)} style={{ flex: 1, gap: 4 }}>
        <Txt variant="uiBold" size={15} lineHeight={19} color="#FFFFFF" numberOfLines={2}>
          {headline}
        </Txt>
        {isDemo || count > 1 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isDemo ? <DemoBadge onDark style={{ paddingVertical: 0 }} /> : null}
            {count > 1 ? (
              <View style={{ flexDirection: 'row', gap: 4 }} accessibilityElementsHidden>
                {Array.from({ length: count }, (_, k) => (
                  <View key={k} style={{ width: k === index ? 14 : 5, height: 5, borderRadius: 3, backgroundColor: k === index ? '#FFFFFF' : 'rgba(255,255,255,0.45)' }} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </Animated.View>
      {a.articleId || a.url ? <Icon name="chevron-right" size={20} color="#FFFFFF" /> : null}
    </Tap>
  );
}
