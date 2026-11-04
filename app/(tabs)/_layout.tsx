import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../src/components/Icon';
import { Tap } from '../../src/components/Tap';
import { Txt } from '../../src/components/Txt';
import { haptic } from '../../src/lib/haptics';
import { useTheme } from '../../src/state/theme';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'latest', title: 'Latest', icon: 'latest' },
  { name: 'explore', title: 'Explore', icon: 'explore' },
  { name: 'video', title: 'Video', icon: 'video' },
  { name: 'saved', title: 'Saved', icon: 'saved' },
];

function TabItem({ focused, title, icon, onPress, onLongPress }: { focused: boolean; title: string; icon: IconName; onPress: () => void; onLongPress: () => void }) {
  const { c, isDark } = useTheme();
  const active = isDark ? '#FFFFFF' : '#0B2A5E';
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: withSpring(focused ? 1 : 0, { damping: 16, stiffness: 220 }) }, { skewX: '-15deg' }] }));
  const ic = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(focused ? 1.06 : 1, { damping: 14 }) }] }));
  return (
    <Tap
      onPress={onPress}
      onLongPress={onLongPress}
      pressScale={0.92}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={title}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, paddingTop: 6 }}
    >
      <Animated.View style={[{ position: 'absolute', top: 0, width: 26, height: 3, borderRadius: 2, backgroundColor: '#E1141E' }, bar]} />
      <Animated.View style={ic}>
        <Icon name={icon} size={23} color={focused ? active : c.textMuted} strokeWidth={focused ? 2.3 : 1.8} filled={focused && (icon === 'saved' || icon === 'home')} />
      </Animated.View>
      <Txt variant={focused ? 'uiBold' : 'ui'} size={11} color={focused ? active : c.textMuted} style={{ marginTop: 3 }} maxFontSizeMultiplier={1.3}>
        {title}
      </Txt>
    </Tap>
  );
}

function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 6) }}>
      {state.routes.map((route, index) => {
        const meta = TABS.find((t) => t.name === route.name);
        if (!meta) return null;
        const focused = state.index === index;
        return (
          <TabItem
            key={route.key}
            focused={focused}
            title={meta.title}
            icon={meta.icon}
            onPress={() => {
              const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) {
                haptic.tap();
                navigateToTab(route.key);
              }
            }}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
          />
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />
      ))}
    </Tabs>
  );
}
