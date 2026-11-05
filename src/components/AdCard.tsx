import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { View, type HostInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '../api';
import { useAppConfig } from '../features/UpdateGate';
import { openExternal } from '../lib/navigation';
import { useTheme } from '../state/theme';
import type { Ad } from '../types';
import { ArticleImage } from './ArticleImage';
import { Icon } from './Icon';
import { Tap } from './Tap';
import { Txt } from './Txt';
import { useFeedWidth } from './cards';
import { useOnFirstVisible } from './Viewport';

/**
 * App ad placements (managed in the dashboard → Ads; each campaign targets placements by key):
 *   app_home_top        Home, under the lead story            banner 320×100
 *   app_feed_3          Home, mid-feed                         banner / 300×250
 *   app_feed_6          Home, lower feed                       300×250
 *   app_list_inline     Latest / sections, between stories     300×250 / banner
 *   app_article_inline_1  inside the article text              300×250
 *   app_article_end     below the article                      300×250
 *   app_article_sticky  anchored strip at the bottom of articles  320×50
 */
export type AppPlacement = 'app_home_top' | 'app_feed_3' | 'app_feed_6' | 'app_list_inline' | 'app_article_inline_1' | 'app_article_end' | 'app_article_sticky' | (string & {});

function useAd(placement: string) {
  const config = useAppConfig();
  const enabled = config.data?.adsEnabled !== false;
  const q = useQuery({ queryKey: ['ad', placement], queryFn: ({ signal }) => endpoints.ads(placement, signal), staleTime: 5 * 60_000, enabled });
  return enabled ? (q.data?.ad ?? null) : null;
}

function click(ad: Ad, placement: string) {
  endpoints.adEvent({ campaignId: ad.campaignId, placement, kind: 'click' }).catch(() => {});
  void openExternal(ad.clickUrl);
}

/**
 * Ad unit for a placement (GET /ads). Always labelled "Advertisement" (or "Sponsored"). The layout follows the
 * creative: wide banners show the image alone, box creatives (300×250) show image + text. Impression once ≥50% is on
 * screen; click when tapped. Renders nothing when no campaign runs there — never a placeholder.
 */
export function AdCard({ placement, width, framed = true }: { placement: AppPlacement; width?: number; framed?: boolean }) {
  const { c } = useTheme();
  const { content } = useFeedWidth();
  const ref = useRef<HostInstance>(null);
  const ad = useAd(placement);
  useOnFirstVisible(
    ref,
    () => {
      if (ad) endpoints.adEvent({ campaignId: ad.campaignId, placement, kind: 'impression' }).catch(() => {});
    },
    !!ad,
  );
  if (!ad || (!ad.image && !ad.headline)) return null;
  const label = ad.sponsored ? 'Sponsored' : 'Advertisement';
  const ratio = ad.image ? ad.image.width / ad.image.height : 0;
  const box = ad.image ? ratio < 2 : false; // 300×250-style creative
  const maxW = width ?? content;
  const w = box ? Math.min(maxW, 336) : maxW;
  return (
    <View ref={ref} collapsable={false} style={{ alignSelf: 'center', width: framed ? maxW : w, paddingVertical: framed ? 4 : 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        <Txt variant="kicker" size={11} muted accessibilityRole="text">
          {label}
        </Txt>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </View>
      <Tap
        accessibilityRole="link"
        accessibilityLabel={`${label} from ${ad.advertiser}. ${ad.headline ?? ad.image?.alt ?? ''}. Opens in browser.`}
        onPress={() => click(ad, placement)}
        pressScale={0.985}
        style={{ width: w, alignSelf: 'center', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised }}
      >
        {ad.image ? <ArticleImage image={ad.image} width={w - 2} ratio={ratio} accessible={false} /> : null}
        {ad.headline || ad.text ? (
          <View style={{ padding: 12, gap: 4 }}>
            {ad.headline ? (
              <Txt variant="headline" size={15.5} lineHeight={20}>
                {ad.headline}
              </Txt>
            ) : null}
            {ad.text ? (
              <Txt variant="body" size={13.5} lineHeight={19} muted numberOfLines={3}>
                {ad.text}
              </Txt>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <Txt variant="ui" size={11.5} muted numberOfLines={1} style={{ flexShrink: 1 }}>
                {ad.advertiser}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Txt variant="uiBold" size={13} color={c.link}>
                  Learn more
                </Txt>
                <Icon name="external" size={14} color={c.link} />
              </View>
            </View>
          </View>
        ) : null}
      </Tap>
      {!box && ad.image && !(ad.headline || ad.text) ? (
        <Txt variant="ui" size={11} muted style={{ marginTop: 6, textAlign: 'right' }} numberOfLines={1}>
          {ad.advertiser}
        </Txt>
      ) : null}
    </View>
  );
}

let anchorDismissed = false;

/** Anchored strip at the bottom of article screens (app_article_sticky). Closable for the rest of the session. */
export function AnchorAd({ placement = 'app_article_sticky' }: { placement?: AppPlacement }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { full } = useFeedWidth(0);
  const ref = useRef<HostInstance>(null);
  const [closed, setClosed] = useState(anchorDismissed);
  const ad = useAd(placement);
  useOnFirstVisible(
    ref,
    () => {
      if (ad) endpoints.adEvent({ campaignId: ad.campaignId, placement, kind: 'impression' }).catch(() => {});
    },
    !!ad && !closed,
  );
  if (!ad?.image || closed) return null;
  const ratio = ad.image.width / ad.image.height;
  const w = Math.min(full - 64, 468);
  const h = Math.round(w / ratio);
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 6, paddingTop: 6, backgroundColor: c.surfaceRaised, borderTopWidth: 1, borderTopColor: c.border, alignItems: 'center', zIndex: 30 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt variant="kicker" size={10} muted style={{ width: 22, textAlign: 'center' }} accessibilityLabel={ad.sponsored ? 'Sponsored' : 'Advertisement'}>
          Ad
        </Txt>
        <Tap onPress={() => click(ad, placement)} accessibilityRole="link" accessibilityLabel={`Advertisement from ${ad.advertiser}. ${ad.image.alt ?? ad.headline ?? ''}. Opens in browser.`} style={{ borderRadius: 6, overflow: 'hidden' }}>
          <ArticleImage image={ad.image} width={w} ratio={ratio} accessible={false} />
        </Tap>
        <Tap
          onPress={() => {
            anchorDismissed = true;
            setClosed(true);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close advertisement"
          style={{ width: 22, height: Math.max(22, h), alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="close" size={16} color={c.textMuted} />
        </Tap>
      </View>
    </View>
  );
}

/** Height the anchored strip takes, so scroll content can end above it. */
export const ANCHOR_AD_SPACE = 76;
