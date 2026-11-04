import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { View, type HostInstance } from 'react-native';
import { endpoints } from '../api';
import { openExternal } from '../lib/navigation';
import { useTheme } from '../state/theme';
import { ArticleImage } from './ArticleImage';
import { Icon } from './Icon';
import { Tap } from './Tap';
import { Txt } from './Txt';
import { useFeedWidth } from './cards';
import { useOnFirstVisible } from './Viewport';

/**
 * Native ad unit for a placement (GET /ads). Always labelled "Advertisement" (or "Sponsored" for
 * sponsored campaigns). Impression is recorded once when ≥50% is on screen; click when tapped.
 * Renders nothing when there is no campaign — never a placeholder.
 */
export function AdCard({ placement, width }: { placement: string; width?: number }) {
  const { c } = useTheme();
  const { content } = useFeedWidth();
  const w = width ?? content;
  const ref = useRef<HostInstance>(null);
  const q = useQuery({ queryKey: ['ad', placement], queryFn: ({ signal }) => endpoints.ads(placement, signal), staleTime: 5 * 60_000 });
  const ad = q.data?.ad ?? null;
  useOnFirstVisible(
    ref,
    () => {
      if (ad) endpoints.adEvent({ campaignId: ad.campaignId, placement, kind: 'impression' }).catch(() => {});
    },
    !!ad,
  );
  if (!ad || (!ad.image && !ad.headline)) return null;
  const label = ad.sponsored ? 'Sponsored' : 'Advertisement';
  return (
    <View ref={ref} collapsable={false} style={{ width: w, alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Txt variant="kicker" size={10} muted accessibilityRole="text">
          {label}
        </Txt>
        <Txt variant="ui" size={11} muted numberOfLines={1} style={{ flexShrink: 1, marginLeft: 12 }}>
          {ad.advertiser}
        </Txt>
      </View>
      <Tap
        accessibilityRole="link"
        accessibilityLabel={`${label} from ${ad.advertiser}. ${ad.headline ?? ad.image?.alt ?? ''}. Opens in browser.`}
        onPress={() => {
          endpoints.adEvent({ campaignId: ad.campaignId, placement, kind: 'click' }).catch(() => {});
          void openExternal(ad.clickUrl);
        }}
        style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised }}
      >
        {ad.image ? <ArticleImage image={ad.image} width={w - 2} ratio={ad.image.width / ad.image.height} accessible={false} /> : null}
        {ad.headline || ad.text ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              {ad.headline ? (
                <Txt variant="title" size={15}>
                  {ad.headline}
                </Txt>
              ) : null}
              {ad.text ? (
                <Txt variant="body" size={13} muted numberOfLines={2}>
                  {ad.text}
                </Txt>
              ) : null}
            </View>
            <Icon name="external" size={18} color={c.textMuted} />
          </View>
        ) : null}
      </Tap>
    </View>
  );
}
