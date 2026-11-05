import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { endpoints } from '../../src/api';
import { ArticleList } from '../../src/components/ArticleList';
import { TabHeader } from '../../src/components/TabHeader';
import { useTheme } from '../../src/state/theme';

function titleCase(slug: string) {
  return slug.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

/** Section front: GET /articles?category=slug (includes child categories), keyset pagination. */
export default function SectionScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const cats = useQuery({ queryKey: ['categories'], queryFn: ({ signal }) => endpoints.categories(signal), staleTime: 30 * 60_000 });
  const cat = cats.data?.find((x) => x.slug === slug);
  const q = useInfiniteQuery({
    queryKey: ['section', slug],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => endpoints.articles({ category: slug, cursor: pageParam, pageSize: 20 }, signal),
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TabHeader title={cat?.name ?? titleCase(String(slug))} subtitle={cat?.description} back nav={`/section/${slug}`} />
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
        emptyTitle="No stories in this section yet"
      />
    </View>
  );
}
