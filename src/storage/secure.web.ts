/**
 * WEB PREVIEW ONLY: browsers have no keychain, so the preview keeps tokens in localStorage.
 * Native builds use storage/secure.ts (expo-secure-store).
 */
const mem = new Map<string, string>();
const ls = (): Storage | null => {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
};
export const secure = {
  get: async (key: string) => ls()?.getItem(key) ?? mem.get(key) ?? null,
  set: async (key: string, value: string) => {
    const s = ls();
    if (s) s.setItem(key, value);
    else mem.set(key, value);
  },
  remove: async (key: string) => {
    ls()?.removeItem(key);
    mem.delete(key);
  },
};
export const SECURE_KEYS = { deviceToken: 'gw.deviceToken', sessionToken: 'gw.sessionToken' } as const;
