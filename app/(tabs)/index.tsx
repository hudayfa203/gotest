import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import Animated, { FadeIn, clamp, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '../../src/api';
import { AdCard } from '../../src/components/AdCard';
import { BreakingBanner, activeAlerts } from '../../src/components/BreakingBanner';
import { MAX_FEED_WIDTH } from '../../src/components/cards';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { LiveUpdatesEntry } from '../../src/components/live/LiveUpdatesEntry';
import { IconButton } from '../../src/components/ScreenHeader';
import { FeedSkeleton } from '../../src/components/Skeleton';
import { ErrorState } from '../../src/components/StateViews';
import { Txt } from '../../src/components/Txt';
import { ViewportProvider, useViewportNotify } from '../../src/components/Viewport';
import { APP_FEED_PLACEMENT, HomeSection } from '../../src/features/home/HomeSection';
import { useAppConfig } from '../../src/features/UpdateGate';
import { useNow } from '../../src/features/useNow';
import { formatTime } from '../../src/lib/format';
import { haptic } from '../../src/lib/haptics';
import { liveEntryItems } from '../../src/lib/live';
import { useTheme } from '../../src/state/theme';
import type { HomepageSection } from '../../src/types';

const HEADER_H = 56;

type Row = { key: string; kind: 'section'; s: HomepageSection } | { key: string; kind: 'ad' };

export default function HomeScreen() {
  return (
    <ViewportProvider>
      <Home />
    </ViewportProvider>
  );
}

function Home() {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const notify = useViewportNotify();
  const config = useAppConfig();
  const home = useQuery({ queryKey: ['home'], queryFn: ({ signal }) => endpoints.home(signal), refetchInterval: 3 * 60_000 });
  const [refreshing, setRefreshing] = useState(false);
  const now = useNow(60_000);

  const rows = useMemo<Row[]>(() => {
    const sections = (home.data?.sections ?? []).filter((s) => s.items.length > 0 || s.layout === 'newsletter' || s.layout === 'ad');
    const out: Row[] = sections.map((s) => (s.layout === 'ad' ? { key: `ad-${s.key}`, kind: 'ad' } : { key: s.key, kind: 'section', s }));
    const adsOn = config.data?.adsEnabled !== false;
    if (adsOn && !sections.some((s) => s.layout === 'ad') && out.length > 3) out.splice(4, 0, { key: 'ad-app_feed_3', kind: 'ad' });
    if (!adsOn) return out.filter((r) => r.kind !== 'ad');
    return out;
  }, [home.data, config.data?.adsEnabled]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptic.light();
    await Promise.all([home.refetch(), qc.invalidateQueries({ queryKey: ['ad'] })]);
    setRefreshing(false);
  }, [home, qc]);

  // header hides while scrolling down and returns on the slightest scroll up
  const prevY = useSharedValue(0);
  const hide = useSharedValue(0);
  const scrolled = useSharedValue(0);
  const headerTotal = insets.top + HEADER_H;
  const onScroll = useAnimatedScrollHandler((e) => {
    const y = e.contentOffset.y;
    const dy = y - prevY.value;
    prevY.value = y;
    scrolled.value = y > 4 ? 1 : 0;
    hide.value = y <= 0 ? 0 : clamp(hide.value + dy, 0, HEADER_H);
  });
  const headerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -hide.value }] }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: 1 - hide.value / HEADER_H }));
  const borderStyle = useAnimatedStyle(() => ({ opacity: scrolled.value }));

  const header = (
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: c.bg, paddingTop: insets.top }, headerStyle]}>
      <Animated.View style={[{ height: HEADER_H, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 6, maxWidth: MAX_FEED_WIDTH, width: '100%', alignSelf: 'center' }, logoStyle]}>
        <Image
          source={isDark ? require('../../assets/images/logo-oneline-reversed.png') : require('../../assets/images/logo-oneline.png')}
          style={{ width: 188, height: 29 }}
          contentFit="contain"
          accessibilityRole="header"
          accessibilityLabel="GO World News"
        />
        <View style={{ flex: 1 }} />
        <IconButton icon="search" label="Search" onPress={() => router.navigate('/explore' as Href)} />
        <IconButton icon="settings" label="Settings" onPress={() => router.push('/settings' as Href)} />
      </Animated.View>
      <Animated.View style={[{ height: 1, backgroundColor: c.border }, borderStyle]} />
      <OfflineBanner />
    </Animated.View>
  );

  if (home.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {header}
        <View style={{ paddingTop: headerTotal, maxWidth: MAX_FEED_WIDTH, width: '100%', alignSelf: 'center' }}>
          <FeedSkeleton />
        </View>
      </View>
    );
  }

  if (home.isError && !home.data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {header}
        <ErrorState error={home.error} onRetry={() => void home.refetch()} style={{ marginTop: headerTotal + 40 }} />
      </View>
    );
  }

  // Breaking alerts and live coverage are separate features: the red banner shows alerts only, the LIVE UPDATES
  // entry shows ongoing coverage only (and nothing when the home data is too old to vouch for it).
  const breaking = activeAlerts(home.data?.breaking, now);
  const liveItems = liveEntryItems(home.data?.liveNow, home.dataUpdatedAt, now);
  const topAlerts =
    breaking.length || liveItems.length ? (
      <View>
        {breaking.length ? <BreakingBanner alerts={breaking} attachedBelow={liveItems.length > 0} /> : null}
        <LiveUpdatesEntry items={liveItems} attached={breaking.length > 0} />
      </View>
    ) : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {header}
      <Animated.FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={notify}
        onScrollEndDrag={notify}
        contentContainerStyle={{ paddingTop: headerTotal, paddingBottom: 32, maxWidth: MAX_FEED_WIDTH, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={headerTotal} tintColor={c.textMuted} colors={['#E1141E']} />}
        ListHeaderComponent={topAlerts}
        ItemSeparatorComponent={() => <View style={{ height: 28 }} />}
        renderItem={({ item, index }) => (
          <Animated.View entering={index < 4 ? FadeIn.duration(320).delay(index * 60) : undefined}>
            {item.kind === 'ad' ? (
              <View style={{ paddingHorizontal: 16 }}>
                <AdCard placement={APP_FEED_PLACEMENT} />
              </View>
            ) : (
              <HomeSection s={item.s} />
            )}
          </Animated.View>
        )}
        ListFooterComponent={
          home.data ? (
            <Txt variant="ui" size={12} muted align="center" style={{ marginTop: 28 }}>
              Updated {formatTime(home.data.generatedAt)} · Pull down to refresh
            </Txt>
          ) : undefined
        }
        initialNumToRender={4}
        windowSize={7}
      />
    </View>
  );
}
