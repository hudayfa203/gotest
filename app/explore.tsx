import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Platform, ScrollView, TextInput, View, type TextInputInstance } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { endpoints } from '../src/api';
import { MAX_FEED_WIDTH, StoryRow } from '../src/components/cards';
import { Icon } from '../src/components/Icon';
import { FeedSkeleton } from '../src/components/Skeleton';
import { EmptyState, ErrorState } from '../src/components/StateViews';
import { TabHeader } from '../src/components/TabHeader';
import { Tap } from '../src/components/Tap';
import { Txt } from '../src/components/Txt';
import { track } from '../src/lib/analytics';
import { targetFromWebPath } from '../src/lib/deeplink';
import { openTarget } from '../src/lib/navigation';
import { kv, KV_KEYS } from '../src/storage/kv';
import { useTheme } from '../src/state/theme';
import { fonts } from '../src/theme';

/** the container shows focus instead of the browser's outline (web preview only) */
const noWebOutline = Platform.OS === 'web' ? ({ outlineWidth: 0 } as object) : null;

const TYPES: { value: string | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'news', label: 'News' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'opinion', label: 'Opinion' },
  { value: 'investigation', label: 'Investigations' },
  { value: 'explainer', label: 'Explainers' },
  { value: 'live', label: 'Live' },
  { value: 'video', label: 'Video' },
  { value: 'podcast', label: 'Podcasts' },
];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { c, isDark } = useTheme();
  return (
    <Tap
      onPress={onPress}
      haptics
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', backgroundColor: active ? (isDark ? '#FFFFFF' : '#0B2A5E') : c.surface, borderWidth: 1, borderColor: active ? 'transparent' : c.border }}
      hitSlop={{ top: 4, bottom: 4 }}
    >
      <Txt variant={active ? 'uiBold' : 'ui'} size={13} color={active ? (isDark ? '#061A40' : '#FFFFFF') : c.text}>
        {label}
      </Txt>
    </Tap>
  );
}

