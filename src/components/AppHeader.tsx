import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, usePathname, type Href } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { endpoints } from '../api';
import { haptic } from '../lib/haptics';
import { updateSettings } from '../state/settings';
import { useTheme } from '../state/theme';
import type { NavItem } from '../types';
import { IconButton } from './ScreenHeader';
import { Tap } from './Tap';
import { Txt } from './Txt';

export const MASTHEAD_H = 56;
export const SECTION_NAV_H = 44;

/** Light ⇄ dark, like the website's moon/sun button (an explicit choice overrides "System"). */
export function ThemeToggle({ color }: { color?: string }) {
  const { isDark } = useTheme();
  return (
    <IconButton
      icon={isDark ? 'sun' : 'moon'}
      label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      color={color}
      onPress={() => updateSettings({ appearance: isDark ? 'light' : 'dark' })}
    />
  );
}

export function openMenu() {
  haptic.tap();
  router.push('/menu' as Href);
}

/** Masthead as on goworld.news: menu, logo, search, light/dark. */
export function Masthead({ compactLogo = false }: { compactLogo?: boolean }) {
  const { isDark } = useTheme();
  return (
    <View style={{ height: MASTHEAD_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
      <IconButton icon="menu" label="Menu" onPress={openMenu} size={24} />
      <Tap onPress={() => router.navigate('/' as Href)} accessibilityRole="link" accessibilityLabel="GO World News, home" style={{ paddingHorizontal: 4, paddingVertical: 6 }}>
        <Image
          source={isDark ? require('../../assets/images/logo-oneline-reversed.png') : require('../../assets/images/logo-oneline.png')}
          style={{ width: compactLogo ? 150 : 172, height: compactLogo ? 23 : 27 }}
          contentFit="contain"
          accessible={false}
        />
      </Tap>
      <View style={{ flex: 1 }} />
      <IconButton icon="search" label="Search" onPress={() => router.push('/explore' as Href)} />
      <ThemeToggle />
    </View>
  );
}

/** Where a navigation entry goes inside the app. */
export function navRoute(href: string): string {
  const path = href.replace(/^https?:\/\/[^/]+/i, '').replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/latest' || path === '/live' || path === '/video' || path === '/saved') return path;
  if (path === '/podcasts') return '/video';
  const m = /^\/([a-z0-9-]+)$/.exec(path);
  return m ? `/section/${m[1]}` : `/link?path=${encodeURIComponent(path)}`;
}

export function useSectionNav() {
  return useQuery({ queryKey: ['navigation', 'app_explore'], queryFn: ({ signal }) => endpoints.navigation('app_explore', signal), staleTime: 30 * 60_000 });
}

/** The website's section bar: Top · Latest · World · Africa … — scrolls sideways, red underline on the current one. */
export function SectionNav({ active }: { active?: string }) {
  const { c } = useTheme();
  const nav = useSectionNav();
  const pathname = usePathname();
  const items: NavItem[] = [{ label: 'Top stories', href: '/' }, { label: 'Latest', href: '/latest' }, { label: 'Live', href: '/live' }, ...(nav.data ?? [])];
  const current = active ?? pathname;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 8, alignItems: 'stretch' }}
      style={{ height: SECTION_NAV_H, flexGrow: 0 }}
      accessibilityRole="tablist"
    >
      {items.map((it) => {
        const route = navRoute(it.href);
        const on = route === current;
        return (
          <Tap
            key={it.href + it.label}
            onPress={() => {
              if (on) return;
              haptic.tap();
              if (route === '/' || route === '/latest' || route === '/live' || route === '/video') router.navigate(route as Href);
              // moving between sections swaps the screen instead of stacking them
              else if (current.startsWith('/section/')) router.replace(route as Href);
              else router.push(route as Href);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={it.label}
            style={{ paddingHorizontal: 9, justifyContent: 'center' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {it.href === '/live' ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.live }} /> : null}
              <Txt variant={on ? 'uiBold' : 'uiStrong'} size={14.5} color={on ? c.heading : c.text} maxFontSizeMultiplier={1.3}>
                {it.label}
              </Txt>
            </View>
            <View style={{ position: 'absolute', left: 9, right: 9, bottom: 0, height: 3, backgroundColor: on ? '#E1141E' : 'transparent' }} />
          </Tap>
        );
      })}
    </ScrollView>
  );
}
