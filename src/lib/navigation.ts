/** Opening links: in-app routes, the in-app browser, mail, and GET /resolve for unknown website paths. */
import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';
import { APP_LINK_HOSTS } from '../config';
import { brand } from '../theme';
import { linkAction } from './blocks';
import { parseLink, routeForTarget, type LinkTarget } from './deeplink';

export const linkOpts = { hosts: APP_LINK_HOSTS };

export async function openExternal(url: string) {
  if (/^(mailto|tel):/i.test(url)) {
    await Linking.openURL(url).catch(() => {});
    return;
  }
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: brand.navy,
      controlsColor: '#FFFFFF',
      secondaryToolbarColor: brand.deepNavy,
      enableBarCollapsing: true,
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });
  } catch {
    await Linking.openURL(url).catch(() => {});
  }
}

export function openArticle(id: string) {
  router.push(`/article/${id}` as Href);
}

export function openTarget(t: LinkTarget) {
  if (t.kind === 'external') return void openExternal(t.url);
  router.push(routeForTarget(t) as Href);
}

/** Tap on a link inside article text. */
export function openArticleLink(link: { href: string; internalArticleId?: string }) {
  const a = linkAction(link, linkOpts);
  switch (a.kind) {
    case 'article':
      return openArticle(a.id);
    case 'external':
      return void openExternal(a.url);
    case 'resolve':
      return void router.push(`/link?path=${encodeURIComponent(a.path)}` as Href);
    case 'in-app':
      return openTarget(a.target);
  }
}

/** A website URL from the API (e.g. a homepage section's moreUrl) → in-app route when possible. */
export function openWebUrl(url: string) {
  const t = parseLink(url, linkOpts);
  if (!t) return void openExternal(url);
  openTarget(t);
}
