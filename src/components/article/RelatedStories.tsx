import { View } from 'react-native';
import { useTheme } from '../../state/theme';
import { fonts } from '../../theme';
import type { ArticleSummary } from '../../types';
import { StoryRow } from '../cards';
import { RedBlock } from '../SectionHeader';
import { Txt } from '../Txt';

/** Editor-chosen related stories (Article.relatedArticles / LiveFeed.relatedArticles) — any article, live or not. */
export function RelatedStories({ items, title = 'Related coverage' }: { items: ArticleSummary[]; title?: string }) {
  const { c } = useTheme();
  if (!items.length) return null;
  return (
    <View accessibilityRole="summary">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <RedBlock w={20} h={11} />
        <Txt variant="display" size={19} color={c.heading} style={{ fontFamily: fonts.display900Italic }} accessibilityRole="header">
          {title}
        </Txt>
      </View>
      {items.map((a, i) => (
        <StoryRow key={a.id} a={a} divider={i < items.length - 1} />
      ))}
    </View>
  );
}
