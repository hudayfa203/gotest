/**
 * WEB PREVIEW: browsers report connectivity through navigator.onLine + online/offline events
 * (NetInfo's web build only listens to navigator.connection changes in Chromium).
 */
import { useSyncExternalStore } from 'react';

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

function subscribe(cb: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

export function subscribeNetwork(cb: (online: boolean) => void) {
  return subscribe(() => cb(isOnline()));
}

export function useIsOffline() {
  return !useSyncExternalStore(subscribe, isOnline, () => true);
}
