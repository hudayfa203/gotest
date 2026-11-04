/**
 * WEB PREVIEW ONLY: the browser preview cannot receive APNs/FCM pushes.
 * Same exports as notifications.ts so screens render; every call explains the limitation.
 */
export const BREAKING_CHANNEL_ID = 'breaking';
export const PUSH_SUPPORTED = false;
export function configureNotificationHandling() {}
export type PermissionState = 'granted' | 'denied' | 'undetermined';
export async function getPermissionState(): Promise<PermissionState> {
  return 'undetermined';
}
export async function requestPermission(): Promise<PermissionState> {
  return 'undetermined';
}
export type TokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'no-project-id' | 'simulator' | 'unsupported' | 'error'; message: string };
export async function getPushToken(): Promise<TokenResult> {
  return { ok: false, reason: 'unsupported', message: 'Push notifications are only available in the iPhone and Android apps.' };
}
export interface PushOpen {
  key: string;
  articleId?: string;
  campaignId?: string;
  url?: string;
}
export function subscribeToPushOpens(_handler: (open: PushOpen) => void) {
  return () => {};
}
