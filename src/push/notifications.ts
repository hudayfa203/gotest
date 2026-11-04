/**
 * Push notifications (expo-notifications → Expo Push → APNs / FCM).
 *
 * Flow (Settings → Notifications): explain → ask permission → get the Expo push token
 * (needs the EAS projectId in production builds) → PUT /devices/me/preferences { pushToken, notificationsEnabled }.
 */
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { EAS_PROJECT_ID } from '../config';

export const BREAKING_CHANNEL_ID = 'breaking';
export const PUSH_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

/** Foreground presentation: show the banner and play the sound while the app is open. */
export function configureNotificationHandling() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(BREAKING_CHANNEL_ID, {
      name: 'Breaking news',
      description: 'Major breaking stories from GO World News',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#E1141E',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }).catch(() => {});
  }
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return p.canAskAgain === false || p.status === 'denied' ? 'denied' : 'undetermined';
}

export async function requestPermission(): Promise<PermissionState> {
  const p = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return p.granted ? 'granted' : p.canAskAgain === false ? 'denied' : 'undetermined';
}

export type TokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'no-project-id' | 'simulator' | 'unsupported' | 'error'; message: string };

/** Expo push token for this install. Fails gracefully with a reader-facing explanation. */
export async function getPushToken(): Promise<TokenResult> {
  if (!PUSH_SUPPORTED) return { ok: false, reason: 'unsupported', message: 'Push notifications are only available in the iPhone and Android apps.' };
  if (!Device.isDevice) return { ok: false, reason: 'simulator', message: 'Push notifications need a physical device (simulators and emulators cannot receive them).' };
  if (!EAS_PROJECT_ID) {
    return {
      ok: false,
      reason: 'no-project-id',
      message:
        'This build is not linked to an Expo (EAS) project yet, so it cannot receive push notifications. The app owner must run "eas init" and rebuild. Your notification choices are still saved.',
    };
  }
  try {
    const t = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    return { ok: true, token: t.data };
  } catch (e) {
    return { ok: false, reason: 'error', message: `Could not register for push notifications (${(e as Error)?.message ?? 'unknown error'}).` };
  }
}

export interface PushOpen {
  key: string;
  articleId?: string;
  campaignId?: string;
  url?: string;
}

function toOpen(r: Notifications.NotificationResponse | null | undefined): PushOpen | null {
  if (!r) return null;
  const data = (r.notification.request.content.data ?? {}) as Record<string, unknown>;
  return {
    key: r.notification.request.identifier,
    articleId: typeof data.articleId === 'string' ? data.articleId : undefined,
    campaignId: typeof data.campaignId === 'string' ? data.campaignId : undefined,
    url: typeof data.url === 'string' ? data.url : undefined,
  };
}

/** Taps on notifications: cold start (last response) + while running. */
export function subscribeToPushOpens(handler: (open: PushOpen) => void) {
  const seen = new Set<string>();
  const emit = (o: PushOpen | null) => {
    if (!o || seen.has(o.key)) return;
    seen.add(o.key);
    handler(o);
  };
  Notifications.getLastNotificationResponseAsync()
    .then((r) => {
      if (r && r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) emit(toOpen(r));
      return Notifications.clearLastNotificationResponseAsync?.();
    })
    .catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener((r) => emit(toOpen(r)));
  return () => sub.remove();
}
