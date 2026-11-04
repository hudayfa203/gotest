import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_API_URL = 'https://goworld.news/api/v1';

function trimSlash(s: string) {
  return s.replace(/\/+$/, '');
}

/** API base the app was built with, e.g. https://goworld.news/api/v1 — EXPO_PUBLIC_API_URL (inlined at bundle time) wins over app.config extra. */
export const BUILD_API_URL = trimSlash(
  process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra?.apiUrl as string | undefined) || DEFAULT_API_URL,
);

/**
 * Test builds only (EXPO_PUBLIC_ALLOW_SERVER_OVERRIDE=1, set by the GitHub test-APK workflow): the tester can point the
 * installed app at another GO World News server from Settings → Server, without a rebuild. Store/Play builds never set
 * this flag, so a production install always talks to the server it was built for.
 */
export const ALLOW_SERVER_OVERRIDE = process.env.EXPO_PUBLIC_ALLOW_SERVER_OVERRIDE === '1';

/**
 * Built-in demo stories (src/demo) in test builds: EXPO_PUBLIC_DEMO_CONTENT = 'default' (shown until a server is
 * chosen in Settings → Content source), 'available' (selectable, not the default) or unset/'off' (store builds).
 */
const DEMO_ENV = process.env.EXPO_PUBLIC_DEMO_CONTENT;
export const DEMO_CONTENT: 'off' | 'available' | 'default' = DEMO_ENV === 'default' || DEMO_ENV === 'available' ? DEMO_ENV : 'off';

let demoActive = false;
/** true while the app shows the built-in demo stories instead of talking to a server */
export function isDemoMode() {
  return demoActive;
}
export function setDemoMode(on: boolean) {
  demoActive = DEMO_CONTENT !== 'off' && on;
}

let apiOverride: string | null = null;

/** Current API base: the tester's override (test builds) or the build-time server. Read per request. */
export function getApiUrl() {
  return apiOverride ?? BUILD_API_URL;
}
/** Website origin of the current server (…/api/v1 → origin). Used for newsletters, share fallbacks, etc. */
export function getSiteUrl() {
  return siteUrlFromApi(getApiUrl());
}
/** Low-level setter used by src/state/server.ts (validation + persistence live there). */
export function setApiOverride(url: string | null) {
  apiOverride = ALLOW_SERVER_OVERRIDE && url ? trimSlash(url) : null;
}
export function hasApiOverride() {
  return apiOverride !== null;
}

/** @deprecated build-time value; use getApiUrl() so a test-build server override is respected */
export const API_URL = BUILD_API_URL;
/** Website origin of the build-time server (deep-link host matching). Use getSiteUrl() for links you open. */
export const SITE_URL = siteUrlFromApi(BUILD_API_URL);

export function siteUrlFromApi(apiUrl: string) {
  return trimSlash(apiUrl).replace(/\/api\/v\d+$/, '');
}

/** Hosts whose article URLs open inside the app (production domain + the configured API's host). */
export const APP_LINK_HOSTS: string[] = Array.from(
  new Set(['goworld.news', 'www.goworld.news', safeHost(SITE_URL)].filter((h): h is string => !!h)),
);

function safeHost(u: string) {
  try {
    return new URL(u).host;
  } catch {
    return null;
  }
}

export const APP_VERSION: string = Constants.expoConfig?.version ?? '1.0.0';
export const EAS_PROJECT_ID: string | undefined =
  (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId ?? undefined;

export const PLATFORM: 'ios' | 'android' | 'web' = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
export const IS_WEB_PREVIEW = Platform.OS === 'web';
