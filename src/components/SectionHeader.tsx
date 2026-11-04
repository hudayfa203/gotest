import { View } from 'react-native';
import { useTheme } from '../state/theme';
import { Icon } from './Icon';
import { Tap } from './Tap';
import { Txt } from './Txt';

/** Section title with the brand's slanted red marker; optional "More" link. */
export function SectionHeader({ title, onMore, moreLabel = 'More', dark }: { title: string; onMore?: () => void; moreLabel?: string; dark?: boolean }) {
  const { c } = useTheme();
  const fg = dark ? '#FFFFFF' : c.heading;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12, minHeight: 44 }}>
      <View style={{ width: 6, height: 20, backgroundColor: '#E1141E', transform: [{ skewX: '-15deg' }], marginRight: 10, borderRadius: 1 }} />
      <Txt variant="headline" size={19} color={fg} style={{ flex: 1 }} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Txt>
      {onMore ? (
        <Tap onPress={onMore} accessibilityRole="link" accessibilityLabel={`${moreLabel}: ${title}`} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingLeft: 12 }}>
          <Txt variant="uiBold" size={13} color={dark ? '#8CC8FF' : c.link}>
            {moreLabel}
          </Txt>
          <Icon name="chevron-right" size={16} color={dark ? '#8CC8FF' : c.link} />
        </Tap>
      ) : null}
    </View>
  );
}
