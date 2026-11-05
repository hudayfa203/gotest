import { useQueries } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { endpoints } from '../../api';
import { embedLabel, headingSize, hostOf, listMarker, tableColumnWidths, videoSource } from '../../lib/blocks';
import { openExternal } from '../../lib/navigation';
import { useTheme } from '../../state/theme';
import { fonts } from '../../theme';
import type { Block, ImageRef } from '../../types';
import { AdCard } from '../AdCard';
import { ArticleImage } from '../ArticleImage';
import { StoryRow } from '../cards';
import { Icon } from '../Icon';
import { InlineVideo } from '../media/InlineVideo';
import { NewsletterPromo } from '../NewsletterPromo';
import { Tap } from '../Tap';
import { Txt } from '../Txt';
import { InlineContent, type InlineFonts } from './Inline';
import { Lightbox } from './Lightbox';

const SERIF: InlineFonts = { regular: fonts.serif400, bold: fonts.serif700, italic: fonts.serif400Italic, boldItalic: fonts.serif700 };
const DISPLAY: InlineFonts = { regular: fonts.display800, bold: fonts.display900, italic: fonts.display800Italic, boldItalic: fonts.display900Italic };

export interface BlockContext {
  /** reading width in pt */
  width: number;
  /** in-app text size multiplier (A− / A+) */
  scale: number;
  articleId: string;
  /** don't render a body video already shown as the hero */
  skipVideoUrl?: string;
}

/** Native renderer for the portable block tree (every Block type in packages/contracts). */
export function Blocks({ blocks, ctx }: { blocks: Block[]; ctx: BlockContext }) {
  return (
    <View style={{ gap: 18 * Math.min(ctx.scale, 1.2) }}>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} ctx={ctx} />
      ))}
    </View>
  );
}

