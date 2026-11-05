/**
 * Pure helpers for the native article renderer (unit-tested).
 * The renderer components live in src/components/article/; everything decidable without React is here.
 */
import type { Block, EmbedProvider, ImageRef, Inline, Mark, VideoProvider } from '../types';
import { parseLink, type LinkTarget, type ParseOptions } from './deeplink';

/** Text style flags for a run of inline text. */
export interface MarkStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  superscript: boolean;
  subscript: boolean;
}

export function markStyle(marks: Mark[] | undefined): MarkStyle {
  const m = new Set(marks ?? []);
  return {
    bold: m.has('bold'),
    italic: m.has('italic'),
    underline: m.has('underline'),
    strike: m.has('strike'),
    code: m.has('code'),
    superscript: m.has('superscript'),
    subscript: m.has('subscript'),
  };
}

/** Plain text of inline children (linebreaks → "\n"). */
export function inlineText(children: Inline[]): string {
  return children.map((c) => (c.type === 'linebreak' ? '\n' : c.text)).join('');
}

/** Plain text of a block tree — used for accessibility summaries, share text and tests. */
export function blocksToPlainText(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'paragraph':
      case 'heading':
        out.push(inlineText(b.children));
        break;
      case 'quote':
        out.push(`“${inlineText(b.children)}”${b.attribution ? ` — ${b.attribution}` : ''}`);
        break;
      case 'list':
        b.items.forEach((it, i) => out.push(`${b.ordered ? `${i + 1}.` : '•'} ${inlineText(it)}`));
        break;
      case 'image':
        if (b.image.caption) out.push(b.image.caption);
        break;
      case 'gallery':
        if (b.caption) out.push(b.caption);
        b.images.forEach((i) => { if (i.caption) out.push(i.caption); });
        break;
      case 'table':
        if (b.caption) out.push(b.caption);
        out.push(b.header.join(' | '));
        b.rows.forEach((r) => out.push(r.join(' | ')));
        break;
      case 'video':
        out.push(b.title);
        break;
      default:
        break;
    }
  }
  return out.filter(Boolean).join('\n\n');
}

export type LinkAction =
  | { kind: 'article'; id: string }
  | { kind: 'in-app'; target: LinkTarget }
  | { kind: 'resolve'; path: string }
  | { kind: 'external'; url: string };

/**
 * Decide what tapping a link inside an article does:
 * - the editor marked it as an internal article (internalArticleId) → open in-app
 * - a goworld.news article URL → open in-app (id parsed from the URL)
 * - another goworld.news page → in-app screen, or GET /resolve for unknown paths
 * - anything else → in-app browser (expo-web-browser)
 */
export function linkAction(link: { href: string; internalArticleId?: string }, opts: ParseOptions): LinkAction {
  if (link.internalArticleId && /^[0-9a-hjkmnp-tv-z]{10}$/.test(link.internalArticleId)) return { kind: 'article', id: link.internalArticleId };
  const t = parseLink(link.href, opts);
  if (!t) return { kind: 'external', url: link.href };
  if (t.kind === 'article') return { kind: 'article', id: t.id };
  if (t.kind === 'external') return { kind: 'external', url: t.url };
  if (t.kind === 'resolve') return { kind: 'resolve', path: t.path };
  if (t.kind === 'auth') return { kind: 'external', url: link.href }; // never act on auth links found in content
  return { kind: 'in-app', target: t };
}

/** Pick the smallest variant at least `targetPx` wide (prefers webp/jpeg; avif support varies on Android). */
export function pickImageUrl(image: Pick<ImageRef, 'url' | 'width' | 'variants'>, targetPx: number): string {
  const variants = (image.variants ?? []).filter((v) => v.format !== 'avif').sort((a, b) => a.width - b.width);
  if (!variants.length) return image.url;
  const fit = variants.find((v) => v.width >= targetPx);
  if (fit) return fit.url;
  // nothing big enough: the original is the best quality available
  return image.width > variants[variants.length - 1].width ? image.url : variants[variants.length - 1].url;
}

export function aspectRatio(image: Pick<ImageRef, 'width' | 'height'> | undefined, fallback = 16 / 9) {
  if (!image || !image.width || !image.height) return fallback;
  const r = image.width / image.height;
  // clamp extreme panoramas / tall images so layout stays readable
  return Math.min(Math.max(r, 0.6), 2.4);
}

export type VideoSource =
  | { kind: 'file'; url: string }
  | { kind: 'external'; url: string; provider: VideoProvider; label: string }
  | { kind: 'unavailable' };

/** `provider:'file'` (and HLS `stream` with a URL) play natively; YouTube/Vimeo open externally. */
export function videoSource(v: { provider: VideoProvider; videoId?: string; id?: string; url?: string }): VideoSource {
  const id = v.videoId ?? v.id ?? '';
  switch (v.provider) {
    case 'file':
      return v.url ? { kind: 'file', url: v.url } : { kind: 'unavailable' };
    case 'stream':
      return v.url ? { kind: 'file', url: v.url } : { kind: 'unavailable' };
    case 'youtube':
      return { kind: 'external', provider: 'youtube', label: 'Watch on YouTube', url: v.url ?? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` };
    case 'vimeo':
      return { kind: 'external', provider: 'vimeo', label: 'Watch on Vimeo', url: v.url ?? `https://vimeo.com/${encodeURIComponent(id)}` };
    default:
      return { kind: 'unavailable' };
  }
}

const EMBED_LABELS: Record<EmbedProvider, string> = {
  x: 'Post on X',
  facebook: 'Facebook post',
  instagram: 'Instagram post',
  tiktok: 'TikTok video',
  datawrapper: 'Interactive chart',
  iframe: 'Embedded content',
};
export function embedLabel(provider: EmbedProvider) {
  return EMBED_LABELS[provider] ?? 'Embedded content';
}
export function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Column widths (pt) for a horizontally scrolling table, from the longest cell per column. */
export function tableColumnWidths(header: string[], rows: string[][], opts = { min: 96, max: 260, charWidth: 8.2, padding: 24 }) {
  const cols = Math.max(header.length, ...rows.map((r) => r.length), 0);
  const widths: number[] = [];
  for (let c = 0; c < cols; c++) {
    const longest = Math.max((header[c] ?? '').length * 1.1, ...rows.map((r) => (r[c] ?? '').length));
    widths.push(Math.round(Math.min(opts.max, Math.max(opts.min, longest * opts.charWidth + opts.padding))));
  }
  return widths;
}

export function listMarker(ordered: boolean, index: number) {
  return ordered ? `${index + 1}.` : '•';
}

/** Heading sizes (pt) before text scaling — mirrors the web type scale, tuned for phones. */
export function headingSize(level: 2 | 3 | 4) {
  return level === 2 ? 24 : level === 3 ? 21 : 19;
}

/** All related-article ids referenced in the body (deduplicated, in order, max 8). */
export function relatedIds(blocks: Block[]): string[] {
  const seen = new Set<string>();
  for (const b of blocks) if (b.type === 'related') b.articleIds.forEach((id) => seen.add(id));
  return Array.from(seen).slice(0, 8);
}

/** Live feed helpers live in ./live (re-exported here for existing callers). */
export { countNewUpdates, mergeLiveUpdates, newestUpdateAt } from './live';
