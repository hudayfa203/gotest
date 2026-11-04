import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { timeAgo } from '../../lib/format';
import { useTheme } from '../../state/theme';
import type { LiveCoverage } from '../../types';
import { Icon } from '../Icon';
import { DemoBadge } from '../Labels';
import { LivePulse } from '../LivePulse';
import { Tap } from '../Tap';
import { Txt } from '../Txt';

/**
 * Home: compact LIVE UPDATES entry (ongoing live coverage from GET /home `liveNow`) → Live hub.
 *
 * It sits directly under the red breaking-news banner (sharing its card when both are shown) but is a different
 * feature: a deep-red strip with a white "LIVE UPDATES" pill (same identity as the website's red bar), it never shows
 * breaking alerts, and it only renders while something is actually live.
 */
export function LiveUpdatesEntry({ items, attached = false }: { items: LiveCoverage[]; attached?: boolean }) {
  const { isDark } = useTheme(); // dark mode only adds a hairline border; the strip keeps the brand's deep red
  const top = items[0];
  if (!top) return null;
  const n = items.length;
  const when = top.lastUpdateAt ? timeAgo(top.lastUpdateAt) : null;
  const label = [
    'Live updates',
    n > 1 ? `${n} live coverages` : null,
    top.headline,
    top.isDemo ? 'Demo content' : null,
    when ? `Updated ${when.toLowerCase()}` : null,
  ].filter(Boolean).join('. ');
  const r = 12;
  return (
    <Animated.View entering={attached ? FadeIn.duration(300) : FadeInDown.duration(350)} style={{ paddingHorizontal: 12, paddingTop: attached ? 0 : 10, paddingBottom: 12 }}>
      <Tap
        onPress={() => router.push('/live' as Href)}
        haptics
        pressScale={0.985}
        accessibilityRole="link"
        accessibilityLabel={label}
        accessibilityHint="Opens live coverage"
        style={{
          backgroundColor: '#8A0911',
          borderBottomLeftRadius: r,
          borderBottomRightRadius: r,
          borderTopLeftRadius: attached ? 0 : r,
          borderTopRightRadius: attached ? 0 : r,
          borderWidth: isDark ? 1 : 0,
          borderTopWidth: attached ? 0 : isDark ? 1 : 0,
          borderColor: '#A10B14',
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 10,
          paddingLeft: 14,
          paddingRight: 10,
          gap: 12,
          minHeight: 54,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: 999, paddingLeft: 9, paddingRight: 10, paddingVertical: 3 }}>
              <LivePulse color="#E1141E" size={8} />
              <Txt variant="kicker" size={11} color="#C8101A" style={{ letterSpacing: 1.2 }} maxFontSizeMultiplier={1.3}>
                Live updates
              </Txt>
            </View>
            {n > 1 ? (
              <View style={{ borderColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 0 }}>
                <Txt variant="uiBold" size={10.5} color="#FFFFFF" maxFontSizeMultiplier={1.3}>
                  {n} live
                </Txt>
              </View>
            ) : null}
            {when ? (
              <Txt variant="ui" size={11.5} color="rgba(255,255,255,0.8)" numberOfLines={1} style={{ flexShrink: 1 }} maxFontSizeMultiplier={1.4}>
                {when}
              </Txt>
            ) : null}
            {top.isDemo ? <DemoBadge onDark style={{ paddingVertical: 0, marginLeft: 'auto' }} /> : null}
          </View>
          <Txt variant="title" size={14.5} lineHeight={19} color="#FFFFFF" numberOfLines={1}>
            {top.headline}
          </Txt>
        </View>
        <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.9)" />
      </Tap>
    </Animated.View>
  );
}
