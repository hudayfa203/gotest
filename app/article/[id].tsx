import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Share, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation, FadeIn, FadeInDown, FadeOutUp, interpolate, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { endpoints } from '../../src/api';
import { isGone, isNetworkError, type GoneError } from '../../src/api/client';
import { ArticleImage } from '../../src/components/ArticleImage';
import {
  ArticleHeaderText, Byline, CorrectionsBox, DemoNotice, PodcastEpisodeSection, Sources, SponsorBox, Tags, TombstoneView,
} from '../../src/components/article/ArticleParts';
import { Blocks } from '../../src/components/article/Blocks';
import { RelatedStories } from '../../src/components/article/RelatedStories';
import { Icon } from '../../src/components/Icon';
import { LiveStatusBanner, LiveTimeline } from '../../src/components/live/LiveTimeline';
import { InlineVideo } from '../../src/components/media/InlineVideo';
import { BackButton, IconButton } from '../../src/components/ScreenHeader';
import { ArticleSkeleton } from '../../src/components/Skeleton';
import { useIsOffline } from '../../src/components/OfflineBanner';
import { ErrorState } from '../../src/components/StateViews';
import { Tap } from '../../src/components/Tap';
import { Txt } from '../../src/components/Txt';
import { ViewportProvider, useViewportNotify } from '../../src/components/Viewport';
import { useLiveFeed } from '../../src/features/live';
import { saveArticle, unsaveArticle } from '../../src/features/saved';
import { useNow } from '../../src/features/useNow';
import { useSavedItem } from '../../src/features/useSaved';
import { track } from '../../src/lib/analytics';
import { aspectRatio, relatedIds, videoSource } from '../../src/lib/blocks';
import { articleLiveState, coverageStatus, isLiveCoverageArticle, resolveLiveState } from '../../src/lib/live';
import { isPublicId } from '../../src/lib/deeplink';
import { formatDate, timeAgo } from '../../src/lib/format';
import { haptic } from '../../src/lib/haptics';
import { openExternal } from '../../src/lib/navigation';
import { textScale, updateSettings, useSettings } from '../../src/state/settings';
import { useTheme } from '../../src/state/theme';
import { savedStore } from '../../src/storage/savedDb';
import { articleMeasure, textScaleSteps } from '../../src/theme';
import type { Article } from '../../src/types';

const BAR_H = 52;

export default function ArticleRoute() {
  return (
    <ViewportProvider>
      <ArticleScreen />
    </ViewportProvider>
  );
}

function ArticleScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = String(rawId ?? '').toLowerCase();
  const valid = isPublicId(id);
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const notify = useViewportNotify();
  const focused = useIsFocused();
  const scaleIndex = useSettings((s) => s.textScaleIndex);
  const scale = textScale(scaleIndex);

  const saved = useSavedItem(valid ? id : undefined);
  const q = useQuery({ queryKey: ['article', id], queryFn: ({ signal }) => endpoints.article(id, signal), enabled: valid, staleTime: 60_000 });
  const gone = isGone(q.error) ? (q.error as GoneError) : null;
  const article: Article | undefined = gone ? undefined : (q.data ?? saved.item?.article);
  const fromOfflineCopy = !q.data && !!saved.item && !!article;
  const offline = useIsOffline();
  const showOfflineNote = !!article && (fromOfflineCopy || offline || (q.isError && isNetworkError(q.error)));

  // ---- live coverage: GET /live/{id}, then ?since= every 20 s while live, focused and in the foreground
  const isLiveArticle = isLiveCoverageArticle(article);
  const live = useLiveFeed(id, { enabled: valid && isLiveArticle && !gone, poll: focused, saved: !!saved.item, fallback: saved.item?.live });
  const feed = live.data;
  const now = useNow(isLiveArticle ? 30_000 : 3_600_000, focused);
  const articleAt = q.data ? q.dataUpdatedAt : 0;
  const liveState = isLiveArticle
    ? resolveLiveState({ state: articleLiveState(article) ?? undefined, at: articleAt }, feed ? { state: feed.coverage.state, at: feed.fetchedAt } : null)
    : null;
  const liveArchived = (feed && feed.fetchedAt >= articleAt ? feed.coverage.archived : article?.live?.archived) ?? feed?.coverage.archived ?? false;
  // offline, or showing the saved snapshot instead of a fetch made now: nothing confirms the coverage is still live,
  // so coverageStatus reports 'stale' ("not refreshed since …") instead of LIVE
  const unconfirmed = offline || live.fromSnapshot;
  const status = liveState ? coverageStatus({ state: liveState, archived: liveArchived }, unconfirmed ? null : Math.max(feed?.fetchedAt ?? 0, articleAt), now) : null;
  // the feed saw the coverage end (or reopen) before the article did → refresh the article (labels, revision)
  useEffect(() => {
    const aState = articleLiveState(q.data);
    if (feed && aState && feed.coverage.state !== aState && feed.fetchedAt > q.dataUpdatedAt) void qc.invalidateQueries({ queryKey: ['article', id], exact: true });
  }, [feed, q.data, q.dataUpdatedAt, qc, id]);
  // coverage withdrawn while open (410 from the feed) → reload the article, which shows the withdrawal notice
  useEffect(() => {
    if (isGone(live.query.error)) void qc.invalidateQueries({ queryKey: ['article', id], exact: true });
  }, [live.query.error, qc, id]);
  // updates that arrived while this screen is open (or since the cached copy) get a "New" marker
  const firstIds = useRef<Set<string> | null>(null);
  if (feed && !firstIds.current) firstIds.current = new Set(feed.updates.map((u) => u.id));
  const newIds = new Set(feed && firstIds.current ? feed.updates.filter((u) => !firstIds.current!.has(u.id)).map((u) => u.id) : []);

  // withdrawn → delete any offline copy (and the server bookmark when signed in)
  useEffect(() => {
    if (gone) {
      void unsaveArticle(id);
      qc.removeQueries({ queryKey: ['article', id], exact: true });
    }
  }, [gone, id, qc]);
  // keep the offline copy fresh when a newer revision is loaded
  useEffect(() => {
    if (q.data && saved.item && q.data.revision > saved.item.revision) void savedStore.update(q.data);
  }, [q.data, saved.item]);

  // ---- analytics: article_view, engaged_30s, read_complete
  const viewed = useRef(false);
  const readDone = useRef(false);
  useEffect(() => {
    if (article && !viewed.current) {
      viewed.current = true;
      track('article_view', { articleId: article.id, path: article.path, props: { offline: fromOfflineCopy } });
    }
  }, [article, fromOfflineCopy]);
  useEffect(() => {
    if (!article || !focused) return;
    let t: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      track('engaged_30s', { articleId: article.id });
      t = null;
    }, 30_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && t) {
        clearTimeout(t);
        t = null;
      }
    });
    return () => {
      if (t) clearTimeout(t);
      sub.remove();
    };
    // once per article per focus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id, focused]);
  const onReadComplete = useCallback(() => {
    if (readDone.current || !article) return;
    readDone.current = true;
    track('read_complete', { articleId: article.id });
  }, [article]);

  // ---- layout + scroll-driven header
  const readW = Math.min(width, articleMeasure + 40) - 40;
  const hasHero = !!article?.image && !(article.type === 'video' && article.video);
  const heroH = hasHero && article?.image ? Math.min(Math.round(width / aspectRatio(article.image)), Math.round(width * 0.75)) : 0;
  const topPad = insets.top + BAR_H;

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const y = useSharedValue(0);
  const contentH = useSharedValue(1);
  const viewH = useSharedValue(1);
  const [colY, setColY] = useState(0);
  const [feedLocalY, setFeedLocalY] = useState(0);
  const feedY = feedLocalY ? colY + feedLocalY : 0;
  const [pastFeedTop, setPastFeedTop] = useState(false);
  // "N new updates" pill only while the reader is below the top of the feed; otherwise new updates are simply in view
  const unseen = feed?.unseenIds.length ?? 0;
  const { markSeen } = live;
  useEffect(() => {
    if (unseen > 0 && !pastFeedTop) markSeen();
  }, [unseen, pastFeedTop, markSeen]);
  const feedYShared = useSharedValue(0);
  useEffect(() => {
    feedYShared.value = feedY;
  }, [feedY, feedYShared]);

  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  useAnimatedReaction(
    () => (contentH.value - viewH.value > 0 ? y.value / (contentH.value - viewH.value) : 0),
    (p, prev) => {
      if (p >= 0.9 && (prev ?? 0) < 0.9) scheduleOnRN(onReadComplete);
    },
    [onReadComplete],
  );
  useAnimatedReaction(
    () => feedYShared.value > 0 && y.value > feedYShared.value - 120,
    (past, prev) => {
      if (past !== prev) scheduleOnRN(setPastFeedTop, past);
    },
  );

  const solidFrom = heroH ? heroH - topPad - 30 : -1;
  // light status-bar text while it sits on the photo, theme colour once the bar turns solid
  const [barSolid, setBarSolid] = useState(false);
  useAnimatedReaction(
    () => !heroH || y.value > solidFrom - 20,
    (solid, prev) => {
      if (solid !== prev) scheduleOnRN(setBarSolid, solid);
    },
    [heroH, solidFrom],
  );
  const barBg = useAnimatedStyle(() => ({ opacity: heroH ? interpolate(y.value, [solidFrom - 40, solidFrom], [0, 1], Extrapolation.CLAMP) : 1 }));
  const overImage = useAnimatedStyle(() => ({ opacity: heroH ? interpolate(y.value, [solidFrom - 40, solidFrom], [1, 0], Extrapolation.CLAMP) : 0 }));
  const onBar = useAnimatedStyle(() => ({ opacity: heroH ? interpolate(y.value, [solidFrom - 40, solidFrom], [0, 1], Extrapolation.CLAMP) : 1 }));
  const barTitle = useAnimatedStyle(() => {
    const start = heroH ? heroH : 140;
    return { opacity: interpolate(y.value, [start, start + 60], [0, 1], Extrapolation.CLAMP), transform: [{ translateY: interpolate(y.value, [start, start + 60], [8, 0], Extrapolation.CLAMP) }] };
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(y.value, [-heroH, 0, heroH], [-heroH / 2, 0, heroH * 0.45], Extrapolation.CLAMP) },
      { scale: interpolate(y.value, [-heroH, 0], [2, 1], Extrapolation.CLAMP) },
    ],
  }));
  const progress = useAnimatedStyle(() => ({ width: `${Math.min(100, Math.max(0, contentH.value - viewH.value > 0 ? (y.value / (contentH.value - viewH.value)) * 100 : 0))}%` }));

  // ---- actions
  const isSaved = !!saved.item;
  const [showTextSize, setShowTextSize] = useState(false);
  const toggleSave = async () => {
    if (!article) return;
    if (isSaved) {
      await unsaveArticle(article.id);
      haptic.light();
    } else {
      await saveArticle(q.data ?? article);
      haptic.success();
    }
  };
  const share = async () => {
    if (!article) return;
    try {
      const r = await Share.share(Platform.OS === 'ios' ? { url: article.url, message: article.headline } : { message: `${article.headline}\n${article.url}`, title: article.headline }, { dialogTitle: 'Share this story', subject: article.headline });
      if (r.action !== Share.dismissedAction) track('share', { articleId: article.id, props: { method: 'native_sheet' } });
    } catch {
      /* share sheet unavailable (e.g. some browsers) */
    }
  };

  const actions = (tint: string, bubble?: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: bubble ? 6 : 0 }}>
      <IconButton icon="text-size" label="Text size" onPress={() => setShowTextSize((v) => !v)} color={tint} bg={bubble} active={showTextSize} />
      <IconButton icon={isSaved ? 'saved-filled' : 'saved'} label={isSaved ? 'Remove from saved' : 'Save for offline reading'} onPress={() => void toggleSave()} color={tint} bg={bubble} active={isSaved} />
      <IconButton icon="share" label="Share" onPress={() => void share()} color={tint} bg={bubble} />
      <IconButton icon="browser" label="Open in browser" onPress={() => article && void openExternal(article.url)} color={tint} bg={bubble} />
    </View>
  );

  const topBar = (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }} pointerEvents="box-none">
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: topPad, backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.border }, barBg]} />
      <View style={{ paddingTop: insets.top, height: topPad }} pointerEvents="box-none">
        {/* layer shown over the photo: white icons on translucent navy bubbles */}
        <Animated.View style={[{ position: 'absolute', top: insets.top, left: 0, right: 0, height: BAR_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }, overImage]} pointerEvents={heroH ? 'box-none' : 'none'}>
          <BackButton color="#FFFFFF" bg="rgba(6,26,64,0.5)" />
          <View style={{ flex: 1 }} />
          {article ? actions('#FFFFFF', 'rgba(6,26,64,0.5)') : null}
        </Animated.View>
        {/* layer shown once the bar is solid */}
        <Animated.View style={[{ height: BAR_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }, onBar]} pointerEvents="box-none">
          <BackButton />
          <Animated.View style={[{ flex: 1, paddingHorizontal: 4 }, barTitle]} pointerEvents="none">
            {article ? (
              <Txt variant="headline" size={14} numberOfLines={1}>
                {article.headline}
              </Txt>
            ) : null}
          </Animated.View>
          {article ? actions(c.heading) : null}
        </Animated.View>
      </View>
      <Animated.View style={[{ height: 2, backgroundColor: '#E1141E', position: 'absolute', top: topPad - 2, left: 0 }, progress]} />
      {showTextSize ? (
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOutUp.duration(150)} style={{ position: 'absolute', top: topPad + 8, right: 12, backgroundColor: c.surfaceRaised, borderRadius: 14, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', padding: 6, gap: 4, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
          <Tap onPress={() => updateSettings({ textScaleIndex: Math.max(0, scaleIndex - 1) })} disabled={scaleIndex === 0} haptics accessibilityLabel="Smaller text" style={{ width: 48, height: 44, alignItems: 'center', justifyContent: 'center', opacity: scaleIndex === 0 ? 0.35 : 1 }}>
            <Txt variant="headline" size={15}>A−</Txt>
          </Tap>
          <Txt variant="uiBold" size={13} muted style={{ minWidth: 48, textAlign: 'center' }} accessibilityLabel={`Text size ${Math.round(scale * 100)} percent`}>
            {Math.round(scale * 100)}%
          </Txt>
          <Tap onPress={() => updateSettings({ textScaleIndex: Math.min(textScaleSteps.length - 1, scaleIndex + 1) })} disabled={scaleIndex === textScaleSteps.length - 1} haptics accessibilityLabel="Larger text" style={{ width: 48, height: 44, alignItems: 'center', justifyContent: 'center', opacity: scaleIndex === textScaleSteps.length - 1 ? 0.35 : 1 }}>
            <Txt variant="headline" size={21}>A+</Txt>
          </Tap>
        </Animated.View>
      ) : null}
      {unseen > 0 && pastFeedTop ? (
        <Animated.View entering={FadeInDown} exiting={FadeOutUp} style={{ position: 'absolute', top: topPad + 10, alignSelf: 'center', left: 0, right: 0, alignItems: 'center' }} pointerEvents="box-none">
          <Tap
            haptics
            onPress={() => {
              scrollRef.current?.scrollTo({ y: Math.max(0, feedY - topPad - 8), animated: true });
              markSeen();
            }}
            accessibilityRole="button"
            accessibilityLabel={`${unseen} new live ${unseen === 1 ? 'update' : 'updates'}. Jump to latest.`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.breaking, borderRadius: 999, paddingHorizontal: 16, minHeight: 40 }}
          >
            <Icon name="arrow-up" size={16} color="#FFFFFF" />
            <Txt variant="uiBold" size={13.5} color="#FFFFFF">
              {unseen} new {unseen === 1 ? 'update' : 'updates'}
            </Txt>
          </Tap>
        </Animated.View>
      ) : null}
    </View>
  );

  // ---- states
  if (!valid) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: topPad }}>
        {topBar}
        <ErrorState error={null} title="This link isn’t a GO World News article" />
      </View>
    );
  }
  if (gone) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: topPad }}>
        {topBar}
        <TombstoneView tombstone={gone.tombstone} message={gone.message} />
      </View>
    );
  }
  if (!article) {
    const loading = q.isPending || saved.loading;
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: topPad }}>
        {topBar}
        {loading && !q.isError ? <ArticleSkeleton /> : <ErrorState error={q.error} onRetry={() => void q.refetch()} title={isNetworkError(q.error) ? (offline ? 'You’re offline' : 'Couldn’t reach GO World News') : 'Couldn’t load this story'} />}
      </View>
    );
  }

  const heroVideo = article.type === 'video' && article.video ? videoSource(article.video) : null;
  const inBody = new Set(relatedIds(article.body));
  const related = ((isLiveArticle && feed?.relatedArticles?.length ? feed.relatedArticles : article.relatedArticles) ?? []).filter((r) => r.id !== article.id && !inBody.has(r.id));
  const bannerCoverage = feed?.coverage ?? { startedAt: article.live?.startedAt ?? null, endedAt: article.live?.endedAt ?? null, lastUpdateAt: null, updateCount: 0 };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {focused ? <StatusBar style={heroH && !barSolid ? 'light' : isDark ? 'light' : 'dark'} animated /> : null}
      {topBar}
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={notify}
        onScrollEndDrag={notify}
        onContentSizeChange={(_w, h) => (contentH.value = h)}
        onLayout={(e) => (viewH.value = e.nativeEvent.layout.height)}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48, paddingTop: heroH ? 0 : topPad }}
        accessibilityLabel={article.headline}
      >
        {heroH && article.image ? (
          <View style={{ height: heroH, overflow: 'hidden', backgroundColor: '#061A40' }}>
            <Animated.View entering={FadeIn.duration(260)} style={heroStyle}>
              <ArticleImage image={article.image} width={width} ratio={width / heroH} priority="high" />
            </Animated.View>
          </View>
        ) : null}
        {heroVideo?.kind === 'file' ? (
          <InlineVideo url={heroVideo.url} poster={article.image} title={article.headline} articleId={article.id} width={width} durationSeconds={article.video?.durationSeconds} />
        ) : null}
        {heroH && (article.image?.caption || article.image?.credit) ? (
          <Txt variant="ui" size={12} muted style={{ paddingHorizontal: 20, paddingTop: 8, maxWidth: articleMeasure + 40, alignSelf: 'center', width: '100%' }}>
            {[article.image?.caption, article.image?.credit].filter(Boolean).join('  ·  ')}
          </Txt>
        ) : null}

        <Animated.View entering={FadeInDown.duration(320).delay(60)} onLayout={(e) => setColY(e.nativeEvent.layout.y)} style={{ width: readW, alignSelf: 'center', paddingTop: 20, gap: 20 }}>
          {showOfflineNote ? (
            <View accessibilityRole="text" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: c.surface, borderRadius: 10, padding: 10 }}>
              <Icon name="offline" size={16} color={c.textMuted} />
              <Txt variant="ui" size={12.5} muted style={{ flex: 1 }}>
                {saved.item
                  ? `${offline ? 'You’re offline.' : q.isError ? 'GO World News couldn’t be reached.' : 'Loading the latest version…'} Reading the copy saved on this device (${formatDate(saved.item.savedAt)}). It updates automatically when the connection is back.`
                  : `${offline ? 'You’re offline.' : q.isError ? 'GO World News couldn’t be reached.' : 'Loading the latest version…'} Showing the version downloaded ${timeAgo(new Date(q.dataUpdatedAt || Date.now()).toISOString()).toLowerCase()}.`}
              </Txt>
            </View>
          ) : null}
          {article.isDemo ? <DemoNotice /> : null}
          <ArticleHeaderText a={article} scale={scale} liveState={isLiveArticle ? (status === 'live' ? 'live' : status === 'ended' || status === 'archived' ? 'ended' : null) : undefined} />
          {isLiveArticle && status ? <LiveStatusBanner status={status} coverage={bannerCoverage} fetchedAt={feed?.fetchedAt ?? (articleAt || null)} now={now} offline={offline} /> : null}
          <SponsorBox a={article} />
          <Byline a={article} live={isLiveArticle} />
          {article.type === 'podcast' ? <PodcastEpisodeSection articleId={article.id} /> : null}
          <Blocks blocks={article.body} ctx={{ width: readW, scale, articleId: article.id, skipVideoUrl: heroVideo?.kind === 'file' ? heroVideo.url : undefined }} />
          {isLiveArticle ? (
            <View onLayout={(e) => setFeedLocalY(e.nativeEvent.layout.y)}>
              <LiveTimeline
                articleId={article.id}
                feed={feed}
                status={status}
                loading={live.query.isPending && live.query.fetchStatus !== 'idle'}
                failed={live.query.isError}
                width={readW}
                scale={scale}
                now={now}
                newIds={newIds}
              />
            </View>
          ) : null}
          <CorrectionsBox corrections={article.corrections} />
          <Sources sources={article.sources} />
          <Tags tags={article.tags} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Tap haptics onPress={() => void toggleSave()} accessibilityLabel={isSaved ? 'Remove from saved' : 'Save for offline reading'} style={{ flex: 1, minHeight: 48, borderRadius: 999, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: isSaved ? c.surface : 'transparent' }}>
              <Icon name={isSaved ? 'saved-filled' : 'saved'} size={18} color={c.heading} />
              <Txt variant="uiBold" size={14}>{isSaved ? 'Saved offline' : 'Save'}</Txt>
            </Tap>
            <Tap haptics onPress={() => void share()} accessibilityLabel="Share" style={{ flex: 1, minHeight: 48, borderRadius: 999, backgroundColor: isDark ? '#FFFFFF' : '#0B2A5E', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="share" size={18} color={isDark ? '#061A40' : '#FFFFFF'} />
              <Txt variant="uiBold" size={14} color={isDark ? '#061A40' : '#FFFFFF'}>Share</Txt>
            </Tap>
          </View>
          <RelatedStories items={related} />
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}
