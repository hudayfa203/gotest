import type { AppPlacement } from '../../components/AdCard';
import type { HomepageSection } from '../../types';

export type Row =
  | { key: string; kind: 'section'; s: HomepageSection }
  | { key: string; kind: 'ad'; placement: AppPlacement }
  | { key: string; kind: 'pulse' };

/** Home feed rows: dashboard sections, World Pulse after the Latest timeline, and the app ad slots. */
export function buildHomeRows(sections: HomepageSection[], adsOn: boolean): Row[] {
  const visible = sections.filter((s) => s.items.length > 0 || s.layout === 'newsletter' || s.layout === 'ad');
  const out: Row[] = [];
  let editorAds = 0;
  visible.forEach((s, i) => {
    if (s.layout === 'ad') {
      editorAds += 1;
      out.push({ key: `ad-${s.key}`, kind: 'ad', placement: editorAds === 1 ? 'app_feed_3' : 'app_feed_6' });
    } else out.push({ key: s.key, kind: 'section', s });
    if (s.layout === 'latest') out.push({ key: 'pulse', kind: 'pulse' });
    if (i === 0 && s.layout === 'lead') out.push({ key: 'ad-app_home_top', kind: 'ad', placement: 'app_home_top' });
  });
  if (!out.some((r) => r.kind === 'pulse') && out.length > 2) out.splice(3, 0, { key: 'pulse', kind: 'pulse' });
  // editors did not place ad sections → default mid-feed slots
  if (!visible.some((s) => s.layout === 'ad')) {
    const sectionsSeen = (n: number) => {
      let k = 0;
      return out.findIndex((r) => r.kind === 'section' && ++k === n);
    };
    const a = sectionsSeen(4);
    if (a > 0) out.splice(a + 1, 0, { key: 'ad-app_feed_3', kind: 'ad', placement: 'app_feed_3' });
    const b = sectionsSeen(8);
    if (b > 0) out.splice(b + 1, 0, { key: 'ad-app_feed_6', kind: 'ad', placement: 'app_feed_6' });
  }
  return adsOn ? out : out.filter((r) => r.kind !== 'ad');
}
