import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Application from 'expo-application';
import { router, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, Switch, TextInput, View } from 'react-native';
import { endpoints, getSessionToken, onSessionChange, registerDevice, resetServerCredentials, setSessionToken } from '../../src/api';
import { clearAllCachedContent } from '../../src/api/queryClient';
import { describeError } from '../../src/api/client';
import { Icon, type IconName } from '../../src/components/Icon';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Button } from '../../src/components/StateViews';
import { Tap } from '../../src/components/Tap';
import { Txt } from '../../src/components/Txt';
import { ALLOW_SERVER_OVERRIDE, APP_VERSION, BUILD_API_URL, DEMO_CONTENT, getApiUrl, getSiteUrl, isDemoMode } from '../../src/config';
import { mergeBookmarks } from '../../src/features/saved';
import { useAppConfig } from '../../src/features/UpdateGate';
import { clearQueue } from '../../src/lib/analytics';
import { confirmAsync, showMessage } from '../../src/lib/dialogs';
import { haptic } from '../../src/lib/haptics';
import { openExternal } from '../../src/lib/navigation';
import { getPermissionState, getPushToken, PUSH_SUPPORTED, requestPermission, type PermissionState } from '../../src/push/notifications';
import { applyServerOverride, checkServer, CONTENT_SOURCE_SETTINGS, normalizeApiUrl, useServer, type ServerCheck } from '../../src/state/server';
import { textScale, updateSettings, useSettings, type Appearance } from '../../src/state/settings';
import { useTheme } from '../../src/state/theme';
import { fonts, textScaleSteps } from '../../src/theme';
import type { PushPreferences } from '../../src/types';

function Group({ title, children, footer }: { title: string; children: ReactNode; footer?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ marginTop: 26 }}>
      <Txt variant="kicker" size={11.5} muted style={{ paddingHorizontal: 20, marginBottom: 8 }} accessibilityRole="header">
        {title}
      </Txt>
      <View style={{ marginHorizontal: 16, borderRadius: 14, backgroundColor: c.surface, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>{children}</View>
      {footer ? (
        <Txt variant="ui" size={12.5} muted style={{ paddingHorizontal: 20, marginTop: 8 }} lineHeight={18}>
          {footer}
        </Txt>
      ) : null}
    </View>
  );
}

function Row({ icon, title, subtitle, onPress, right, danger, last }: { icon?: IconName; title: string; subtitle?: string; onPress?: () => void; right?: ReactNode; danger?: boolean; last?: boolean }) {
  const { c } = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 52, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border }}>
      {icon ? <Icon name={icon} size={20} color={danger ? c.danger : c.heading} /> : null}
      <View style={{ flex: 1 }}>
        <Txt variant="uiStrong" size={15} color={danger ? c.danger : c.text}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="ui" size={12.5} muted lineHeight={17} style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={18} color={c.textMuted} /> : null)}
    </View>
  );
  return onPress ? (
    <Tap onPress={onPress} pressScale={0.99} accessibilityRole="button" accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}>
      {body}
    </Tap>
  ) : (
    body
  );
}

function Toggle({ value, onChange, label, disabled }: { value: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  const { isDark } = useTheme();
  return (
    <Switch
      value={value}
      disabled={disabled}
      onValueChange={(v) => {
        haptic.tap();
        onChange(v);
      }}
      accessibilityLabel={label}
      trackColor={{ false: isDark ? '#22385E' : '#C9D2E0', true: '#1A4FB0' }}
      thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
      ios_backgroundColor={isDark ? '#22385E' : '#C9D2E0'}
    />
  );
}

function Segmented<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const { c, isDark } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', backgroundColor: c.bg, borderRadius: 10, padding: 3, margin: 12, borderWidth: 1, borderColor: c.border }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Tap
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            haptics
            pressScale={0.97}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={o.label}
            style={{ flex: 1, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? (isDark ? '#FFFFFF' : '#0B2A5E') : 'transparent' }}
          >
            <Txt variant={active ? 'uiBold' : 'ui'} size={13.5} color={active ? (isDark ? '#061A40' : '#FFFFFF') : c.text}>
              {o.label}
            </Txt>
          </Tap>
        );
      })}
    </View>
  );
}

