import { router, type Href } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { AdCard } from '../../components/AdCard';
import { LeadCard, TimelineRow, OpinionCard, PodcastCard, StoryCard, StoryRow, TrendingRow, VideoCard, useFeedWidth } from '../../components/cards';
import { NewsletterPromo } from '../../components/NewsletterPromo';
import { SectionHeader } from '../../components/SectionHeader';
import { openWebUrl } from '../../lib/navigation';
import { useTheme } from '../../state/theme';
import type { HomepageSection } from '../../types';

export const APP_FEED_PLACEMENT = 'app_feed_3';

/** Renders one GET /home section natively according to its `layout`. */
export function HomeSection({ s }: { s: HomepageSection }) {
  const { c } = useTheme();
  const { content, full } = useFeedWidth();
  const more = s.moreUrl ? () => openWebUrl(s.moreUrl!) : undefined;
  const pad = { paddingHorizontal: 16 };

  switch (s.layout) {
    case 'lead': {
      const [first, ...rest] = s.items;
      if (!first) return null;
      return (
        <View>
          <LeadCard a={first} />
          {rest.length ? <View style={pad}>{rest.map((a, i) => <StoryRow key={a.id} a={a} divider={i < rest.length - 1} />)}</View> : null}
        </View>
      );
    }
    case 'top_stories': {
      const [first, ...rest] = s.items;
      if (!first) return null;
      return (
        <View>
          <SectionHeader title={s.title || 'Top stories'} onMore={more} />
          <View style={pad}>
            <StoryCard a={first} />
            <View style={{ marginTop: 6 }}>
              {rest.map((a, i) => (
                <StoryRow key={a.id} a={a} divider={i < rest.length - 1} />
              ))}
            </View>
          </View>
        </View>
      );
    }
    case 'latest':
      if (!s.items.length) return null;
      // the website's timeline: clock time, red dot on a rail, category, headline — on a tinted band
      return (
        <View style={{ backgroundColor: c.surface, paddingTop: 22, paddingBottom: 10, width: full, alignSelf: 'center' }}>
          <SectionHeader title={s.title || 'Latest'} onMore={() => router.navigate('/latest' as Href)} moreLabel="All latest news" />
          <View style={pad}>
            {s.items.slice(0, 7).map((a, i, arr) => (
              <TimelineRow key={a.id} a={a} last={i === arr.length - 1} />
            ))}
          </View>
        </View>
      );
    case 'region':
    case 'editors_picks':
    case 'investigations': {
      if (!s.items.length) return null;
      if (s.items.length === 1 || s.layout === 'investigations') {
        return (
          <View>
            <SectionHeader title={s.title || 'Investigations'} onMore={more} />
            <View style={pad}>
              {s.items.map((a, i) => (i === 0 ? <StoryCard key={a.id} a={a} /> : <StoryRow key={a.id} a={a} divider={i < s.items.length - 1} />))}
            </View>
          </View>
        );
      }
      const cardW = Math.min(300, Math.round(content * 0.8));
      return (
        <View>
          <SectionHeader title={s.title || 'Stories'} onMore={more} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={cardW + 14} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
            {s.items.map((a) => (
              <StoryCard key={a.id} a={a} width={cardW} />
            ))}
          </ScrollView>
        </View>
      );
    }
    case 'video': {
      if (!s.items.length) return null;
      const w = s.items.length === 1 ? content : Math.min(300, Math.round(content * 0.82));
      return (
        <View style={{ backgroundColor: '#061A40', paddingTop: 20, paddingBottom: 22, width: full, alignSelf: 'center' }}>
          <SectionHeader title={s.title || 'Watch'} onMore={() => router.navigate('/video' as Href)} moreLabel="All video" dark />
          <ScrollView horizontal scrollEnabled={s.items.length > 1} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
            {s.items.map((a) => (
              <VideoCard key={a.id} a={a} width={w} />
            ))}
          </ScrollView>
        </View>
      );
    }
    case 'opinion':
      if (!s.items.length) return null;
      return (
        <View>
          <SectionHeader title={s.title || 'Opinion'} onMore={more} />
          <View style={[pad, { gap: 12 }]}>
            {s.items.map((a) => (
              <OpinionCard key={a.id} a={a} />
            ))}
          </View>
        </View>
      );
    case 'podcasts':
      if (!s.items.length) return null;
      return (
        <View>
          <SectionHeader title={s.title || 'Listen'} onMore={more} />
          <View style={[pad, { gap: 12 }]}>
            {s.items.map((a) => (
              <PodcastCard key={a.id} a={a} />
            ))}
          </View>
        </View>
      );
    case 'trending':
      if (!s.items.length) return null;
      return (
        <View>
          <SectionHeader title={s.title || 'Most read'} />
          <View style={[pad, { backgroundColor: c.bg }]}>
            {s.items.map((a, i) => (
              <TrendingRow key={a.id} a={a} rank={i + 1} last={i === s.items.length - 1} />
            ))}
          </View>
        </View>
      );
    case 'newsletter':
      return <NewsletterPromo title={s.title} width={content} />;
    case 'ad':
      return <AdCard placement={APP_FEED_PLACEMENT} />;
    default:
      return null;
  }
}
