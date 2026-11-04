import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../state/theme';
import { MAX_FEED_WIDTH } from './cards';
import { OfflineBanner } from './OfflineBanner';
import { Txt } from './Txt';

/** Large-title header for the tab screens (Latest, Explore, Video, Saved). */
export function TabHeader({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children?: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <View style={{ maxWidth: MAX_FEED_WIDTH, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 10, paddingBottom: children ? 8 : 12, minHeight: 56 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 7, height: 24, backgroundColor: '#E1141E', transform: [{ skewX: '-15deg' }], borderRadius: 1 }} />
              <Txt variant="display" size={28} lineHeight={34} accessibilityRole="header">
                {title}
              </Txt>
            </View>
            {subtitle ? (
              <Txt variant="ui" size={13} muted style={{ marginTop: 2 }}>
                {subtitle}
              </Txt>
            ) : null}
          </View>
          {right}
        </View>
        {children}
      </View>
      <OfflineBanner />
    </View>
  );
}
