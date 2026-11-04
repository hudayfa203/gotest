import { View } from 'react-native';
import { useTheme } from '../../state/theme';
import type { ArticleSummary } from '../../types';
import { StoryRow } from '../cards';
import { Txt } from '../Txt';

/** Editor-chosen related stories (Article.relatedArticles / LiveFeed.relatedArticles) — any article, live or not. */
export function RelatedStories({ items, title = 'Related coverage' }: { items: ArticleSummary[]; title?: string }) {
  const { c } = useTheme();
  if (!items.length) return null;
  return (
    <View style={{ borderTopWidth: 3, borderTopColor: c.heading, paddingTop: 10 }} accessibilityRole="summary">
      <Txt variant="kicker" size={12} color={c.heading} accessibilityRole="header">
        {title}
      </Txt>
      {items.map((a, i) => (
        <StoryRow key={a.id} a={a} divider={i < items.length - 1} />
      ))}
    </View>
  );
}
