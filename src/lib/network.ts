/** Connectivity (NetInfo on iOS/Android). */
import NetInfo, { useNetInfo } from '@react-native-community/netinfo';

export function subscribeNetwork(cb: (online: boolean) => void) {
  return NetInfo.addEventListener((s) => cb(s.isConnected !== false && s.isInternetReachable !== false));
}

export function useIsOffline() {
  const n = useNetInfo();
  return n.isConnected === false || n.isInternetReachable === false;
}
