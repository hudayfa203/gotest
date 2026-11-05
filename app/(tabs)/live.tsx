import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { endpoints } from '../../src/api';
import { isNetworkError } from '../../src/api/client';
import { MAX_FEED_WIDTH } from '../../src/components/cards';
import { Icon, type IconName } from '../../src/components/Icon';
import { LiveCoverageRow, LiveLeadCard } from '../../src/components/live/LiveCards';
import { LivePulse } from '../../src/components/LivePulse';
import { useIsOffline } from '../../src/components/OfflineBanner';
import { TabHeader } from '../../src/components/TabHeader';
import { SkeletonBox } from '../../src/components/Skeleton';
import { EmptyState, ErrorState } from '../../src/components/StateViews';
import { Txt } from '../../src/components/Txt';
import { LIVE_ARCHIVE_KEY, LIVE_HUB_KEY } from '../../src/features/live';
import { useNow } from '../../src/features/useNow';
import { formatTime } from '../../src/lib/format';
import { haptic } from '../../src/lib/haptics';
import { archiveItems } from '../../src/lib/live';
import { useTheme } from '../../src/state/theme';
import type { LiveCoverage } from '../../src/types';

type Row =
  | { key: string; kind: 'note'; text: string }
  | { key: string; kind: 'header'; title: string; subtitle?: string; live?: boolean; icon?: IconName }
  | { key: string; kind: 'lead'; c: LiveCoverage }
  | { key: string; kind: 'row'; c: LiveCoverage; divider: boolean }
  | { key: string; kind: 'nothing-live' };

/**
 * Live hub: ongoing coverage (GET /live `active`), recently ended (`recent`) and the archive of all completed coverage
 * (GET /live/archive, infinite scroll). Live coverage only — breaking alerts never appear here.
 */
export default function LiveHubScreen() {
  const { c } = useTheme();
  const focused = useIsFocused();
  const now = useNow(30_000, focused);
  const offline = useIsOffline();
  const hub = useQuery({ queryKey: LIVE_HUB_KEY, queryFn: ({ signal }) => endpoints.liveHub(signal), staleTime: 15_000, refetchInterval: focused ? 60_000 : false });
  const archive = useInfiniteQuery({
    queryKey: LIVE_ARCHIVE_KEY,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => endpoints.liveArchive(pageParam, signal),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptic.light();
    await Promise.all([hub.refetch(), archive.refetch()]).catch(() => {});
    setRefreshing(false);
  }, [hub, archive]);

  const rows = useMemo<Row[]>(() => {
    const d = hub.data;
    if (!d) return [];
    const out: Row[] = [];
    const stale = hub.dataUpdatedAt && now - hub.dataUpdatedAt > 5 * 60_000;
    if ((offline || hub.isError) && stale) {
      out.push({ key: 'note', kind: 'note', text: `${offline ? 'You’re offline.' : 'Garowe World couldn’t be reached.'} Showing live coverage as of ${formatTime(new Date(hub.dataUpdatedAt).toISOString())} — statuses may have changed since.` });
    }
    const active = d.active.filter((x) => x.state === 'live');
    out.push({ key: 'h-live', kind: 'header', title: 'Live now', live: active.length > 0, subtitle: active.length ? 'Refreshes automatically' : undefined });
    if (active.length) {
      out.push({ key: `lead-${active[0].id}`, kind: 'lead', c: active[0] });
      active.slice(1).forEach((x, i, arr) => out.push({ key: `a-${x.id}`, kind: 'row', c: x, divider: i < arr.length - 1 }));
    } else {
      out.push({ key: 'nothing-live', kind: 'nothing-live' });
    }
    const recent = d.recent.filter((x) => x.state === 'ended');
    if (recent.length) {
      out.push({ key: 'h-recent', kind: 'header', title: 'Recently ended', icon: 'clock' });
      recent.forEach((x, i) => out.push({ key: `r-${x.id}`, kind: 'row', c: x, divider: i < recent.length - 1 }));
    }
    const shown = [...active, ...recent].map((x) => x.id);
    const arch = archiveItems(archive.data?.pages, shown);
    if (arch.length) {
      out.push({ key: 'h-archive', kind: 'header', title: 'Archive', subtitle: 'Completed live coverage', icon: 'archive' });
      arch.forEach((x, i) => out.push({ key: `x-${x.id}`, kind: 'row', c: x, divider: i < arch.length - 1 }));
    }
    return out;
  }, [hub.data, hub.dataUpdatedAt, hub.isError, archive.data, offline, now]);

  const everythingEmpty = !!hub.data && !hub.data.active.length && !hub.data.recent.length && !archiveItems(archive.data?.pages).length && !archive.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TabHeader title="Live updates" nav="/live" />
      {hub.isPending ? (
        <LiveHubSkeleton />
      ) : hub.isError && !hub.data ? (
        <ErrorState error={hub.error} onRetry={() => void hub.refetch()} title={isNetworkError(hub.error) ? (offline ? 'You’re offline' : 'Couldn’t reach Garowe World') : 'Couldn’t load live coverage'} />
      ) : everythingEmpty ? (
        <EmptyState
          icon="broadcast"
          title="No live coverage yet"
          body="When Garowe World covers a story as it happens, it appears here — and stays in the archive after it ends."
          action={{ title: 'Refresh', onPress: () => void onRefresh() }}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={{ paddingBottom: 40, maxWidth: MAX_FEED_WIDTH, width: '100%', alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textMuted} colors={['#E1141E']} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (archive.hasNextPage && !archive.isFetchingNextPage) void archive.fetchNextPage();
          }}
          renderItem={({ item }) => <HubRow row={item} now={now} />}
          ListFooterComponent={
            archive.isFetchingNextPage || (archive.isPending && hub.data) ? (
              <ActivityIndicator style={{ marginVertical: 22 }} color={c.textMuted} accessibilityLabel="Loading more live coverage" />
            ) : archive.isError && !archive.data ? (
              <Txt variant="ui" size={13} muted align="center" style={{ marginTop: 22, paddingHorizontal: 24 }}>
                The archive couldn’t be loaded. Pull down to try again.
              </Txt>
            ) : archive.data && !archive.hasNextPage && rows.some((r) => r.key === 'h-archive') ? (
              <Txt variant="ui" size={12} muted align="center" style={{ marginTop: 24 }}>
                That’s the whole live archive
              </Txt>
            ) : undefined
          }
          initialNumToRender={8}
        />
      )}
    </View>
  );
}

