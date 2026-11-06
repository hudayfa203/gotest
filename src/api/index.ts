/**
 * The app's API instance + typed endpoint functions (docs/API.md).
 * Device credential and reader session token are kept in SecureStore and cached in memory.
 */
import * as Localization from 'expo-localization';
import { APP_VERSION, getApiUrl, IS_WEB_PREVIEW, isDemoMode, PLATFORM } from '../config';
import { secure, SECURE_KEYS } from '../storage/secure';
import type {
  AdResponse, AnalyticsEvent, AppConfig, Article, ArticlePage, ArticleSummary, Author, BreakingAlert, Bookmark, Category, Homepage,
  LiveArchivePage, LiveFeed, LiveHub, NavItem, NumberedPage, PodcastEpisode, PushPreferences, ResolveResult, SyncChanges, TagRef,
} from '../types';
import { createApiClient, isNetworkError } from './client';

let deviceToken: string | null | undefined; // undefined = not loaded yet
let sessionToken: string | null | undefined;
let registering: Promise<string | null> | null = null;
const sessionListeners = new Set<(signedIn: boolean) => void>();

export async function getDeviceToken() {
  if (deviceToken === undefined) deviceToken = await secure.get(SECURE_KEYS.deviceToken).catch(() => null);
  return deviceToken;
}
export async function getSessionToken() {
  if (sessionToken === undefined) sessionToken = await secure.get(SECURE_KEYS.sessionToken).catch(() => null);
  return sessionToken;
}
export async function setSessionToken(token: string | null) {
  sessionToken = token;
  if (token) await secure.set(SECURE_KEYS.sessionToken, token);
  else await secure.remove(SECURE_KEYS.sessionToken);
  sessionListeners.forEach((l) => l(!!token));
}
/**
 * Forget the device credential and reader session (they belong to one server). Used when a tester switches
 * servers in a test build; the app registers again with the new server on the next request that needs it.
 */
export async function resetServerCredentials() {
  deviceToken = undefined;
  await secure.remove(SECURE_KEYS.deviceToken).catch(() => {});
  await setSessionToken(null).catch(() => {});
}
export function onSessionChange(l: (signedIn: boolean) => void) {
  sessionListeners.add(l);
  return () => {
    sessionListeners.delete(l);
  };
}

function deviceInfo() {
  let locale: string | undefined;
  let timezone: string | undefined;
  try {
    locale = Localization.getLocales()[0]?.languageTag;
    timezone = Localization.getCalendars()[0]?.timeZone ?? undefined;
  } catch {
    /* optional */
  }
  return { platform: PLATFORM, appVersion: APP_VERSION, locale: locale?.slice(0, 20), timezone: timezone?.slice(0, 60) };
}

/** POST /devices once per install; the credential is stored in the keychain. Safe to call repeatedly. */
export async function registerDevice(force = false): Promise<string | null> {
  // the web preview is not an app install (and POST /devices is not CORS-enabled); demo stories need no server identity
  if (IS_WEB_PREVIEW || isDemoMode()) return null;
  if (!force) {
    const existing = await getDeviceToken();
    if (existing) return existing;
  }
  if (registering) return registering;
  registering = (async () => {
    try {
      const r = await api.request<{ deviceId: string; deviceToken: string }>('/devices', { method: 'POST', body: deviceInfo() });
      deviceToken = r.deviceToken;
      await secure.set(SECURE_KEYS.deviceToken, r.deviceToken);
      return r.deviceToken;
    } catch (e) {
      if (!isNetworkError(e)) console.warn('[device] registration failed', e);
      return null;
    } finally {
      registering = null;
    }
  })();
  return registering;
}

// Test builds with built-in demo stories: while they are selected, requests are answered by src/demo instead of the
// network. The require is compiled out of builds without demo content (EXPO_PUBLIC_DEMO_CONTENT unset).
const demo: typeof import('../demo') | null =
  process.env.EXPO_PUBLIC_DEMO_CONTENT === 'default' || process.env.EXPO_PUBLIC_DEMO_CONTENT === 'available' ? require('../demo') : null;
const appFetch: typeof fetch = (input, init) =>
  demo && isDemoMode() ? demo.demoFetch(String(input), init as { method?: string }) : fetch(input, init);

export const api = createApiClient({
  baseUrl: getApiUrl,
  fetch: appFetch,
  getDeviceToken,
  getSessionToken,
  onDeviceUnauthorized: () => registerDevice(true),
});

