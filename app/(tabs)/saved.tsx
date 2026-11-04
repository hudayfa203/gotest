import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { Extrapolation, FadeOut, LinearTransition, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { getSessionToken, onSessionChange } from '../../src/api';
import { ArticleImage } from '../../src/components/ArticleImage';
import { MAX_FEED_WIDTH } from '../../src/components/cards';
import { Icon } from '../../src/components/Icon';
import { DemoBadge, StatusLabels } from '../../src/components/Labels';
import { FeedSkeleton } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/StateViews';
import { TabHeader } from '../../src/components/TabHeader';
import { Tap } from '../../src/components/Tap';
import { Txt } from '../../src/components/Txt';
import { mergeBookmarks, unsaveArticle } from '../../src/features/saved';
import { useSavedList } from '../../src/features/useSaved';
import { syncNow } from '../../src/features/syncRunner';
import { formatDate } from '../../src/lib/format';
import { haptic } from '../../src/lib/haptics';
import { openArticle } from '../../src/lib/navigation';
import { useTheme } from '../../src/state/theme';
import type { SavedItem } from '../../src/storage/savedTypes';

function DeleteAction({ progress, onPress }: { progress: SharedValue<number>; onPress: () => void }) {
  const style = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(progress.value, [0, 1], [0.6, 1], Extrapolation.CLAMP) }] }));
  return (
    <Tap onPress={onPress} accessibilityLabel="Delete from saved" style={{ width: 96, backgroundColor: '#C8101A', alignItems: 'center', justifyContent: 'center' }} pressScale={0}>
      <Animated.View style={[{ alignItems: 'center', gap: 4 }, style]}>
        <Icon name="trash" size={22} color="#FFFFFF" />
        <Txt variant="uiBold" size={12} color="#FFFFFF">
          Delete
        </Txt>
      </Animated.View>
    </Tap>
  );
}

function SavedRow({ item }: { item: SavedItem }) {
  const { c } = useTheme();
  const a = item.article;
  const remove = () => {
    haptic.warning();
    void unsaveArticle(a.id);
  };
  return (
    <Animated.View exiting={FadeOut.duration(200)} layout={LinearTransition.duration(220)}>
      <ReanimatedSwipeable
        friction={2}
        rightThreshold={60}
        overshootRight={false}
        renderRightActions={(progress) => <DeleteAction progress={progress} onPress={remove} />}
        // only a right-hand action exists: swiping it fully open deletes (the button works too)
        onSwipeableOpen={remove}
      >
        <Tap
          onPress={() => openArticle(a.id)}
          pressScale={0.99}
          accessibilityRole="link"
          accessibilityLabel={`${a.headline}. Saved ${formatDate(item.savedAt)}. Available offline.${a.isDemo ? ' Demo content.' : ''}`}
          accessibilityActions={[{ name: 'delete', label: 'Delete from saved' }]}
          onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && remove()}
          style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.border }}
        >
          <ArticleImage image={a.image} width={96} ratio={1} radius={10} accessible={false} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <StatusLabels a={a} max={1} />
              <Txt variant="kicker" size={10.5} color={c.link} numberOfLines={1} style={{ flexShrink: 1 }}>
                {a.category.name}
              </Txt>
            </View>
            <Txt variant="headline" size={15.5} lineHeight={20} numberOfLines={3}>
              {a.headline}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.surface, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Icon name="check" size={12} color={c.success} />
                <Txt variant="uiStrong" size={11} color={c.success}>
                  Offline
                </Txt>
              </View>
              <Txt variant="ui" size={12} muted>
                Saved {formatDate(item.savedAt)}
              </Txt>
              {a.isDemo ? <DemoBadge /> : null}
            </View>
          </View>
        </Tap>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

export default function SavedScreen() {
  const { c } = useTheme();
  const { loading, items } = useSavedList();
  const [signedIn, setSignedIn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    void getSessionToken().then((t) => setSignedIn(!!t));
    return onSessionChange(setSignedIn);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    haptic.light();
    await syncNow();
    if (signedIn) await mergeBookmarks().catch(() => null);
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TabHeader title="Saved" subtitle={signedIn ? 'On this device · synced with your account' : 'Stored on this device · readable offline'} />
      {loading ? (
        <FeedSkeleton hero={false} rows={4} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <SavedRow item={item} />}
          contentContainerStyle={{ paddingBottom: 32, maxWidth: MAX_FEED_WIDTH, width: '100%', alignSelf: 'center', flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.textMuted} colors={['#E1141E']} />}
          ListHeaderComponent={
            items.length ? (
              <Txt variant="ui" size={12.5} muted style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                {items.length} {items.length === 1 ? 'story' : 'stories'} · Swipe left to delete
              </Txt>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon="saved"
              title="Nothing saved yet"
              body="Tap the bookmark on any story to keep a full copy on this device. Saved stories open without a connection, and withdrawn or corrected stories are updated automatically."
              action={signedIn ? undefined : { title: 'Sign in to sync across devices', onPress: () => router.push('/settings/sign-in' as Href) }}
            />
          }
        />
      )}
    </View>
  );
}