function HubRow({ row, now }: { row: Row; now: number }) {
  const { c, isDark } = useTheme();
  switch (row.kind) {
    case 'note':
      return (
        <View accessibilityRole="text" style={{ margin: 16, marginBottom: 0, flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: c.surface, borderRadius: 10, padding: 10 }}>
          <Icon name="offline" size={16} color={c.textMuted} />
          <Txt variant="ui" size={12.5} muted style={{ flex: 1 }}>
            {row.text}
          </Txt>
        </View>
      );
    case 'header':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 10 }}>
          {row.live ? (
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: isDark ? 'rgba(255,90,95,0.16)' : '#FDECEC', alignItems: 'center', justifyContent: 'center' }}>
              <LivePulse color={c.live} size={9} />
            </View>
          ) : row.icon ? (
            <Icon name={row.icon} size={19} color={c.heading} />
          ) : (
            <View style={{ width: 6, height: 20, backgroundColor: '#E1141E', transform: [{ skewX: '-15deg' }], borderRadius: 1 }} />
          )}
          <Txt variant="headline" size={19} style={{ flex: 1 }} accessibilityRole="header" numberOfLines={1}>
            {row.title}
          </Txt>
          {row.subtitle ? (
            <Txt variant="ui" size={12} muted numberOfLines={1}>
              {row.subtitle}
            </Txt>
          ) : null}
        </View>
      );
    case 'lead':
      return (
        <Animated.View entering={FadeIn.duration(300)} style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
          <LiveLeadCard c={row.c} now={now} />
        </Animated.View>
      );
    case 'row':
      return (
        <View style={{ paddingHorizontal: 16 }}>
          <LiveCoverageRow c={row.c} now={now} divider={row.divider} />
        </View>
      );
    case 'nothing-live':
      return (
        <View accessibilityRole="text" style={{ marginHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', padding: 18, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="broadcast" size={20} color={c.textMuted} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Txt variant="title" size={15.5}>
              Nothing is live right now
            </Txt>
            <Txt variant="ui" size={13} lineHeight={18} muted>
              When we cover a story as it happens, it appears here with updates as they come in.
            </Txt>
          </View>
        </View>
      );
  }
}

function LiveHubSkeleton() {
  return (
    <View accessibilityLabel="Loading live coverage" accessibilityRole="progressbar" style={{ padding: 16, gap: 14, maxWidth: MAX_FEED_WIDTH, width: '100%', alignSelf: 'center' }}>
      <SkeletonBox w="35%" h={18} style={{ marginTop: 8 }} />
      <SkeletonBox h={200} r={14} />
      <SkeletonBox w="30%" h={11} />
      <SkeletonBox h={22} />
      <SkeletonBox w="75%" h={22} />
      <SkeletonBox h={92} r={12} />
      <SkeletonBox w="40%" h={18} style={{ marginTop: 18 }} />
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBox w="35%" h={11} />
            <SkeletonBox h={16} />
            <SkeletonBox w="60%" h={12} />
          </View>
          <SkeletonBox w={104} h={78} r={10} />
        </View>
      ))}
    </View>
  );
}
