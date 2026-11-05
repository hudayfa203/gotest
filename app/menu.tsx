import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, Share, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { endpoints } from '../src/api';
import { navRoute, useSectionNav } from '../src/components/AppHeader';
import { Icon, type IconName } from '../src/components/Icon';
import { DemoBadge } from '../src/components/Labels';
import { LivePulse } from '../src/components/LivePulse';
import { RedBlock } from '../src/components/SectionHeader';
import { Tap } from '../src/components/Tap';
import { Txt } from '../src/components/Txt';
import { APP_VERSION, getSiteUrl } from '../src/config';
import { useAppConfig } from '../src/features/UpdateGate';
import { haptic } from '../src/lib/haptics';
import { openExternal } from '../src/lib/navigation';
import { updateSettings, useSettings, type Appearance } from '../src/state/settings';
import { useServer } from '../src/state/server';
import { useTheme } from '../src/state/theme';
import { fonts } from '../src/theme';
import type { Category } from '../src/types';

const DURATION = 230;

/**
 * Side menu (the website's drawer, adapted to the app): search, shortcuts, every section with its sub-sections,
 * appearance, settings and the publisher's pages. Sections come from the dashboard (Navigation → app menu, then
 * the category tree), so editors control it.
 */
export default function MenuScreen() {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelW = Math.min(360, Math.round(width * 0.88));
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) });
  }, [t]);
  const close = (then?: () => void) => {
    t.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) scheduleOnRN(finish, then);
    });
  };
  const finish = (then?: () => void) => {
    if (router.canGoBack()) router.back();
    if (then) setTimeout(then, 0);
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const go = (route: string, push = true) => close(() => (push ? router.push(route as Href) : router.navigate(route as Href)));

  const backdrop = useAnimatedStyle(() => ({ opacity: t.value * 0.55 }));
  const panel = useAnimatedStyle(() => ({ transform: [{ translateX: (t.value - 1) * (panelW + 20) }] }));

  const config = useAppConfig();
  const nav = useSectionNav();
  const cats = useQuery({ queryKey: ['categories'], queryFn: ({ signal }) => endpoints.categories(signal), staleTime: 30 * 60_000 });
  const home = useQuery({ queryKey: ['home'], queryFn: ({ signal }) => endpoints.home(signal), staleTime: 60_000 });
  const liveCount = home.data?.liveNow?.filter((l) => l.state === 'live').length ?? 0;
  const appearance = useSettings((s) => s.appearance);
  const demo = useServer((s) => s.demo);

  // section tree: the app menu order from the dashboard, each with its sub-sections from the category tree
  const children = (slug: string) => (cats.data ?? []).filter((x: Category) => x.parentSlug === slug);
  const sections = (nav.data?.length ? nav.data.map((n) => ({ label: n.label, route: navRoute(n.href), slug: /^\/section\/(.+)$/.exec(navRoute(n.href))?.[1] })) : (cats.data ?? []).filter((x) => !x.parentSlug).map((x) => ({ label: x.name, route: `/section/${x.slug}`, slug: x.slug })))
    // sub-sections already listed under their parent are not repeated at the top level
    .filter((s, _i, all) => !(s.slug && (cats.data ?? []).some((x) => x.slug === s.slug && x.parentSlug && all.some((p) => p.slug === x.parentSlug))));

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#020814' }, backdrop]}>
        <Pressable style={{ flex: 1 }} onPress={() => close()} accessibilityRole="button" accessibilityLabel="Close menu" />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: panelW, backgroundColor: c.bg, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, elevation: 16 }, panel]}
      >
        <View style={{ paddingTop: insets.top, backgroundColor: '#061A40' }}>
          <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 6 }}>
            <Image source={require('../assets/images/logo-oneline-reversed.png')} style={{ width: 168, height: 26 }} contentFit="contain" accessibilityLabel="GO World News" />
            <View style={{ flex: 1 }} />
            <Tap onPress={() => close()} accessibilityLabel="Close menu" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={24} color="#FFFFFF" />
            </Tap>
          </View>
          <Txt variant="ui" size={12.5} color="rgba(255,255,255,0.7)" style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
            {today}
          </Txt>
          <View style={{ height: 3, backgroundColor: '#E1141E' }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
          <Tap
            onPress={() => go('/explore')}
            accessibilityRole="search"
            accessibilityLabel="Search stories"
            style={{ margin: 16, marginBottom: 6, minHeight: 48, borderRadius: 999, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 }}
          >
            <Icon name="search" size={19} color={c.textMuted} />
            <Txt variant="ui" size={15} muted>
              Search stories, places, people
            </Txt>
          </Tap>

          {liveCount > 0 ? (
            <Tap onPress={() => go('/live', false)} accessibilityLabel={`Live now: ${liveCount} live ${liveCount === 1 ? 'coverage' : 'coverages'}`} style={{ marginHorizontal: 16, marginTop: 10, backgroundColor: '#A00D15', borderRadius: 12, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
              <LivePulse color="#FFFFFF" size={9} />
              <View style={{ flex: 1 }}>
                <Txt variant="uiBold" size={14} color="#FFFFFF">
                  Live now
                </Txt>
                <Txt variant="ui" size={12.5} color="rgba(255,255,255,0.85)" numberOfLines={1}>
                  {liveCount} live {liveCount === 1 ? 'coverage' : 'coverages'} · {home.data?.liveNow?.[0]?.headline}
                </Txt>
              </View>
              <Icon name="chevron-right" size={18} color="#FFFFFF" />
            </Tap>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 10 }}>
            {(
              [
                ['Home', 'home', '/', false],
                ['Latest', 'latest', '/latest', false],
                ['Live', 'broadcast', '/live', false],
                ['Video', 'video', '/video', false],
                ['Podcasts', 'headphones', '/video', false],
                ['Saved', 'saved', '/saved', false],
              ] as [string, IconName, string, boolean][]
            ).map(([label, icon, route]) => (
              <View key={label} style={{ width: '33.33%', padding: 4 }}>
                <Tap onPress={() => go(route, false)} accessibilityLabel={label} style={{ alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: c.surface }}>
                  <Icon name={icon} size={22} color={icon === 'broadcast' ? c.live : c.heading} />
                  <Txt variant="uiStrong" size={12.5}>
                    {label}
                  </Txt>
                </Tap>
              </View>
            ))}
          </View>

          <Heading title="Sections" />
          {sections.map((s) => (
            <View key={s.route}>
              <MenuRow label={s.label} onPress={() => go(s.route)} strong />
              {s.slug
                ? children(s.slug).map((ch) => <MenuRow key={ch.slug} label={ch.name} onPress={() => go(`/section/${ch.slug}`)} indent />)
                : null}
            </View>
          ))}

          <Heading title="Your app" />
          <View style={{ marginHorizontal: 16, flexDirection: 'row', backgroundColor: c.surface, borderRadius: 999, padding: 4, marginBottom: 6 }} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
            {(
              [
                ['system', 'Auto'],
                ['light', 'Light'],
                ['dark', 'Dark'],
              ] as [Appearance, string][]
            ).map(([v, label]) => {
              const on = appearance === v;
              return (
                <Tap
                  key={v}
                  onPress={() => {
                    haptic.tap();
                    updateSettings({ appearance: v });
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{ flex: 1, minHeight: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? (isDark ? '#FFFFFF' : '#0B2A5E') : 'transparent' }}
                >
                  <Txt variant="uiBold" size={13} color={on ? (isDark ? '#061A40' : '#FFFFFF') : c.text}>
                    {label}
                  </Txt>
                </Tap>
              );
            })}
          </View>
          <MenuRow icon="bell" label="Notifications" onPress={() => go('/settings')} />
          <MenuRow icon="mail" label="Newsletters" onPress={() => close(() => void openExternal(`${getSiteUrl()}/newsletters`))} />
          <MenuRow icon="settings" label="Settings" onPress={() => go('/settings')} />
          {config.data?.storeUrls?.android || config.data?.storeUrls?.ios ? (
            <MenuRow
              icon="share"
              label="Share the app"
              onPress={() => {
                const links = [config.data?.storeUrls?.android ? `Android: ${config.data.storeUrls.android}` : null, config.data?.storeUrls?.ios ? `iPhone: ${config.data.storeUrls.ios}` : null].filter(Boolean).join('\n');
                void Share.share({ message: `GO World News — ${config.data?.tagline ?? 'Breaking News. Beyond Borders.'}\n${links}` }).catch(() => {});
              }}
            />
          ) : null}

          <Heading title="GO World News" />
          <MenuRow label="About us" onPress={() => go('/settings/page/about')} />
          <MenuRow label="Editorial standards" onPress={() => go('/settings/page/editorialStandards')} />
          <MenuRow label="Corrections" onPress={() => close(() => void openExternal(`${getSiteUrl()}/corrections`))} />
          <MenuRow label="Privacy policy" onPress={() => go('/settings/page/privacy')} />
          <MenuRow label="Terms of use" onPress={() => go('/settings/page/terms')} />
          {config.data?.tipsEmail ? <MenuRow label="Send us a news tip" onPress={() => void Linking.openURL(`mailto:${config.data!.tipsEmail}?subject=${encodeURIComponent('News tip')}`)} /> : null}
          {config.data?.contactEmail ? <MenuRow label="Advertise with us" onPress={() => void Linking.openURL(`mailto:${config.data!.contactEmail}?subject=${encodeURIComponent('Advertising on GO World News')}`)} /> : null}

          <View style={{ paddingHorizontal: 18, paddingTop: 22, gap: 6 }}>
            {demo ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <DemoBadge />
                <Txt variant="ui" size={12} muted style={{ flex: 1 }}>
                  Showing built-in demo stories
                </Txt>
              </View>
            ) : null}
            <Txt variant="ui" size={12} muted>
              {config.data?.tagline ?? 'Breaking News. Beyond Borders.'}
            </Txt>
            <Txt variant="ui" size={11.5} muted>
              Version {APP_VERSION}
            </Txt>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function Heading({ title }: { title: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 8 }}>
      <RedBlock w={18} h={10} />
      <Txt variant="display" size={17} color={c.heading} style={{ fontFamily: fonts.display900Italic }} accessibilityRole="header">
        {title}
      </Txt>
    </View>
  );
}

function MenuRow({ label, onPress, icon, strong, indent, right }: { label: string; onPress: () => void; icon?: IconName; strong?: boolean; indent?: boolean; right?: ReactNode }) {
  const { c } = useTheme();
  return (
    <Tap onPress={onPress} accessibilityRole="link" accessibilityLabel={label} pressScale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: indent ? 40 : 46, paddingLeft: indent ? 34 : 18, paddingRight: 14 }}>
      {icon ? <Icon name={icon} size={19} color={c.heading} /> : null}
      {indent ? <View style={{ width: 8, height: 2, backgroundColor: c.border, marginLeft: -16 }} /> : null}
      <Txt variant={strong ? 'uiBold' : 'ui'} size={indent ? 14 : 15.5} color={indent ? c.textMuted : c.text} style={{ flex: 1 }}>
        {label}
      </Txt>
      {right ?? <Icon name="chevron-right" size={16} color={c.textMuted} />}
    </Tap>
  );
}
