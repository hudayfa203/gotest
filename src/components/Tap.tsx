import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { haptic } from '../lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface TapProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** scale-down amount while pressed (0 disables) */
  pressScale?: number;
  haptics?: boolean;
}

/** Pressable with a subtle spring "press-in" scale, optional haptic, and ≥44pt hit area via hitSlop. */
export function Tap({ style, pressScale = 0.975, haptics = false, onPressIn, onPressOut, onPress, hitSlop, accessibilityRole, ...rest }: TapProps) {
  const s = useSharedValue(1);
  const o = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: o.value }));
  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole ?? 'button'}
      hitSlop={hitSlop ?? 6}
      onPressIn={(e) => {
        if (pressScale) s.value = withSpring(pressScale, { damping: 20, stiffness: 400 });
        o.value = withTiming(0.85, { duration: 90 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, { damping: 14, stiffness: 300 });
        o.value = withTiming(1, { duration: 160 });
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptics) haptic.tap();
        onPress?.(e);
      }}
      style={[style, anim]}
      {...rest}
    />
  );
}
