import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const ok = Platform.OS === 'ios' || Platform.OS === 'android';
export const haptic = {
  tap: () => ok && Haptics.selectionAsync().catch(() => {}),
  light: () => ok && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  success: () => ok && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => ok && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};
