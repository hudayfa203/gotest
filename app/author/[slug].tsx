import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { endpoints } from '../../src/api';
import { ArticleList } from '../../src/components/ArticleList';
import { Avatar } from '../../src/components/cards';
import { DemoBadge } from '../../src/components/Labels';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Txt } from '../../src/components/Txt';
import { openExternal } from '../../src/lib/navigation';
import { useTheme } from '../../src/state/theme';
import { Tap } from '../../src/components/Tap';

/** Author page: GET /authors/{slug} — profile + their articles (cursor pagination). */
export default function AuthorScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const q = useInfiniteQuery({
    queryKey: ['author', slug],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => endpoints.author(String(slug), pageParam, signal),
    getNextPageParam: (l) => l.articles.nextCursor ?? undefined,
  });
  const author = q.data?.pages[0]?.author;
  const items = q.data?.pages.flatMap((p) => p.articles.items) ?? [];
  const header = author ? (
    <View style={{ padding: 20, gap: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={author.name} url={author.avatarUrl} size={68} />
        <View style={{ flex: 1, gap: 4 }}>
          <Txt variant="display" size={22} lineHeight={27} accessibilityRole="header">
            {author.name}
          </Txt>
          {author.role ? (
            <Txt variant="ui" size={13.5} muted>
              {author.role}
            </Txt>
          ) : null}
          {author.isDemo ? <DemoBadge /> : null}
        </View>
      </View>
      {author.bio ? (
        <Txt variant="serif" size={16} lineHeight={24}>
          {author.bio}
        </Txt>
      ) : null}
      {Object.entries(author.links ?? {}).length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(author.links).map(([k, url]) => (
            <Tap key={k} onPress={() => void openExternal(url)} accessibilityRole="link" style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: c.border, justifyContent: 'center' }}>
              <Txt variant="uiStrong" size={13} color={c.link}>
                {k}
              </Txt>
            </Tap>
          ))}
        </View>
      ) : null}
      <Txt variant="kicker" size={11} muted style={{ marginTop: 6 }}>
        Latest from {author.name.split(' ')[0]}
      </Txt>
    </View>
  ) : null;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title={author?.name ?? 'Author'} subtitle="Author" />
      <ArticleList
        items={items}
        isPending={q.isPending}
        isError={q.isError}
        error={q.error}
        refetch={q.refetch}
        fetchNextPage={() => void q.fetchNextPage()}
        hasNextPage={q.hasNextPage}
        isFetchingNextPage={q.isFetchingNextPage}
        header={header}
        emptyTitle="No published stories yet"
      />
    </View>
  );
}
