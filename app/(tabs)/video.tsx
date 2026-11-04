import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { endpoints } from '../../src/api';
import { ArticleImage } from '../../src/components/ArticleImage';
import { MAX_FEED_WIDTH, PlayBadge, useFeedWidth } from '../../src/components/cards';
import { Icon } from '../../src/components/Icon';
import { DemoBadge } from '../../src/components/Labels';
import { AudioPlayer } from '../../src/components/media/AudioPlayer';
import { InlineVideo } from '../../src/components/media/InlineVideo';
import { SectionHeader } from '../../src/components/SectionHeader';
import { FeedSkeleton } from '../../src/components/Skeleton';
import { EmptyState, ErrorState } from '../../src/components/StateViews';
import { TabHeader } from '../../src/components/TabHeader';
import { Tap } from '../../src/components/Tap';
import { Txt } from '../../src/components/Txt';
import { videoSource } from '../../src/lib/blocks';
import { formatDuration, timeAgo } from '../../src/lib/format';
import { haptic } from '../../src/lib/haptics';
import { openArticle, openExternal } from '../../src/lib/navigation';
import { useTheme } from '../../src/state/theme';
import type { ArticleSummary, PodcastEpisode } from '../../src/types';

/** Video feed (GET /articles?type=video) with an inline native player, plus podcast episodes. */
export default function VideoScreen() {
  const { c } = useTheme();
  const { content } = useFeedWidth();
  const listRef = useRef<FlatList<ArticleSummary>>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const videos = useInfiniteQuery({
    queryKey: ['videos'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => endpoints.articles({ type: 'video', cursor: pageParam, pageSize: 20 }, signal),
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const podcasts = useQuery({ queryKey: ['podcasts'], queryFn: ({ signal }) => endpoints.podcasts(undefined, signal), staleTime: 10 * 60_000 });
  const items = videos.data?.pages.flatMap((p) => p.items) ?? [];
  const current = items.find((v) => v.id === selectedId) ?? items[0];
  const src = current?.video ? videoSource(current.video) : null;

  const onRefresh = async () => {
    setRefreshing(true);
    haptic.light();
    await Promise.all([videos.refetch(), podcasts.refetch()]);
    setRefreshing(false);
  };

  const player = current ? (
    <Animated.View key={current.id} entering={FadeIn.duration(250)} style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
      {src?.kind === 'file' ? (
        <InlineVideo url={src.url} poster={current.image} title={current.headline} articleId={current.id} width={content} radius={14} durationSeconds={current.video?.durationSeconds} autoPlay={!!selectedId} />
      ) : src?.kind === 'external' ? (
        <Tap onPress={() => void openExternal(src.url)} accessibilityRole="link" accessibilityLabel={`${src.label}: ${current.headline}`} style={{ borderRadius: 14, overflow: 'hidden' }}>
          <ArticleImage image={current.image} width={content} ratio={16 / 9} accessible={false} />
          <PlayBadge />
        </Tap>
      ) : (
        <ArticleImage image={current.image} width={content} ratio={16 / 9} radius={14} />
      )}
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt variant="kicker" size={11} color={c.link}>
            {current.category.name}
          </Txt>
          <Txt variant="ui" size={12} muted>
            {timeAgo(current.publishedAt)}
          </Txt>
          {current.isDemo ? <DemoBadge /> : null}
        </View>
        <Txt variant="display" size={22} lineHeight={28} accessibilityRole="header">
          {current.headline}
        </Txt>
        {current.standfirst ? (
          <Txt variant="serif" size={16} lineHeight={24} muted>
            {current.standfirst}
          </Txt>
        ) : null}
        <Tap onPress={() => openArticle(current.id)} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' }}>
          <Txt variant="uiBold" size={14} color={c.link}>
            Read the full story
          </Txt>
          <Icon name="chevron-right" size={16} color={c.link} />
        </Tap>
      </View>
    </Animated.View>
  ) : null;

  const listen = podcasts.data?.length ? (
    <View style={{ paddingTop: 28 }}>
      <SectionHeader title="Listen" />
      <View style={{ paddingHorizontal: 16, gap: 18 }}>
        {podcasts.data.slice(0, 5).map((ep) => (
          <EpisodeRow key={ep.articleId} ep={ep} />
        ))}
      </View>
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TabHeader title="Video" subtitle="Watch and listen" />
      {videos.isPending ? (
        <FeedSkeleton />
      ) : videos.isError && !items.length ? (
        <ErrorState error={videos.error} onRetry={() => void videos.refetch()} />
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingBottom: 32, maxWidth: MAX_FEED_WIDTH, width: '100%', alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.textMuted} colors={['#E1141E']} />}
          ListHeaderComponent={
            <View>
              {player}
              {items.length > 1 ? (
                <Txt variant="title" size={15} style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 4 }} accessibilityRole="header">
                  More videos
                </Txt>
              ) : null}
            </View>
          }
          renderItem={({ item }) =>
            item.id === current?.id ? null : (
              <Tap
                onPress={() => {
                  setSelectedId(item.id);
                  listRef.current?.scrollToOffset({ offset: 0, animated: true });
                }}
                haptics
                accessibilityRole="button"
                accessibilityLabel={`Play ${item.headline}${item.isDemo ? ', demo content' : ''}`}
                style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}
              >
                <View>
                  <ArticleImage image={item.image} width={136} ratio={16 / 9} radius={10} accessible={false} />
                  <PlayBadge small />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt variant="headline" size={15} lineHeight={20} numberOfLines={3}>
                    {item.headline}
                  </Txt>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Txt variant="ui" size={12} muted>
                      {item.video?.durationSeconds ? `${formatDuration(item.video.durationSeconds)} · ` : ''}
                      {timeAgo(item.publishedAt)}
                    </Txt>
                    {item.isDemo ? <DemoBadge /> : null}
                  </View>
                </View>
              </Tap>
            )
          }
          ListEmptyComponent={<EmptyState icon="video" title="No videos yet" body="Videos published by the newsroom will appear here." />}
          ListFooterComponent={
            <View>
              {videos.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color={c.textMuted} /> : null}
              {listen}
            </View>
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (videos.hasNextPage && !videos.isFetchingNextPage) void videos.fetchNextPage();
          }}
        />
      )}
    </View>
  );
}

/** Podcast episode with its player. GET /podcasts has no isDemo, so the linked article supplies the Demo label. */
function EpisodeRow({ ep }: { ep: PodcastEpisode }) {
  const { c } = useTheme();
  const art = useQuery({ queryKey: ['article', ep.articleId], queryFn: ({ signal }) => endpoints.article(ep.articleId, signal), staleTime: 10 * 60_000 });
  return (
    <View style={{ gap: 8 }}>
      <Tap onPress={() => openArticle(ep.articleId)} accessibilityRole="link" accessibilityLabel={`${ep.title}${art.data?.isDemo ? '. Demo content' : ''}. Open episode page.`} style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt variant="kicker" size={10.5} color={c.link}>
            Podcast · {timeAgo(ep.publishedAt)}
          </Txt>
          {art.data?.isDemo ? <DemoBadge /> : null}
        </View>
        <Txt variant="headline" size={16} lineHeight={21}>
          {ep.title}
        </Txt>
        {ep.description ? (
          <Txt variant="body" size={14} lineHeight={20} muted numberOfLines={2}>
            {ep.description}
          </Txt>
        ) : null}
      </Tap>
      <AudioPlayer episode={ep} compact />
    </View>
  );
}