// ---------------------------------------------------------------- content (public, cacheable)
export const endpoints = {
  home: (signal?: AbortSignal) => api.request<Homepage>('/home', { signal }),
  articles: (q: { category?: string; tag?: string; author?: string; type?: string; label?: string; cursor?: string | null; pageSize?: number }, signal?: AbortSignal) =>
    api.request<ArticlePage>('/articles', { query: { pageSize: 20, ...q }, signal }),
  article: (id: string, signal?: AbortSignal) => api.request<Article>(`/articles/${encodeURIComponent(id)}`, { signal }),
  // live coverage (separate from breaking alerts): hub, completed-coverage archive, one coverage + incremental refresh
  liveHub: (signal?: AbortSignal) => api.request<LiveHub>('/live', { signal }),
  liveArchive: (cursor?: string | null, signal?: AbortSignal) => api.request<LiveArchivePage>('/live/archive', { query: { cursor, pageSize: 20 }, signal }),
  liveFeed: (id: string, since?: string | null, signal?: AbortSignal) => api.request<LiveFeed>(`/live/${encodeURIComponent(id)}`, { query: { since }, signal }),
  resolve: (path: string, signal?: AbortSignal) => api.request<ResolveResult>('/resolve', { query: { path }, signal }),
  alerts: (signal?: AbortSignal) => api.request<BreakingAlert[]>('/alerts', { signal }),
  // World Pulse: recent stories that carry a location (map on Home)
  pulse: (signal?: AbortSignal) => api.request<ArticleSummary[]>('/pulse', { signal }),
  categories: (signal?: AbortSignal) => api.request<Category[]>('/categories', { signal }),
  navigation: (menu: 'app_explore' | 'app_tabs' | 'web_main' | 'web_footer' | 'web_menu_top' | 'web_menu_news' | 'web_menu_features', signal?: AbortSignal) => api.request<NavItem[]>('/navigation', { query: { menu }, signal }),
  author: (slug: string, cursor?: string | null, signal?: AbortSignal) =>
    api.request<{ author: Author; articles: NumberedPage }>(`/authors/${encodeURIComponent(slug)}`, { query: { cursor }, signal }),
  tag: (slug: string, cursor?: string | null, signal?: AbortSignal) =>
    api.request<{ tag: TagRef; articles: NumberedPage }>(`/tags/${encodeURIComponent(slug)}`, { query: { cursor }, signal }),
  search: (q: { q: string; category?: string; author?: string; tag?: string; type?: string; from?: string; to?: string; sort?: 'relevance' | 'newest'; page?: number; pageSize?: number }, signal?: AbortSignal) =>
    api.request<NumberedPage>('/search', { query: { pageSize: 20, ...q }, signal }),
  podcasts: (series?: string, signal?: AbortSignal) => api.request<PodcastEpisode[]>('/podcasts', { query: { series }, signal }),
  config: (signal?: AbortSignal) => api.request<AppConfig>('/config', { signal }),
  ads: (placement: string, signal?: AbortSignal) => api.request<AdResponse>('/ads', { query: { placement }, signal }),
  // ad impressions/clicks are only counted from the native apps, never from the web preview
  adEvent: async (b: { campaignId: string; placement: string; kind: 'impression' | 'click' }) => (IS_WEB_PREVIEW ? undefined : api.request<void>('/ads/event', { method: 'POST', body: b })),
  sync: (cursor: string, limit = 200) => api.request<SyncChanges>('/sync', { query: { cursor, limit } }),

  // ---------------------------------------------------------------- devices & notifications (X-Device-Token)
  getPreferences: () => api.request<PushPreferences>('/devices/me/preferences', { auth: 'device' }),
  putPreferences: (b: Partial<PushPreferences> & { pushToken?: string | null }) =>
    api.request<PushPreferences>('/devices/me/preferences', { method: 'PUT', body: b, auth: 'device' }),
  pushOpened: (b: { campaignId: string; articleId?: string; platform: 'ios' | 'android' }) =>
    api.request<void>('/push/opened', { method: 'POST', body: b, auth: 'device' }),

  // ---------------------------------------------------------------- reader accounts (Bearer session)
  newsletterSubscribe: (email: string, lists: string[]) =>
    api.request<{ ok: boolean; status: 'confirmation_sent' | 'already_subscribed'; emailDelivered: boolean }>('/newsletter/subscribe', { method: 'POST', body: { email, lists, consent: true, source: 'app' } }),
  authRequest: (email: string) => api.request<{ ok: boolean; emailDelivered: boolean; devNote?: string }>('/auth/request', { method: 'POST', body: { email, app: true } }),
  authVerify: (token: string) => api.request<{ sessionToken: string }>('/auth/verify', { method: 'POST', body: { token, app: true }, auth: 'device' }),
  logout: () => api.request<void>('/auth/logout', { method: 'POST', auth: 'reader' }),
  me: () => api.request<{ signedIn: boolean }>('/me', { auth: 'reader' }),
  deleteMe: () => api.request<void>('/me', { method: 'DELETE', auth: 'reader' }),
  bookmarks: () => api.request<Bookmark[]>('/me/bookmarks', { auth: 'reader' }),
  addBookmark: (id: string) => api.request<void>(`/me/bookmarks/${encodeURIComponent(id)}`, { method: 'PUT', auth: 'reader' }),
  removeBookmark: (id: string) => api.request<void>(`/me/bookmarks/${encodeURIComponent(id)}`, { method: 'DELETE', auth: 'reader' }),

  // ---------------------------------------------------------------- analytics
  events: (events: AnalyticsEvent[]) => api.request<{ accepted: number }>('/events', { method: 'POST', body: { events } }),
};