export function BlockView({ block: b, ctx }: { block: Block; ctx: BlockContext }) {
  const { c } = useTheme();
  const s = ctx.scale;
  const bodySize = 18 * s;
  const bodyLine = Math.round(bodySize * 1.62);

  switch (b.type) {
    case 'paragraph':
      return (
        <Text allowFontScaling maxFontSizeMultiplier={2} style={{ fontFamily: SERIF.regular, fontSize: bodySize, lineHeight: bodyLine, color: c.text }}>
          <InlineContent fonts={SERIF}>{b.children}</InlineContent>
        </Text>
      );
    case 'heading': {
      const size = headingSize(b.level) * s;
      return (
        <Text accessibilityRole="header" allowFontScaling maxFontSizeMultiplier={1.6} style={{ fontFamily: b.level === 4 ? fonts.display700 : fonts.display800, fontSize: size, lineHeight: Math.round(size * 1.25), color: c.heading, marginTop: 8 }}>
          <InlineContent fonts={DISPLAY}>{b.children}</InlineContent>
        </Text>
      );
    }
    case 'quote':
      return (
        <View style={{ borderLeftWidth: 4, borderLeftColor: c.accent, paddingLeft: 16, paddingVertical: 4, marginVertical: 6 }} accessible accessibilityLabel={`Quote: ${b.children.map((x) => ('text' in x ? x.text : '')).join('')}${b.attribution ? `, ${b.attribution}` : ''}`}>
          <Text allowFontScaling maxFontSizeMultiplier={1.8} style={{ fontFamily: fonts.serif400Italic, fontSize: 21 * s, lineHeight: Math.round(21 * s * 1.45), color: c.heading }}>
            <InlineContent fonts={{ ...SERIF, regular: fonts.serif400Italic }}>{b.children}</InlineContent>
          </Text>
          {b.attribution ? (
            <Txt variant="uiStrong" size={13.5 * Math.min(s, 1.3)} muted style={{ marginTop: 8 }}>
              — {b.attribution}
            </Txt>
          ) : null}
        </View>
      );
    case 'list':
      return (
        <View style={{ gap: 10 }} accessibilityRole="list">
          {b.items.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <Text style={{ fontFamily: b.ordered ? fonts.display700 : fonts.serif700, fontSize: bodySize, lineHeight: bodyLine, color: c.accent, minWidth: b.ordered ? 24 : 14 }} accessibilityElementsHidden>
                {listMarker(b.ordered, i)}
              </Text>
              <Text allowFontScaling maxFontSizeMultiplier={2} style={{ flex: 1, fontFamily: SERIF.regular, fontSize: bodySize, lineHeight: bodyLine, color: c.text }}>
                <InlineContent fonts={SERIF}>{item}</InlineContent>
              </Text>
            </View>
          ))}
        </View>
      );
    case 'image':
      return <ImageBlock image={b.image} width={ctx.width} />;
    case 'gallery':
      return b.images.length ? <GalleryBlock images={b.images} caption={b.caption} width={ctx.width} /> : null;
    case 'video': {
      if (ctx.skipVideoUrl && b.url === ctx.skipVideoUrl) return null;
      const src = videoSource(b);
      if (src.kind === 'file') return <InlineVideo url={src.url} poster={b.poster} title={b.title} articleId={ctx.articleId} width={ctx.width} radius={10} />;
      if (src.kind === 'external') {
        return (
          <Tap onPress={() => void openExternal(src.url)} accessibilityRole="link" accessibilityLabel={`${src.label}: ${b.title}`} style={{ borderRadius: 10, overflow: 'hidden', backgroundColor: '#061A40' }}>
            {b.poster ? <ArticleImage image={b.poster} width={ctx.width} ratio={16 / 9} accessible={false} /> : <LinearGradient colors={['#061A40', '#0B2A5E', '#1A4FB0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: ctx.width, height: Math.round((ctx.width * 9) / 16) }} />}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 52, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#E1141E', alignItems: 'center', justifyContent: 'center', paddingLeft: 4 }}>
                <Icon name="play" size={26} color="#FFFFFF" />
              </View>
              <Txt variant="uiBold" size={13} color="#FFFFFF">
                {src.label}
              </Txt>
            </View>
            <View style={{ padding: 12, backgroundColor: '#0B2A5E' }}>
              <Txt variant="title" size={15} color="#FFFFFF" numberOfLines={2}>
                {b.title}
              </Txt>
            </View>
          </Tap>
        );
      }
      return null;
    }
    case 'embed':
      return (
        <Tap onPress={() => void openExternal(b.url)} accessibilityRole="link" accessibilityLabel={`${embedLabel(b.provider)} from ${hostOf(b.url)}. Opens in browser.`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 14, backgroundColor: c.surface }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="external" size={20} color={c.link} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="uiBold" size={14.5}>
              {embedLabel(b.provider)}
            </Txt>
            <Txt variant="ui" size={12.5} muted numberOfLines={1}>
              {hostOf(b.url)} · Opens in browser
            </Txt>
          </View>
          <Icon name="chevron-right" size={18} color={c.textMuted} />
        </Tap>
      );
    case 'table': {
      const widths = tableColumnWidths(b.header, b.rows);
      return (
        <View style={{ gap: 8 }}>
          {b.caption ? (
            <Txt variant="title" size={14.5 * Math.min(s, 1.3)}>
              {b.caption}
            </Txt>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel={b.caption ? `Table: ${b.caption}` : 'Table'} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10 }}>
            <View>
              <View style={{ flexDirection: 'row', backgroundColor: c.surface }}>
                {b.header.map((h, i) => (
                  <View key={i} style={{ width: widths[i], padding: 10, borderRightWidth: i < widths.length - 1 ? 1 : 0, borderRightColor: c.border }}>
                    <Txt variant="uiBold" size={13 * Math.min(s, 1.3)}>
                      {h}
                    </Txt>
                  </View>
                ))}
              </View>
              {b.rows.map((r, ri) => (
                <View key={ri} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.border }}>
                  {widths.map((w, ci) => (
                    <View key={ci} style={{ width: w, padding: 10, borderRightWidth: ci < widths.length - 1 ? 1 : 0, borderRightColor: c.border }}>
                      <Txt variant="body" size={13.5 * Math.min(s, 1.3)}>
                        {r[ci] ?? ''}
                      </Txt>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      );
    }
    case 'related':
      return <RelatedBlock ids={b.articleIds} />;
    case 'ad_slot':
      // editors place web slot names in the body; the apps use their own placement (configured in Dashboard → Advertising)
      return <AdCard placement={b.slot.startsWith('web_article_inline') ? 'app_article_inline_1' : b.slot} width={ctx.width} />;
    case 'newsletter_prompt':
      return <NewsletterPromo width={ctx.width} />;
    default:
      return null;
  }
}

function ImageBlock({ image, width }: { image: ImageRef; width: number }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Tap onPress={() => setOpen(true)} pressScale={0.99} accessibilityRole="imagebutton" accessibilityLabel={`${image.alt}. Double-tap to view full screen.`}>
        <ArticleImage image={image} width={width} radius={6} accessible={false} />
      </Tap>
      {image.caption || image.credit ? (
        <Text style={{ fontFamily: fonts.ui400, fontSize: 13, lineHeight: 18, color: c.textMuted }} allowFontScaling maxFontSizeMultiplier={1.8}>
          {image.caption}
          {image.credit ? <Text style={{ fontFamily: fonts.ui500 }}>{image.caption ? '  ' : ''}{image.credit}</Text> : null}
        </Text>
      ) : null}
      {open ? <Lightbox image={image} visible={open} onClose={() => setOpen(false)} /> : null}
    </View>
  );
}

/** Swipeable photo gallery: one photo per page, "2 / 8" counter, tap a photo for the full-screen viewer. */
function GalleryBlock({ images, caption, width }: { images: ImageRef[]; caption?: string; width: number }) {
  const { c } = useTheme();
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const current = images[index];
  return (
    <View style={{ gap: 8 }} accessibilityLabel={caption ? `Gallery: ${caption}. ${images.length} photos` : `Photo gallery, ${images.length} photos`} testID="gallery">
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(img, i) => `${img.id}-${i}`}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.max(0, Math.min(images.length - 1, Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)))))}
        style={{ width, borderRadius: 6, overflow: 'hidden', backgroundColor: '#0B1324' }}
        renderItem={({ item, index: i }) => (
          <Tap onPress={() => setOpen(i)} pressScale={0.99} accessibilityRole="imagebutton" accessibilityLabel={`Photo ${i + 1} of ${images.length}: ${item.alt}. Double-tap to view full screen.`}>
            <ArticleImage image={item} width={width} ratio={3 / 2} accessible={false} />
          </Tap>
        )}
      />
      <Text style={{ fontFamily: fonts.ui400, fontSize: 13, lineHeight: 18, color: c.textMuted }} allowFontScaling maxFontSizeMultiplier={1.8}>
        <Text style={{ fontFamily: fonts.ui700, color: c.heading }}>{index + 1} / {images.length}</Text>
        {current?.caption ? `  ${current.caption}` : ''}
        {current?.credit ? <Text style={{ fontFamily: fonts.ui500 }}>{'  '}{current.credit}</Text> : null}
      </Text>
      {caption ? <Txt variant="uiBold" size={14} color={c.heading}>{caption}</Txt> : null}
      {open !== null && images[open] ? <Lightbox image={images[open]!} visible onClose={() => setOpen(null)} /> : null}
    </View>
  );
}

function RelatedBlock({ ids }: { ids: string[] }) {
  const { c } = useTheme();
  const results = useQueries({ queries: ids.map((id) => ({ queryKey: ['article', id], queryFn: ({ signal }: { signal: AbortSignal }) => endpoints.article(id, signal), staleTime: 5 * 60_000 })) });
  const items = results.map((r) => r.data).filter((x): x is NonNullable<typeof x> => !!x);
  if (!items.length) return null;
  return (
    <View style={{ borderTopWidth: 3, borderTopColor: c.heading, paddingTop: 10 }}>
      <Txt variant="kicker" size={12} color={c.heading} accessibilityRole="header">
        Related
      </Txt>
      {items.map((a, i) => (
        <StoryRow key={a.id} a={a} divider={i < items.length - 1} />
      ))}
    </View>
  );
}
