/**
 * App start + foreground work (rendered once inside the root layout):
 * register the device once, run explicit sync, merge bookmarks when signed in, start analytics,
 * configure notifications and route notification taps to articles.
 */
import { router, useRootNavigationState, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { endpoints, getSessionToken, registerDevice } from '../api';
import { PLATFORM } from '../config';
import { startAnalytics, track, flush } from '../lib/analytics';
import { isPublicId } from '../lib/deeplink';
import { openWebUrl } from '../lib/navigation';
import { configureNotificationHandling, subscribeToPushOpens, type PushOpen } from '../push/notifications';
import { mergeBookmarks } from './saved';
import { syncNow } from './syncRunner';

export function AppBootstrap() {
  const navReady = !!useRootNavigationState()?.key;
  const queued = useRef<PushOpen[]>([]);
  const navReadyRef = useRef(navReady);
  navReadyRef.current = navReady;

  // one-time start
  useEffect(() => {
    configureNotificationHandling();
    startAnalytics();
    void (async () => {
      await registerDevice();
      await syncNow();
      if (await getSessionToken()) await mergeBookmarks().catch(() => null);
    })();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void syncNow({ minIntervalMs: 60_000 });
      } else if (s === 'background') {
        void flush();
      }
    });
    return () => sub.remove();
  }, []);

  // notification taps (cold start + running)
  useEffect(() => {
    const handle = (o: PushOpen) => {
      if (!navReadyRef.current) {
        queued.current.push(o);
        return;
      }
      if (o.articleId && isPublicId(o.articleId)) router.push(`/article/${o.articleId}` as Href);
      else if (o.url) openWebUrl(o.url);
      if (o.campaignId && (PLATFORM === 'ios' || PLATFORM === 'android')) {
        // the server records push_open analytics for campaign pushes
        endpoints.pushOpened({ campaignId: o.campaignId, articleId: o.articleId, platform: PLATFORM }).catch(() => {});
      } else {
        track('push_open', { articleId: o.articleId });
      }
    };
    return subscribeToPushOpens(handle);
  }, []);

  useEffect(() => {
    if (!navReady || !queued.current.length) return;
    const items = queued.current.splice(0);
    // let the initial route mount first so "back" returns to the feed
    setTimeout(() => items.forEach((o) => {
      if (o.articleId && isPublicId(o.articleId)) router.push(`/article/${o.articleId}` as Href);
      else if (o.url) openWebUrl(o.url);
      if (o.campaignId && (PLATFORM === 'ios' || PLATFORM === 'android')) endpoints.pushOpened({ campaignId: o.campaignId, articleId: o.articleId, platform: PLATFORM }).catch(() => {});
      else track('push_open', { articleId: o.articleId });
    }), 50);
  }, [navReady]);

  return null;
}
