import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../state/theme';
import { Icon } from './Icon';
import { Tap } from './Tap';
import { Txt } from './Txt';

export function BackButton({ color, onPress, bg }: { color?: string; onPress?: () => void; bg?: string }) {
  const { c } = useTheme();
  return (
    <Tap
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      accessibilityLabel="Back"
      hitSlop={8}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: bg }}
    >
      <Icon name="back" size={24} color={color ?? c.heading} />
    </Tap>
  );
}

export function IconButton({ icon, label, onPress, color, active, bg, size = 22 }: { icon: Parameters<typeof Icon>[0]['name']; label: string; onPress: () => void; color?: string; active?: boolean; bg?: string; size?: number }) {
  const { c } = useTheme();
  return (
    <Tap onPress={onPress} haptics accessibilityLabel={label} accessibilityState={{ selected: !!active }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: bg }}>
      <Icon name={icon} size={size} color={color ?? c.heading} filled={active} />
    </Tap>
  );
}

/** Header for pushed stack screens (section, author, topic, settings…). */
export function ScreenHeader({ title, subtitle, right, back = true }: { title: string; subtitle?: string; right?: ReactNode; back?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }}>
        {back ? <BackButton /> : <View style={{ width: 12 }} />}
        <View style={{ flex: 1, paddingHorizontal: 6 }}>
          <Txt variant="headline" size={18} numberOfLines={1} accessibilityRole="header">
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="ui" size={12} muted numberOfLines={1}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 44 }}>{right}</View>
      </View>
    </View>
  );
}
