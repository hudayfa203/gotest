import { View } from 'react-native';
import { getSiteUrl } from '../config';
import { openExternal } from '../lib/navigation';
import { Icon } from './Icon';
import { Tap } from './Tap';
import { Txt } from './Txt';

/** Newsletter promo → opens the website's double opt-in signup page (/newsletters) in the in-app browser. */
export function NewsletterPromo({ title, width }: { title?: string; width: number }) {
  return (
    <View style={{ width, alignSelf: 'center', backgroundColor: '#0B2A5E', borderRadius: 16, padding: 18, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: -56, top: -56, width: 132, height: 132, borderRadius: 66, borderWidth: 11, borderColor: '#E1141E', opacity: 0.85 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="mail" size={18} color="#FFFFFF" />
        </View>
        <Txt variant="kicker" size={11} color="#8CC8FF">
          Newsletters
        </Txt>
      </View>
      <Txt variant="headline" size={21} lineHeight={26} color="#FFFFFF" style={{ maxWidth: '78%' }}>
        {title || 'Get the World Briefing'}
      </Txt>
      <Txt variant="body" size={14} lineHeight={20} color="rgba(255,255,255,0.82)" style={{ marginTop: 6, maxWidth: '90%' }}>
        Choose daily, weekly or breaking-news emails. Sign-up opens on goworld.news and needs email confirmation.
      </Txt>
      <Tap
        haptics
        accessibilityRole="link"
        accessibilityLabel="Sign up for newsletters. Opens goworld.news in an in-app browser."
        onPress={() => void openExternal(`${getSiteUrl()}/newsletters`)}
        style={{ marginTop: 14, alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 18, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}
      >
        <Txt variant="uiBold" size={14} color="#0B2A5E">
          Sign up
        </Txt>
        <Icon name="external" size={16} color="#0B2A5E" />
      </Tap>
    </View>
  );
}
