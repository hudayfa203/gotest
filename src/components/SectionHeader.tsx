import { View } from 'react-native';
import { useTheme } from '../state/theme';
import { fonts } from '../theme';
import { Tap } from './Tap';
import { Txt } from './Txt';

/** The website's slanted red block (section titles, menu headings). */
export function RedBlock({ w = 26, h = 14 }: { w?: number; h?: number }) {
  return <View style={{ width: w, height: h, backgroundColor: '#E1141E', transform: [{ skewX: '-20deg' }] }} />;
}

/** Section title as on goworld.news: slanted red block + heavy italic title; optional "more" link on the right. */
export function SectionHeader({ title, onMore, moreLabel = 'More', dark }: { title: string; onMore?: () => void; moreLabel?: string; dark?: boolean }) {
  const { c } = useTheme();
  const fg = dark ? '#FFFFFF' : c.heading;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14, minHeight: 44, gap: 12 }}>
      <RedBlock />
      <Txt
        variant="display"
        size={23}
        lineHeight={28}
        color={fg}
        style={{ flex: 1, fontFamily: fonts.display900Italic, letterSpacing: -0.3 }}
        accessibilityRole="header"
        numberOfLines={2}
      >
        {title}
      </Txt>
      {onMore ? (
        <Tap onPress={onMore} accessibilityRole="link" accessibilityLabel={`${moreLabel}: ${title}`} style={{ justifyContent: 'center', minHeight: 44, paddingLeft: 8 }}>
          <Txt variant="uiStrong" size={13.5} color={dark ? '#8CC8FF' : c.link}>
            {moreLabel}
          </Txt>
        </Tap>
      ) : null}
    </View>
  );
}
