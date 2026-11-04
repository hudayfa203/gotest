import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Icon } from './Icon';
import { Txt } from './Txt';
import { useIsOffline } from '../lib/network';

export { useIsOffline } from '../lib/network';

/** Shown at the top of feeds when the device has no connection; saved articles still open. */
export function OfflineBanner() {
  const offline = useIsOffline();
  if (!offline) return null;
  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(180)}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#22385E', paddingHorizontal: 16, paddingVertical: 9 }}
    >
      <Icon name="offline" size={16} color="#FFFFFF" />
      <Txt variant="uiStrong" size={13} color="#FFFFFF" style={{ flex: 1 }}>
        You’re offline. Showing saved and recently loaded stories.
      </Txt>
    </Animated.View>
  );
}