export default function ExploreScreen() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ q?: string }>();
  const [text, setText] = useState(params.q ?? '');
  const [term, setTerm] = useState(params.q ?? '');
  const [type, setType] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<'relevance' | 'newest'>('relevance');
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (params.q) {
      setText(params.q);
      setTerm(params.q);
    }
  }, [params.q]);
  useEffect(() => {
    void kv.get<string[]>(KV_KEYS.recentSearches, []).then(setRecent);
  }, []);
  // search as you type (debounced); the API is rate-limited to 60/min per IP
  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 450);
    return () => clearTimeout(t);
  }, [text]);

  const remember = (q: string) => {
    const v = q.trim();
    if (v.length < 2) return;
    const next = [v, ...recent.filter((r) => r.toLowerCase() !== v.toLowerCase())].slice(0, 8);
    setRecent(next);
    void kv.set(KV_KEYS.recentSearches, next);
  };
  const clearRecent = () => {
    setRecent([]);
    void kv.remove(KV_KEYS.recentSearches);
  };

  const nav = useQuery({ queryKey: ['navigation', 'app_explore'], queryFn: ({ signal }) => endpoints.navigation('app_explore', signal), staleTime: 30 * 60_000 });
  const cats = useQuery({ queryKey: ['categories'], queryFn: ({ signal }) => endpoints.categories(signal), staleTime: 30 * 60_000 });

  const active = term.length >= 2;
  const search = useInfiniteQuery({
    queryKey: ['search', term, type, category, sort],
    enabled: active,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => endpoints.search({ q: term, type: type ?? undefined, category: category ?? undefined, sort, page: pageParam, pageSize: 20 }, signal),
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    staleTime: 60_000,
  });
  const results = useMemo(() => search.data?.pages.flatMap((p) => p.items) ?? [], [search.data]);
  const total = search.data?.pages[0]?.total ?? 0;

  useEffect(() => {
    if (active && search.isSuccess && search.data.pages.length === 1) {
      track('search', { props: { q: term.toLowerCase().slice(0, 80), results: total, type: type ?? 'all', sort } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, search.isSuccess, term, type, category, sort]);

  const searchBox = (
    <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 14, borderWidth: focused ? 2 : 1, borderColor: focused ? c.focus : c.border, paddingHorizontal: focused ? 11 : 12, minHeight: 48 }}>
        <Icon name="search" size={20} color={c.textMuted} />
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search GO World News"
          placeholderTextColor={c.textMuted}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="never"
          onSubmitEditing={() => {
            setTerm(text.trim());
            remember(text);
          }}
          accessibilityLabel="Search stories"
          style={[{ flex: 1, fontFamily: fonts.ui500, fontSize: 16, color: c.text, paddingHorizontal: 10, paddingVertical: 10 }, noWebOutline]}
        />
        {text ? (
          <Tap
            onPress={() => {
              setText('');
              setTerm('');
              inputRef.current?.focus();
            }}
            accessibilityLabel="Clear search"
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="close" size={18} color={c.textMuted} />
          </Tap>
        ) : null}
      </View>
    </View>
  );

  const filters = (
    <View style={{ gap: 10, paddingBottom: 6 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
        {TYPES.map((t) => (
          <Chip key={t.label} label={t.label} active={type === t.value} onPress={() => setType(t.value)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
        <Chip label={sort === 'relevance' ? 'Most relevant' : 'Newest first'} active={false} onPress={() => setSort(sort === 'relevance' ? 'newest' : 'relevance')} />
        <Chip label="All sections" active={category === null} onPress={() => setCategory(null)} />
        {(cats.data ?? [])
          .filter((x) => x.slug !== 'video' && x.slug !== 'podcasts')
          .map((x) => (
            <Chip key={x.slug} label={x.name} active={category === x.slug} onPress={() => setCategory(category === x.slug ? null : x.slug)} />
          ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TabHeader title="Search" subtitle="Stories, sections and topics" back>
        {searchBox}
      </TabHeader>
      {active ? (
        <View style={{ flex: 1 }}>
          <View style={{ paddingTop: 12, maxWidth: MAX_FEED_WIDTH, width: '100%', alignSelf: 'center' }}>{filters}</View>
          {search.isPending ? (
            <FeedSkeleton hero={false} rows={4} />
          ) : search.isError ? (
            <ErrorState error={search.error} onRetry={() => void search.refetch()} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(a) => a.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingBottom: 32, maxWidth: MAX_FEED_WIDTH, width: '100%', alignSelf: 'center' }}
              ListHeaderComponent={
                <Txt variant="ui" size={13} muted style={{ paddingHorizontal: 16, paddingTop: 8 }} accessibilityLiveRegion="polite">
                  {total === 1 ? '1 result' : `${total} results`} for “{term}”
                </Txt>
              }
              renderItem={({ item, index }) => (
                <View style={{ paddingHorizontal: 16 }} onTouchStart={() => remember(term)}>
                  <StoryRow a={item} divider={index < results.length - 1} />
                </View>
              )}
              onEndReachedThreshold={0.5}
              onEndReached={() => {
                if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
              }}
              ListFooterComponent={search.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color={c.textMuted} /> : undefined}
              ListEmptyComponent={<EmptyState icon="search" title="No results" body="Try different words, or remove a filter." />}
            />
          )}
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 40, maxWidth: MAX_FEED_WIDTH, width: '100%', alignSelf: 'center' }} onScrollBeginDrag={Keyboard.dismiss}>
          {recent.length ? (
            <Animated.View entering={FadeIn} style={{ paddingTop: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 }}>
                <Txt variant="title" size={15} style={{ flex: 1 }} accessibilityRole="header">
                  Recent searches
                </Txt>
                <Tap onPress={clearRecent} accessibilityLabel="Clear recent searches" style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 12 }}>
                  <Txt variant="uiBold" size={13} color={c.link}>
                    Clear
                  </Txt>
                </Tap>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 }}>
                {recent.map((r) => (
                  <Chip
                    key={r}
                    label={r}
                    active={false}
                    onPress={() => {
                      setText(r);
                      setTerm(r);
                    }}
                  />
                ))}
              </View>
            </Animated.View>
          ) : null}

          <View style={{ paddingTop: 22 }}>
            <Txt variant="title" size={15} style={{ paddingHorizontal: 16, marginBottom: 12 }} accessibilityRole="header">
              Sections
            </Txt>
            {nav.isPending ? (
              <FeedSkeleton hero={false} rows={3} />
            ) : nav.isError && !nav.data ? (
              <ErrorState error={nav.error} onRetry={() => void nav.refetch()} />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 }}>
                {(nav.data ?? []).map((item) => (
                  <View key={item.href} style={{ width: '50%', padding: 4 }}>
                    <Tap
                      onPress={() => openTarget(targetFromWebPath(item.href))}
                      accessibilityRole="link"
                      accessibilityLabel={`${item.label} section`}
                      style={{ minHeight: 60, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, paddingLeft: 12, paddingRight: 10, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' }}
                    >
                      <View style={{ width: 4, height: 22, backgroundColor: '#E1141E', transform: [{ skewX: '-15deg' }], borderRadius: 1 }} />
                      <Txt variant="headline" size={15} style={{ flex: 1 }} numberOfLines={2}>
                        {item.label}
                      </Txt>
                      <Icon name="chevron-right" size={18} color={c.textMuted} />
                    </Tap>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
