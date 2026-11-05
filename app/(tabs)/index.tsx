import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import Animated, { clamp, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '../../src/api';
import { AdCard } from '../../src/components/AdCard';
import { MASTHEAD_H, Masthead, SECTION_NAV_H, SectionNav } from '../../src/components/AppHeader';
import { activeAlerts } from '../../src/components/BreakingBanner';
import { DemoNotice } from '../../src/components/DemoNotice';
import { MAX_FEED_WIDTH } from '../../src/components/cards';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { RedBar } from '../../src/components/RedBar';
import { FeedSkeleton } from '../../src/components/Skeleton';
import { ErrorState } from '../../src/components/StateViews';
import { Tap } from '../../src/components/Tap';
import { Txt } from '../../src/components/Txt';
import { ViewportProvider, useViewportNotify } from '../../src/components/Viewport';
import { HomeSection } from '../../src/features/home/HomeSection';
import { buildHomeRows, type Row } from '../../src/features/home/rows';
import { WorldPulse } from '../../src/features/pulse/WorldPulse';
import { useAppConfig } from '../../src/features/UpdateGate';
import { useNow } from '../../src/features/useNow';
import { formatTime } from '../../src/lib/format';
import { haptic } from '../../src/lib/haptics';
import { liveEntryItems } from '../../src/lib/live';
import { useTheme } from '../../src/state/theme';

const HEADER_H = MASTHEAD_H + SECTION_NAV_H;

/**
 * Home = GET /home, as arranged in the dashboard's Homepage manager, with the website's chrome: masthead, section
 * bar, the red BREAKING / LIVE UPDATES bar. Ad slots (dashboard → Ads): app_home_top under the lead, app_feed_3 and
 * app_feed_6 further down (or wherever editors place an "ad" section). World Pulse follows the Latest timeline.
 */
export default function HomeScreen() {
  return (
    <ViewportProvider>
      <Home />
    </ViewportProvider>
  );
}

function Home() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const notify = useViewportNotify();
  const config = useAppConfig();
  const home = useQuery({ queryKey: ['home'], queryFn: ({ signal }) => endpoints.home(signal), refetchInterval: 3 * 60_000 });
  const [refreshing, setRefreshing] = useState(false);
  const now = useNow(60_000);

  const rows = useMemo<Row[]>(() => buildHomeRows(home.data?.sections ?? [], config.data?.adsEnabled !== false), [home.data, config.data?.adsEnabled]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptic.light();
    await Promise.all([home.refetch(), qc.invalidateQueries({ queryKey: ['ad'] }), qc.invalidateQueries({ queryKey: ['pulse'] })]);
    setRefreshing(false);
  }, [home, qc]);

  // the masthead + section bar slide away while scrolling down and return on the slightest scroll up
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
  const fade = useAnimatedStyle(() => ({ opacity: 1 - hide.value / HEADER_H }));
  const borderStyle = useAnimatedStyle(() => ({ opacity: scrolled.value }));

  const header = (
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: c.bg, paddingTop: insets.top }, headerStyle]}>
      <Animated.View style={[{ maxWidth: MAX_FEED_WIDTH, width: '100%', alignSelf: 'center' }, fade]}>
        <Masthead />
        <SectionNav active="/" />
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

  // Breaking alerts and live coverage are separate features sharing the red bar (alerts row / LIVE UPDATES row).
  const breaking = activeAlerts(home.data?.breaking, now);
  const liveItems = liveEntryItems(home.data?.liveNow, home.dataUpdatedAt, now);
  const top = (
    <View>
      <RedBar alerts={breaking} live={liveItems} />
      <DemoNotice />
      <View style={{ height: 12 }} />
    </View>
  );
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
        ListHeaderComponent={top}
        ItemSeparatorComponent={() => <View style={{ height: 30 }} />}
        renderItem={({ item }) =>
          item.kind === 'ad' ? (
            <View style={{ paddingHorizontal: 16 }}>
              <AdCard placement={item.placement} />
            </View>
          ) : item.kind === 'pulse' ? (
            <WorldPulse />
          ) : (
            <HomeSection s={item.s} />
          )
        }
        ListFooterComponent={home.data ? <HomeFooter updatedAt={home.data.generatedAt} tagline={config.data?.tagline} /> : undefined}
        initialNumToRender={4}
        windowSize={7}
      />
    </View>
  );
}

/** Bottom of Home: when the feed was updated, and the publisher's pages (like the website footer). */
function HomeFooter({ updatedAt, tagline }: { updatedAt: string; tagline?: string }) {
  const { c } = useTheme();
  const links: [string, string][] = [
    ['About us', '/settings/page/about'],
    ['Editorial standards', '/settings/page/editorialStandards'],
    ['Privacy', '/settings/page/privacy'],
    ['Terms', '/settings/page/terms'],
  ];
  return (
    <View style={{ marginTop: 34, paddingTop: 22, paddingHorizontal: 16, borderTopWidth: 3, borderTopColor: '#E1141E', backgroundColor: c.surface, paddingBottom: 26, gap: 12 }}>
      <Txt variant="display" size={18} color={c.heading} style={{ fontFamily: 'Montserrat-900-Italic' }}>
        {tagline ?? 'Breaking News. Beyond Borders.'}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {links.map(([label, href]) => (
          <Tap key={href} onPress={() => router.push(href as Href)} accessibilityRole="link" style={{ paddingVertical: 6, paddingRight: 14 }}>
            <Txt variant="uiStrong" size={13.5} color={c.link}>
              {label}
            </Txt>
          </Tap>
        ))}
      </View>
      <Txt variant="ui" size={12} muted>
        Updated {formatTime(updatedAt)}. Pull down to refresh.
      </Txt>
      <Txt variant="ui" size={12} muted>
        © {new Date().getFullYear()} GO World News
      </Txt>
    </View>
  );
}