function shiftTime(t: string, hours: number) {
  const h = (parseInt(t.slice(0, 2), 10) + hours + 24) % 24;
  return `${String(h).padStart(2, '0')}:00`;
}

function Stepper({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <Txt variant="ui" size={12} muted>
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Tap onPress={() => onChange(shiftTime(value, -1))} accessibilityLabel={`${label} one hour earlier`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Txt variant="headline" size={20} color={c.link}>−</Txt>
        </Tap>
        <Txt variant="headline" size={18} accessibilityLabel={`${label} ${value}`}>
          {value}
        </Txt>
        <Tap onPress={() => onChange(shiftTime(value, 1))} accessibilityLabel={`${label} one hour later`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Txt variant="headline" size={20} color={c.link}>+</Txt>
        </Tap>
      </View>
    </View>
  );
}

function NotificationsGroup() {
  const { c } = useTheme();
  const qc = useQueryClient();
  const [perm, setPerm] = useState<PermissionState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const prefs = useQuery({
    queryKey: ['preferences'],
    enabled: PUSH_SUPPORTED,
    queryFn: async () => {
      await registerDevice();
      return endpoints.getPreferences();
    },
    retry: 1,
  });
  const cats = useQuery({ queryKey: ['categories'], queryFn: ({ signal }) => endpoints.categories(signal), staleTime: 30 * 60_000 });
  useEffect(() => {
    void getPermissionState().then(setPerm).catch(() => setPerm('undetermined'));
  }, []);

  const save = useMutation({
    mutationFn: (patch: Partial<PushPreferences> & { pushToken?: string | null }) => endpoints.putPreferences(patch),
    onMutate: async (patch) => {
      const prev = qc.getQueryData<PushPreferences>(['preferences']);
      if (prev) qc.setQueryData(['preferences'], { ...prev, ...patch });
      return { prev };
    },
    onError: (e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(['preferences'], ctx.prev);
      setMessage(`Couldn’t save: ${describeError(e)}`);
    },
    onSuccess: (data) => qc.setQueryData(['preferences'], data),
  });

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      let p = await getPermissionState();
      if (p !== 'granted') p = await requestPermission();
      setPerm(p);
      if (p !== 'granted') {
        setMessage(p === 'denied' ? 'Notifications are turned off for Garowe World in your device settings.' : 'Permission was not granted.');
        return;
      }
      const tok = await getPushToken();
      if (tok.ok) {
        await save.mutateAsync({ pushToken: tok.token, notificationsEnabled: true });
        haptic.success();
        setMessage('Breaking-news alerts are on for this device.');
      } else {
        await save.mutateAsync({ notificationsEnabled: true }).catch(() => {});
        setMessage(tok.message);
      }
    } catch (e) {
      setMessage(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const p = prefs.data;
  const quiet = p?.quietHours ?? null;
  const toggleCat = (slug: string) => {
    if (!p) return;
    const has = p.categorySlugs.includes(slug);
    save.mutate({ categorySlugs: has ? p.categorySlugs.filter((x) => x !== slug) : [...p.categorySlugs, slug] });
  };

  return (
    <Group title="Notifications" footer="We only send alerts for major breaking news and the briefings you choose. You can change this at any time.">
      <View style={{ padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E1141E', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="title" size={15.5}>
              Breaking news alerts
            </Txt>
            <Txt variant="ui" size={13} muted lineHeight={18}>
              Get a notification when a major story breaks. Tapping it opens the story in the app.
            </Txt>
          </View>
        </View>
        {!PUSH_SUPPORTED ? (
          <Txt variant="ui" size={13} muted>
            Push notifications are available in the iPhone and Android apps (not in this web preview).
          </Txt>
        ) : perm === 'granted' && p?.hasPushToken ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="check" size={16} color={c.success} />
            <Txt variant="uiStrong" size={13} color={c.success}>
              This device is registered for alerts
            </Txt>
          </View>
        ) : (
          <Button title={perm === 'denied' ? 'Open device settings' : 'Turn on notifications'} icon="bell" onPress={() => (perm === 'denied' ? void Linking.openSettings() : void enable())} disabled={busy} />
        )}
        {busy ? <ActivityIndicator color={c.textMuted} /> : null}
        {message ? (
          <Txt variant="ui" size={13} lineHeight={18} color={c.text} accessibilityLiveRegion="polite">
            {message}
          </Txt>
        ) : null}
      </View>
      {!PUSH_SUPPORTED ? null : prefs.isPending ? (
        <View style={{ padding: 16 }}>
          <ActivityIndicator color={c.textMuted} />
        </View>
      ) : prefs.isError || !p ? (
        <Row icon="alert" title="Notification settings unavailable" subtitle={`${describeError(prefs.error)} Tap to retry.`} onPress={() => void prefs.refetch()} last />
      ) : (
        <>
          <Row title="Allow notifications" subtitle="Master switch for this device" right={<Toggle label="Allow notifications" value={p.notificationsEnabled} onChange={(v) => save.mutate({ notificationsEnabled: v })} />} />
          <Row title="Breaking news" right={<Toggle label="Breaking news" value={p.breaking} disabled={!p.notificationsEnabled} onChange={(v) => save.mutate({ breaking: v })} />} />
          <Row title="Daily briefing" subtitle="A morning round-up of the day’s essential stories" right={<Toggle label="Daily briefing" value={p.dailyBriefing} disabled={!p.notificationsEnabled} onChange={(v) => save.mutate({ dailyBriefing: v })} />} />
          <View style={{ padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Txt variant="uiStrong" size={15}>
              Follow sections
            </Txt>
            <Txt variant="ui" size={12.5} muted>
              Also alert me about major stories in:
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(cats.data ?? [])
                .filter((x) => x.slug !== 'video' && x.slug !== 'podcasts')
                .map((x) => {
                  const on = p.categorySlugs.includes(x.slug);
                  return (
                    <Tap key={x.slug} onPress={() => toggleCat(x.slug)} haptics accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: !p.notificationsEnabled }} disabled={!p.notificationsEnabled} style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: on ? '#1A4FB0' : c.bg, borderWidth: 1, borderColor: on ? '#1A4FB0' : c.border, opacity: p.notificationsEnabled ? 1 : 0.5 }}>
                      {on ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
                      <Txt variant={on ? 'uiBold' : 'ui'} size={13} color={on ? '#FFFFFF' : c.text}>
                        {x.name}
                      </Txt>
                    </Tap>
                  );
                })}
            </View>
          </View>
          <Row title="Quiet hours" subtitle={quiet ? `No alerts between ${quiet.start} and ${quiet.end} (device time)` : 'Pause alerts overnight'} right={<Toggle label="Quiet hours" value={!!quiet} onChange={(v) => save.mutate({ quietHours: v ? { start: '22:00', end: '07:00' } : null })} />} last={!quiet} />
          {quiet ? (
            <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
              <Stepper label="From" value={quiet.start} onChange={(v) => save.mutate({ quietHours: { ...quiet, start: v } })} />
              <Stepper label="Until" value={quiet.end} onChange={(v) => save.mutate({ quietHours: { ...quiet, end: v } })} />
            </View>
          ) : null}
        </>
      )}
    </Group>
  );
}

function AccountGroup() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  useEffect(() => {
    void getSessionToken().then((t) => setSignedIn(!!t));
    return onSessionChange(setSignedIn);
  }, []);

  const signOut = async () => {
    if (!(await confirmAsync('Sign out?', 'Saved stories stay on this device.', 'Sign out', true))) return;
    await endpoints.logout().catch(() => {});
    await setSessionToken(null);
    haptic.success();
  };
  const deleteAccount = async () => {
    const ok = await confirmAsync(
      'Delete your reader account?',
      'This permanently deletes your Garowe World reader account, its sign-in sessions and the saved-stories list stored on our servers. Stories saved on this device are kept until you remove them. This cannot be undone.',
      'Delete account',
      true,
    );
    if (!ok) return;
    try {
      await endpoints.deleteMe();
      await setSessionToken(null);
      haptic.success();
      showMessage('Account deleted', 'Your reader account has been deleted.');
    } catch (e) {
      showMessage('Couldn’t delete the account', describeError(e));
    }
  };

  if (signedIn === null) return null;
  return (
    <Group title="Account" footer={signedIn ? undefined : 'An account is optional: everything in the app works without one. With an account your saved stories sync between your devices and goworld.news.'}>
      {signedIn ? (
        <>
          <Row icon="user" title="Signed in" subtitle="Your saved stories sync with your reader account" />
          <Row
            icon="refresh"
            title="Sync saved stories now"
            subtitle={syncMsg ?? undefined}
            onPress={async () => {
              setSyncMsg('Syncing…');
              try {
                const r = await mergeBookmarks();
                setSyncMsg(r ? `Done · ${r.downloaded} downloaded, ${r.uploaded} uploaded` : 'Not signed in');
              } catch (e) {
                setSyncMsg(describeError(e));
              }
            }}
          />
          <Row icon="back" title="Sign out" onPress={() => void signOut()} />
          <Row icon="trash" title="Delete account" subtitle="Permanently delete your reader account" danger onPress={() => void deleteAccount()} last />
        </>
      ) : (
        <Row icon="user" title="Create an account or sign in" subtitle="With your email — no password: we send a one-time link" onPress={() => router.push('/settings/sign-in' as Href)} last />
      )}
    </Group>
  );
}

/**
 * Test builds only: choose where content comes from — the built-in demo stories, the server this build was made for,
 * or another Garowe World server (staging / self-hosted) without a rebuild. Not shown in store builds.
 */
function ContentSourceGroup() {
  const { c } = useTheme();
  const qc = useQueryClient();
  const apiUrl = useServer((s) => s.apiUrl);
  const overridden = useServer((s) => s.overridden);
  const demo = useServer((s) => s.demo);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; check: ServerCheck } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const test = async (url: string) => {
    setBusy(true);
    setError(null);
    try {
      const check = await checkServer(url);
      setResult({ url, check });
      return check;
    } finally {
      setBusy(false);
    }
  };

  const use = async (choice: string | null) => {
    setBusy(true);
    try {
      await applyServerOverride(choice, { resetCredentials: resetServerCredentials, clearCaches: clearAllCachedContent });
      await qc.invalidateQueries();
      setDraft('');
      setResult(null);
      haptic.success();
      showMessage(
        'Content source changed',
        choice === 'demo' ? 'The app now shows the built-in demo stories.' : `The app now uses ${choice ?? BUILD_API_URL}. Pull to refresh any open screen, or close and reopen the app.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    const n = normalizeApiUrl(draft);
    if (!n.ok) return setError(n.message);
    const check = await test(n.url);
    if (check.ok) return void use(n.url);
    const anyway = await confirmAsync('Server not reachable', `${check.message}\n\nUse ${n.url} anyway?`, 'Use anyway');
    if (anyway) await use(n.url);
  };

  return (
    <Group
      title="Content source (test build)"
      footer="Only in test builds from GitHub. The built-in demo stories are fictional sample content bundled in the app so it can be tried before the Garowe World server is online. A server address switches the app to real content without installing a new APK. Changing the source signs you out and clears cached stories; saved stories stay on this phone."
    >
      <Row
        icon="broadcast"
        title={demo ? 'Built-in demo stories' : overridden ? 'Custom server' : 'Default server'}
        subtitle={demo ? 'Fictional sample stories bundled in this test app — not real news' : apiUrl}
        right={busy ? <ActivityIndicator color={c.textMuted} /> : undefined}
      />
      {DEMO_CONTENT !== 'off' && !demo ? (
        <Row icon="saved" title="Show the built-in demo stories" subtitle="Works without a server" onPress={busy ? undefined : () => void use('demo')} />
      ) : null}
      {!demo ? (
        <Row
          icon="refresh"
          title="Test connection"
          subtitle={result && result.url === apiUrl ? (result.check.ok ? `Connected · ${result.check.name ?? 'Garowe World'} · ${result.check.ms} ms` : result.check.message) : 'Checks that this server answers'}
          onPress={busy ? undefined : () => void test(apiUrl)}
        />
      ) : null}
      {demo || overridden ? (
        <Row icon="external" title="Use the default server" subtitle={BUILD_API_URL} onPress={busy ? undefined : () => void use(null)} last={!ALLOW_SERVER_OVERRIDE} />
      ) : null}
      {ALLOW_SERVER_OVERRIDE ? (
        <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
          <TextInput
            value={draft}
            onChangeText={(t) => {
              setDraft(t);
              setError(null);
            }}
            placeholder="Another server: staging.example.com"
            placeholderTextColor={c.textMuted}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => void saveDraft()}
            accessibilityLabel="Server address"
            style={{ minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: error ? c.danger : c.border, paddingHorizontal: 12, color: c.text, fontFamily: fonts.ui400, fontSize: 15, backgroundColor: c.bg }}
          />
          {error ? (
            <Txt variant="ui" size={12.5} color={c.danger}>
              {error}
            </Txt>
          ) : null}
          {result && result.url !== apiUrl && !result.check.ok ? (
            <Txt variant="ui" size={12.5} color={c.danger}>
              {result.check.message}
            </Txt>
          ) : null}
          <Button title="Test and use this server" kind="secondary" disabled={busy || !draft.trim()} onPress={() => void saveDraft()} />
        </View>
      ) : null}
    </Group>
  );
}

export default function SettingsScreen() {
  const { c } = useTheme();
  const appearance = useSettings((s) => s.appearance);
  const textIndex = useSettings((s) => s.textScaleIndex);
  const analytics = useSettings((s) => s.analyticsEnabled);
  const config = useAppConfig();
  const build = Application.nativeBuildVersion;
  const page = (key: string) => () => router.push(`/settings/page/${key}` as Href);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={{ paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        <AccountGroup />
        <NotificationsGroup />

        <Group title="Appearance">
          <Segmented<Appearance>
            label="Appearance"
            value={appearance}
            onChange={(v) => updateSettings({ appearance: v })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Group>

        <Group title="Article text size" footer="Also follows your device’s text size (Dynamic Type / font scale).">
          <Segmented<number> label="Article text size" value={textIndex} onChange={(v) => updateSettings({ textScaleIndex: v })} options={textScaleSteps.map((s, i) => ({ value: i, label: `${Math.round(s * 100)}%` }))} />
          <Txt variant="serif" size={17 * textScale(textIndex)} lineHeight={Math.round(26 * textScale(textIndex))} style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
            Reporting the news that matters across borders — quickly, accurately and fairly.
          </Txt>
        </Group>

        <Group title="Privacy" footer="Anonymous, first-party statistics (which stories are read, not who reads them). No advertising identifiers. Turning this off stops sending immediately.">
          <Row
            title="Share anonymous usage statistics"
            right={
              <Toggle
                label="Share anonymous usage statistics"
                value={analytics}
                onChange={(v) => {
                  updateSettings({ analyticsEnabled: v });
                  if (!v) clearQueue();
                }}
              />
            }
            last
          />
        </Group>

        {CONTENT_SOURCE_SETTINGS ? <ContentSourceGroup /> : null}

        <Group title="Newsletters">
          <Row icon="mail" title="Sign up for newsletters" subtitle="The World Briefing, weekly review, breaking news" onPress={() => router.push('/settings/newsletter' as Href)} last />
        </Group>
        <Group title="About Garowe World">
          <Row icon="info" title="About us" onPress={page('about')} />
          <Row icon="check" title="Editorial standards & corrections" onPress={page('editorialStandards')} />
          <Row icon="info" title="Privacy policy" onPress={page('privacy')} />
          <Row icon="info" title="Terms of use" onPress={page('terms')} />
          <Row icon="external" title="Corrections log" subtitle="Opens goworld.news" onPress={() => void openExternal(`${getSiteUrl()}/corrections`)} />
          {config.data?.contactEmail ? <Row icon="mail" title="Contact us" subtitle={config.data.contactEmail} onPress={() => void Linking.openURL(`mailto:${config.data!.contactEmail}`)} /> : null}
          {config.data?.tipsEmail ? <Row icon="mail" title="Send us a tip" subtitle={config.data.tipsEmail} onPress={() => void Linking.openURL(`mailto:${config.data!.tipsEmail}?subject=${encodeURIComponent('News tip')}`)} last /> : null}
        </Group>

        <View style={{ alignItems: 'center', marginTop: 28, gap: 4 }}>
          <Txt variant="ui" size={12.5} muted>
            Garowe World {APP_VERSION}
            {build ? ` (${build})` : ''}
          </Txt>
          <Txt variant="ui" size={11.5} muted>
            {config.data?.tagline ?? 'Breaking News. Beyond Borders.'}
          </Txt>
          {__DEV__ || ALLOW_SERVER_OVERRIDE ? (
            <Txt variant="ui" size={11} muted selectable>
              {isDemoMode() ? 'Content: built-in demo stories' : `API ${getApiUrl()}`}
            </Txt>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
