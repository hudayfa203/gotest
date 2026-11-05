import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { endpoints } from '../../api';
import { ArticleImage } from '../../components/ArticleImage';
import { useFeedWidth } from '../../components/cards';
import { Icon } from '../../components/Icon';
import { DemoBadge } from '../../components/Labels';
import { LivePulse } from '../../components/LivePulse';
import { SectionHeader } from '../../components/SectionHeader';
import { Tap } from '../../components/Tap';
import { Txt } from '../../components/Txt';
import { timeAgo } from '../../lib/format';
import { openArticle } from '../../lib/navigation';
import type { ArticleSummary } from '../../types';
import { LAND_DOTS, MAP_H, MAP_W, OUTLINE } from './mapData';
import { cluster, project } from './projection';

const DAY = 24 * 3600 * 1000;
const RED = '#E1141E';
const SKY = '#2EA3F2';

/**
 * World Pulse (as on goworld.news): the latest stories that carry a location, on a dotted world map. Red markers =
 * published in the last 24 hours; markers that would overlap share one with a count. Tap a marker to preview the
 * story; the list below is the accessible equivalent of the map.
 */
export function WorldPulse() {
  const { content, full } = useFeedWidth();
  const q = useQuery({ queryKey: ['pulse'], queryFn: ({ signal }) => endpoints.pulse(signal), staleTime: 5 * 60_000 });
  const stories = useMemo(() => (q.data ?? []).filter((s) => s.location), [q.data]);
  const scale = content / MAP_W;
  const mapH = Math.round(MAP_H * scale);
  const placed = useMemo(() => {
    const pts = stories.flatMap((s) => {
      const p = project(s.location!.lng, s.location!.lat);
      return p ? [{ ...p, item: s }] : [];
    });
    return cluster(pts, 26 / scale);
  }, [stories, scale]);
  const [sel, setSel] = useState(0);
  if (!placed.length) return null;
  const now = Date.now();
  const current = placed[Math.min(sel, placed.length - 1)];
  const lead = current.items[0];

  return (
    <View style={{ backgroundColor: '#061A40', width: full, alignSelf: 'center', paddingTop: 22, paddingBottom: 24 }} accessibilityLabel="World Pulse: where our latest reporting is happening">
      <SectionHeader title="World Pulse" dark />
      <Txt variant="serif" size={15.5} lineHeight={23} color="rgba(255,255,255,0.78)" style={{ paddingHorizontal: 16, marginTop: -6 }}>
        Where our latest reporting is happening. Tap a marker to preview the story.
      </Txt>
      <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 16, marginTop: 10 }} accessibilityElementsHidden>
        <Legend color={RED} label="Last 24 hours" />
        <Legend color={SKY} label="Earlier" />
      </View>

      <View style={{ width: content, height: mapH, alignSelf: 'center', marginTop: 14 }}>
        <Svg width={content} height={mapH} viewBox={`0 0 ${MAP_W} ${MAP_H}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="45%" r="60%">
              <Stop offset="0" stopColor={SKY} stopOpacity={0.2} />
              <Stop offset="1" stopColor={SKY} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Path d={OUTLINE} fill="url(#glow)" stroke="#8CC8FF" strokeOpacity={0.22} strokeWidth={1.2} />
          <Path d={LAND_DOTS} stroke="#8CC8FF" strokeOpacity={0.5} strokeWidth={4} strokeLinecap="round" fill="none" />
        </Svg>
        {placed.map((p, i) => {
          const recent = p.items.some((s) => now - Date.parse(s.publishedAt) < DAY);
          const on = i === sel;
          const size = p.items.length > 1 ? 22 : on ? 16 : 13;
          return (
            <Tap
              key={`${p.items[0].id}`}
              onPress={() => setSel(i)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`${p.items.length > 1 ? `${p.items.length} stories near ` : ''}${p.items[0].location?.name}`}
              style={{ position: 'absolute', left: p.x * scale - size / 2, top: p.y * scale - size / 2, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
            >
              {on && recent ? (
                <View style={{ position: 'absolute' }}>
                  <LivePulse color={RED} size={size} />
                </View>
              ) : null}
              <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: recent ? RED : SKY, borderWidth: on ? 2.5 : 1.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                {p.items.length > 1 ? (
                  <Txt variant="uiBold" size={11} color="#FFFFFF" maxFontSizeMultiplier={1}>
                    {p.items.length}
                  </Txt>
                ) : null}
              </View>
            </Tap>
          );
        })}
      </View>

      <Animated.View key={lead.id} entering={FadeIn.duration(220)} style={{ marginHorizontal: 16, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(140,200,255,0.25)' }}>
        {current.items.slice(0, 3).map((s, k) => (
          <PulseRow key={s.id} s={s} divider={k < Math.min(current.items.length, 3) - 1} />
        ))}
      </Animated.View>

      <Txt variant="display" size={16} color="#FFFFFF" style={{ paddingHorizontal: 16, marginTop: 20, marginBottom: 4, fontFamily: 'Montserrat-900-Italic' }} accessibilityRole="header">
        Stories on the map
      </Txt>
      <View style={{ paddingHorizontal: 16 }}>
        {stories.slice(0, 6).map((s, k) => (
          <Tap key={s.id} onPress={() => openArticle(s.id)} accessibilityRole="link" accessibilityLabel={`${s.location?.name}. ${s.headline}${s.isDemo ? '. Demo content' : ''}`} style={{ paddingVertical: 10, borderBottomWidth: k < Math.min(stories.length, 6) - 1 ? 1 : 0, borderBottomColor: 'rgba(140,200,255,0.18)', gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Txt variant="kicker" size={12} color="#8CC8FF">
                {s.location?.name}
              </Txt>
              {s.isDemo ? <DemoBadge onDark style={{ paddingVertical: 0 }} /> : null}
            </View>
            <Txt variant="uiBold" size={15} lineHeight={20} color="#FFFFFF" numberOfLines={2}>
              {s.headline}
            </Txt>
          </Tap>
        ))}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color, borderWidth: 1, borderColor: '#FFFFFF' }} />
      <Txt variant="ui" size={12} color="rgba(255,255,255,0.8)">
        {label}
      </Txt>
    </View>
  );
}

function PulseRow({ s, divider }: { s: ArticleSummary; divider: boolean }) {
  return (
    <Tap onPress={() => openArticle(s.id)} accessibilityRole="link" accessibilityLabel={`${s.location?.name}. ${s.headline}`} style={{ flexDirection: 'row', gap: 12, padding: 12, alignItems: 'center', borderBottomWidth: divider ? 1 : 0, borderBottomColor: 'rgba(140,200,255,0.18)' }}>
      {s.image ? <ArticleImage image={s.image} width={76} ratio={4 / 3} radius={8} accessible={false} /> : null}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="globe" size={13} color="#8CC8FF" />
          <Txt variant="kicker" size={12} color="#8CC8FF" numberOfLines={1} style={{ flexShrink: 1 }}>
            {s.location?.name} · {timeAgo(s.publishedAt)}
          </Txt>
        </View>
        <Txt variant="uiBold" size={14.5} lineHeight={19} color="#FFFFFF" numberOfLines={3}>
          {s.headline}
        </Txt>
      </View>
      <Icon name="chevron-right" size={18} color="rgba(255,255,255,0.7)" />
    </Tap>
  );
}
