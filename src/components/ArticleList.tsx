import { useCallback, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { haptic } from '../lib/haptics';
import { useTheme } from '../state/theme';
import type { ArticleSummary } from '../types';
import { AdCard } from './AdCard';
import { MAX_FEED_WIDTH, StoryCard, StoryRow } from './cards';
import { FeedSkeleton } from './Skeleton';
import { EmptyState, ErrorState } from './StateViews';
import { Txt } from './Txt';

/** Paginated story list used by Latest, sections, authors, topics and search results. */
export function ArticleList({
  items, isPending, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, header, emptyTitle = 'No stories yet', emptyBody, featureFirst = false, contentTopInset = 0, ads = true,
}: {
  items: ArticleSummary[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  header?: ReactElement | null;
  emptyTitle?: string;
  emptyBody?: string;
  featureFirst?: boolean;
  contentTopInset?: number;
  /** app_list_inline ad after the 5th and 15th story */
  ads?: boolean;
}) {
  const { c } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptic.light();
    await refetch().catch(() => {});
    setRefreshing(false);
  }, [refetch]);

  if (isPending) return <View style={{ paddingTop: contentTopInset }}>{header}<FeedSkeleton hero={featureFirst} /></View>;
  if (isError && !items.length) return <View style={{ paddingTop: contentTopInset }}>{header}<ErrorState error={error} onRetry={() => void refetch()} /></View>;

  return (
    <FlatList
      data={items}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={header ?? undefined}
      contentContainerStyle={{ paddingTop: contentTopInset, paddingBottom: 32, maxWidth: MAX_FEED_WIDTH, width: '100%', alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textMuted} colors={['#E1141E']} />}
      onEndReachedThreshold={0.6}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage?.();
      }}
      renderItem={({ item, index }) =>
        featureFirst && index === 0 ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>
            <StoryCard a={item} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            <StoryRow a={item} divider={index < items.length - 1} />
            {ads && (index === 4 || index === 14) && index < items.length - 1 ? (
              <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <AdCard placement="app_list_inline" />
              </View>
            ) : null}
          </View>
        )
      }
      ListEmptyComponent={<EmptyState icon="info" title={emptyTitle} body={emptyBody} />}
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator style={{ marginVertical: 20 }} color={c.textMuted} accessibilityLabel="Loading more stories" />
        ) : items.length > 0 && !hasNextPage ? (
          <Txt variant="ui" size={12} muted align="center" style={{ marginTop: 20 }}>
            You’re all caught up
          </Txt>
        ) : undefined
      }
    />
  );
}
