import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { endpoints } from '../../src/api';
import { ArticleList } from '../../src/components/ArticleList';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTheme } from '../../src/state/theme';

/** Topic (tag) page: GET /tags/{slug}. */
export default function TopicScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const q = useInfiniteQuery({
    queryKey: ['topic', slug],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => endpoints.tag(String(slug), pageParam, signal),
    getNextPageParam: (l) => l.articles.nextCursor ?? undefined,
  });
  const tag = q.data?.pages[0]?.tag;
  const total = q.data?.pages[0]?.articles.total;
  const items = q.data?.pages.flatMap((p) => p.articles.items) ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title={tag?.name ?? String(slug)} subtitle={total != null ? `Topic · ${total} ${total === 1 ? 'story' : 'stories'}` : 'Topic'} />
      <ArticleList
        items={items}
        isPending={q.isPending}
        isError={q.isError}
        error={q.error}
        refetch={q.refetch}
        fetchNextPage={() => void q.fetchNextPage()}
        hasNextPage={q.hasNextPage}
        isFetchingNextPage={q.isFetchingNextPage}
        featureFirst
        emptyTitle="No stories on this topic yet"
      />
    </View>
  );
}
