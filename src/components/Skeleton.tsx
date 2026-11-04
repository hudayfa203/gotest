import { useEffect } from 'react';
import { View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation, Easing } from 'react-native-reanimated';
import { useTheme } from '../state/theme';

export function SkeletonBox({ w = '100%', h = 14, r = 6, style }: { w?: DimensionValue; h?: number; r?: number; style?: ViewStyle }) {
  const { c, isDark } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(t);
  }, [t]);
  const a = useAnimatedStyle(() => ({ opacity: 0.55 + t.value * 0.45 }));
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: isDark ? c.surfaceRaised : '#E7EBF2' }, a, style]} />;
}

/** Placeholder shaped like the feed while the first load is in flight. */
export function FeedSkeleton({ hero = true, rows = 5 }: { hero?: boolean; rows?: number }) {
  return (
    <View accessibilityLabel="Loading stories" accessibilityRole="progressbar" style={{ padding: 16, gap: 18 }}>
      {hero ? (
        <View style={{ gap: 10 }}>
          <SkeletonBox h={220} r={14} />
          <SkeletonBox w="40%" h={12} />
          <SkeletonBox h={22} />
          <SkeletonBox w="80%" h={22} />
        </View>
      ) : null}
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBox w="30%" h={10} />
            <SkeletonBox h={16} />
            <SkeletonBox w="70%" h={16} />
          </View>
          <SkeletonBox w={96} h={72} r={10} />
        </View>
      ))}
    </View>
  );
}

export function ArticleSkeleton() {
  return (
    <View accessibilityLabel="Loading article" accessibilityRole="progressbar" style={{ gap: 14 }}>
      <SkeletonBox h={240} r={0} />
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <SkeletonBox w="25%" h={12} />
        <SkeletonBox h={28} />
        <SkeletonBox w="85%" h={28} />
        <SkeletonBox w="60%" h={14} style={{ marginTop: 6 }} />
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonBox key={i} w={i % 3 === 2 ? '75%' : '100%'} h={15} />
        ))}
      </View>
    </View>
  );
}
