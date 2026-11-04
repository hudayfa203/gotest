/** Secrets (device credential, reader session) live in the iOS Keychain / Android Keystore. */
import * as SecureStore from 'expo-secure-store';

const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

export const secure = {
  get: (key: string) => SecureStore.getItemAsync(key, OPTS),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value, OPTS),
  remove: (key: string) => SecureStore.deleteItemAsync(key, OPTS),
};
export const SECURE_KEYS = { deviceToken: 'gw.deviceToken', sessionToken: 'gw.sessionToken' } as const;
