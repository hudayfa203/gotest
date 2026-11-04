import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { openArticle, openWebUrl } from '../lib/navigation';
import type { BreakingAlert } from '../types';
import { Icon } from './Icon';
import { DemoBadge } from './Labels';
import { LivePulse } from './LivePulse';
import { Tap } from './Tap';
import { Txt } from './Txt';

const LEVEL: Record<BreakingAlert['level'], { label: string; bg: string }> = {
  breaking: { label: 'Breaking', bg: '#C8101A' },
  live: { label: 'Live', bg: '#C8101A' },
  developing: { label: 'Developing', bg: '#9A4708' },
};

/** Alerts that have not ended yet. */
export function activeAlerts(alerts: BreakingAlert[] | undefined, now = Date.now()) {
  return (alerts ?? []).filter((a) => !a.endsAt || Date.parse(a.endsAt) > now);
}

/**
 * Breaking-news banner from GET /home `breaking` (or /alerts). Rotates when there are several.
 * Alerts only — live coverage has its own entry (LiveUpdatesEntry) which may be attached below (`attachedBelow`).
 */
export function BreakingBanner({ alerts, attachedBelow = false }: { alerts: BreakingAlert[]; attachedBelow?: boolean }) {
  const active = activeAlerts(alerts);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (active.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % active.length), 6000);
    return () => clearInterval(t);
  }, [active.length]);
  if (!active.length) return null;
  const a = active[i % active.length];
  const lv = LEVEL[a.level] ?? LEVEL.breaking;
  const open = () => (a.articleId ? openArticle(a.articleId) : a.url ? openWebUrl(a.url) : undefined);
  return (
    <Animated.View entering={FadeInDown.duration(350)} style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: attachedBelow ? 0 : 4 }}>
      <Tap
        onPress={open}
        disabled={!a.articleId && !a.url}
        haptics
        pressScale={attachedBelow ? 0.99 : undefined}
        accessibilityRole="link"
        accessibilityLabel={`${lv.label}: ${a.headline}${a.isDemo ? '. Demo content' : ''}`}
        style={{
          backgroundColor: lv.bg,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderBottomLeftRadius: attachedBelow ? 0 : 12,
          borderBottomRightRadius: attachedBelow ? 0 : 12,
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: 14,
          gap: 12,
          minHeight: 56,
        }}
      >
        <View style={{ alignItems: 'center', gap: 6 }}>
          <LivePulse color="#FFFFFF" size={9} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt variant="kicker" size={10.5} color="rgba(255,255,255,0.9)">
              {lv.label}
              {active.length > 1 ? ` · ${(i % active.length) + 1}/${active.length}` : ''}
            </Txt>
            {a.isDemo ? <DemoBadge onDark style={{ paddingVertical: 0 }} /> : null}
          </View>
          <Animated.View key={a.id} entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)}>
            <Txt variant="headline" size={15.5} lineHeight={20} color="#FFFFFF" numberOfLines={2}>
              {a.headline}
            </Txt>
          </Animated.View>
        </View>
        {a.articleId || a.url ? <Icon name="chevron-right" size={20} color="#FFFFFF" /> : null}
      </Tap>
    </Animated.View>
  );
}
