import { View, type ViewStyle } from 'react-native';
import { displayLabels, type DisplayLabel } from '../lib/live';
import { useTheme } from '../state/theme';
import type { Label, LiveState } from '../types';
import { LivePulse } from './LivePulse';
import { Txt } from './Txt';

const NAMES: Record<DisplayLabel, string> = {
  breaking: 'Breaking',
  live: 'Live',
  ended: 'Ended',
  exclusive: 'Exclusive',
  developing: 'Developing',
  sponsored: 'Sponsored',
  fact_check: 'Fact check',
};

/** Editorial label with the brand's 15° slant (like the NEWS bar). 'live' pulses; 'ended' is a quiet slate chip. */
export function LabelChip({ label, style }: { label: DisplayLabel; style?: ViewStyle }) {
  const { c, isDark } = useTheme();
  const bg =
    label === 'breaking' || label === 'live' ? c.breaking
    : label === 'ended' ? (isDark ? '#2A3C5C' : '#4A5871')
    : label === 'developing' ? c.developing
    : label === 'exclusive' ? (isDark ? '#FFFFFF' : c.exclusive)
    : label === 'sponsored' ? (isDark ? '#3A4A66' : '#5B6577')
    : '#1A4FB0';
  const fg = label === 'exclusive' && isDark ? '#061A40' : label === 'developing' && isDark ? '#1A1000' : label === 'ended' && isDark ? '#E8EEF8' : '#FFFFFF';
  return (
    <View style={[{ flexDirection: 'row', alignSelf: 'flex-start' }, style]} accessibilityRole="text" accessibilityLabel={label === 'ended' ? 'Live coverage ended' : label === 'live' ? 'Live now' : NAMES[label]}>
      <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, transform: [{ skewX: '-12deg' }], borderRadius: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {label === 'live' ? <LivePulse color="#FFFFFF" size={6} /> : null}
        <Txt variant="kicker" size={10.5} color={fg} style={{ transform: [{ skewX: '12deg' }] }}>
          {NAMES[label]}
        </Txt>
      </View>
    </View>
  );
}

export function LabelRow({ labels, style, max = 2 }: { labels: DisplayLabel[]; style?: ViewStyle; max?: number }) {
  if (!labels?.length) return null;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, style]}>
      {labels.slice(0, max).map((l) => (
        <LabelChip key={l} label={l} />
      ))}
    </View>
  );
}

/**
 * Labels for an article/summary: the live status first (LIVE only while `live.state === 'live'`, ENDED after),
 * then editorial labels. A bare 'live' label without live state is never shown.
 */
export function StatusLabels({ a, style, max = 2 }: { a: { labels?: Label[]; live?: { state?: LiveState; status?: LiveState } | null }; style?: ViewStyle; max?: number }) {
  const labels = displayLabels(a);
  if (!labels.length) return null;
  return <LabelRow labels={labels} style={style} max={max} />;
}

/** Mandatory, visible "Demo" marker for demonstration content (isDemo). */
export function DemoBadge({ style, onDark }: { style?: ViewStyle; onDark?: boolean }) {
  const { isDark } = useTheme();
  const dark = onDark ?? isDark;
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Demo content"
      style={[{ alignSelf: 'flex-start', borderWidth: 1, borderColor: dark ? '#F2C14E' : '#8A5A00', backgroundColor: dark ? 'rgba(242,193,78,0.14)' : '#FFF6DF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }, style]}
    >
      <Txt variant="kicker" size={9.5} color={dark ? '#F2C14E' : '#8A5A00'}>
        Demo
      </Txt>
    </View>
  );
}
