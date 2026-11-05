import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../state/theme';
import { fonts } from '../theme';
import { openMenu, SectionNav } from './AppHeader';
import { MAX_FEED_WIDTH } from './cards';
import { OfflineBanner } from './OfflineBanner';
import { BackButton, IconButton } from './ScreenHeader';
import { RedBlock } from './SectionHeader';
import { Txt } from './Txt';

/**
 * Header for the tab screens (Latest, Live, Video, Saved) and Search: menu (or back), the website's heavy italic
 * title with the slanted red block, search; optionally the section bar underneath.
 */
export function TabHeader({ title, subtitle, right, children, back, nav }: { title: string; subtitle?: string; right?: ReactNode; children?: ReactNode; back?: boolean; nav?: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <View style={{ maxWidth: MAX_FEED_WIDTH, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, minHeight: 56 }}>
          {back ? <BackButton /> : <IconButton icon="menu" label="Menu" onPress={openMenu} size={24} />}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 6 }}>
            <RedBlock w={20} h={12} />
            <Txt variant="display" size={25} lineHeight={30} style={{ fontFamily: fonts.display900Italic, flexShrink: 1 }} numberOfLines={1} accessibilityRole="header">
              {title}
            </Txt>
          </View>
          {right ?? (back ? null : <IconButton icon="search" label="Search" onPress={() => router.push('/explore' as Href)} />)}
        </View>
        {subtitle ? (
          <Txt variant="ui" size={13} muted style={{ paddingHorizontal: 16, marginTop: -6, paddingBottom: nav || children ? 4 : 10 }}>
            {subtitle}
          </Txt>
        ) : null}
        {nav ? <SectionNav active={nav} /> : null}
        {children}
      </View>
      <OfflineBanner />
    </View>
  );
}
