import { Text, type TextStyle } from 'react-native';
import { markStyle } from '../../lib/blocks';
import { openArticleLink } from '../../lib/navigation';
import { useTheme } from '../../state/theme';
import type { Inline } from '../../types';

export interface InlineFonts {
  regular: string;
  bold: string;
  italic: string;
  boldItalic?: string;
  mono?: string;
}

/**
 * Renders portable inline content (text + marks, links, line breaks) as nested <Text>.
 * Links are tappable: goworld.news article links open in the app, everything else in the in-app browser.
 */
export function InlineContent({ children, fonts, linkColor }: { children: Inline[]; fonts: InlineFonts; linkColor?: string }) {
  const { c } = useTheme();
  return (
    <>
      {children.map((node, i) => {
        if (node.type === 'linebreak') return <Text key={i}>{'\n'}</Text>;
        if (node.type === 'link') {
          return (
            <Text
              key={i}
              accessibilityRole="link"
              accessibilityHint={node.internalArticleId ? 'Opens the article' : 'Opens the link'}
              onPress={() => openArticleLink(node)}
              suppressHighlighting={false}
              style={{ color: linkColor ?? c.link, textDecorationLine: 'underline', textDecorationColor: linkColor ?? c.link }}
            >
              {node.text}
            </Text>
          );
        }
        const m = markStyle(node.marks);
        const style: { -readonly [K in keyof TextStyle]?: TextStyle[K] } = {};
        if (m.bold && m.italic) style.fontFamily = fonts.boldItalic ?? fonts.bold;
        else if (m.bold) style.fontFamily = fonts.bold;
        else if (m.italic) style.fontFamily = fonts.italic;
        const deco = [m.underline ? 'underline' : null, m.strike ? 'line-through' : null].filter(Boolean).join(' ');
        if (deco) style.textDecorationLine = deco as TextStyle['textDecorationLine'];
        if (m.code) {
          style.fontFamily = fonts.mono ?? 'Courier';
          style.backgroundColor = c.surface;
        }
        if (m.superscript || m.subscript) {
          style.fontSize = 11;
          style.lineHeight = 14;
        }
        if (!node.marks?.length) return node.text;
        return (
          <Text key={i} style={style}>
            {node.text}
          </Text>
        );
      })}
    </>
  );
}
