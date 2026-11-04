import { useInfiniteQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { endpoints } from '../../src/api';
import { ArticleList } from '../../src/components/ArticleList';
import { TabHeader } from '../../src/components/TabHeader';
import { useTheme } from '../../src/state/theme';

/** Reverse-chronological feed — keyset pagination with nextCursor. */
export default function LatestScreen() {
  const { c } = useTheme();
  const q = useInfiniteQuery({
    queryKey: ['latest'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => endpoints.articles({ cursor: pageParam, pageSize: 20 }, signal),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 2 * 60_000,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TabHeader title="Latest" subtitle="Every story, newest first" />
      <ArticleList
        items={items}
        isPending={q.isPending}
        isError={q.isError}
        error={q.error}
        refetch={q.refetch}
        fetchNextPage={() => void q.fetchNextPage()}
        hasNextPage={q.hasNextPage}
        isFetchingNextPage={q.isFetchingNextPage}
        emptyTitle="No stories published yet"
      />
    </View>
  );
}
