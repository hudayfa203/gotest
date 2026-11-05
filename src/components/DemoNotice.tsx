import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { useServer } from '../state/server';
import { useTheme } from '../state/theme';
import { Icon } from './Icon';
import { Tap } from './Tap';
import { Txt } from './Txt';

/**
 * Test builds showing the built-in demo stories: a visible notice at the top of Home that the content is fictional
 * sample content (each item also carries its own "Demo" badge). Tapping opens Settings → Content source.
 */
export function DemoNotice() {
  const demo = useServer((s) => s.demo);
  const { isDark } = useTheme();
  if (!demo) return null;
  const fg = isDark ? '#F2C14E' : '#6B4600';
  return (
    <Tap
      onPress={() => router.push('/settings' as Href)}
      pressScale={0.99}
      accessibilityRole="button"
      accessibilityLabel="Demo content. These are fictional sample stories built into this test app, not real news. Opens settings."
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginHorizontal: 16,
          marginTop: 12,
          marginBottom: 2,
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(242,193,78,0.55)' : '#E2C27A',
          backgroundColor: isDark ? 'rgba(242,193,78,0.10)' : '#FFF6DF',
        }}
      >
        <Txt variant="kicker" size={10.5} color={fg}>
          Demo
        </Txt>
        <Txt variant="ui" size={12.5} lineHeight={17} color={fg} style={{ flex: 1 }}>
          Demo stories built into this test app — not real news.
        </Txt>
        <Icon name="chevron-right" size={16} color={fg} />
      </View>
    </Tap>
  );
}
