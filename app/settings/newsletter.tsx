import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '../../src/api';
import { describeError } from '../../src/api/client';
import { Icon } from '../../src/components/Icon';
import { IconButton } from '../../src/components/ScreenHeader';
import { Button } from '../../src/components/StateViews';
import { Tap } from '../../src/components/Tap';
import { Txt } from '../../src/components/Txt';
import { haptic } from '../../src/lib/haptics';
import { useTheme } from '../../src/state/theme';
import { fonts } from '../../src/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Same lists as goworld.news/newsletters. */
const NEWSLETTER_LISTS = [
  { id: 'daily', name: 'The World Briefing', desc: 'The day’s essential global stories, every morning.' },
  { id: 'weekly', name: 'Weekly review', desc: 'The week’s most important reporting and analysis, every weekend.' },
  { id: 'breaking', name: 'Breaking news', desc: 'An email when a major story breaks.' },
] as const;

/**
 * Newsletter sign-up inside the app: POST /newsletter/subscribe { email, lists, consent, source: 'app' }.
 * Double opt-in: nothing is sent until the reader taps the link in the confirmation email.
 */
export default function NewsletterScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [lists, setLists] = useState<string[]>(['daily']);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ status: string; emailDelivered: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const valid = EMAIL_RE.test(email.trim()) && lists.length > 0 && consent;
  const toggle = (id: string) => setLists((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const submit = async () => {
    if (!valid) return;
    setState('sending');
    setError(null);
    try {
      const r = await endpoints.newsletterSubscribe(email.trim(), lists);
      setResult(r);
      setState('done');
      haptic.success();
    } catch (e) {
      setError(describeError(e));
      setState('error');
      haptic.warning();
    }
  };

  const check = (on: boolean) => (
    <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: on ? c.brand : c.border, backgroundColor: on ? c.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on ? <Icon name="check" size={15} color="#FFFFFF" /> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: Platform.OS === 'android' ? insets.top : 12, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <IconButton icon="close" label="Close" onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18, maxWidth: 520, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#0B2A5E', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="mail" size={26} color="#FFFFFF" />
        </View>
        <Txt variant="display" size={28} accessibilityRole="header">
          Newsletters
        </Txt>

        {state === 'done' && result ? (
          <View style={{ gap: 10, backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border }} accessibilityLiveRegion="polite">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name={result.emailDelivered || result.status === 'already_subscribed' ? 'check' : 'alert'} size={20} color={result.emailDelivered || result.status === 'already_subscribed' ? c.success : c.warning} />
              <Txt variant="title" size={16}>
                {result.status === 'already_subscribed' ? 'You’re already subscribed' : result.emailDelivered ? 'Check your email' : 'Saved, but no email was sent'}
              </Txt>
            </View>
            <Txt variant="body" size={14.5} lineHeight={21}>
              {result.status === 'already_subscribed'
                ? `${email.trim()} already receives Garowe World newsletters.`
                : result.emailDelivered
                  ? `We sent a confirmation link to ${email.trim()}. Your subscription starts when you tap it.`
                  : 'Your sign-up was recorded, but the confirmation email could not be sent from this server. Please try again later.'}
            </Txt>
            <Button title="Done" kind="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} />
          </View>
        ) : (
          <>
            <Txt variant="body" size={15.5} lineHeight={23} muted>
              Choose what you’d like by email. We send a confirmation link first — nothing arrives until you confirm, and every email has a one-click unsubscribe.
            </Txt>
            <View style={{ gap: 8 }}>
              {NEWSLETTER_LISTS.map((l) => (
                <Tap
                  key={l.id}
                  onPress={() => toggle(l.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: lists.includes(l.id) }}
                  accessibilityLabel={`${l.name}. ${l.desc}`}
                  style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: lists.includes(l.id) ? c.brand : c.border, backgroundColor: c.surface }}
                >
                  {check(lists.includes(l.id))}
                  <View style={{ flex: 1 }}>
                    <Txt variant="title" size={15.5}>
                      {l.name}
                    </Txt>
                    <Txt variant="ui" size={13.5} muted lineHeight={19}>
                      {l.desc}
                    </Txt>
                  </View>
                </Tap>
              ))}
            </View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={c.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel="Email address"
              style={[{ minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: 14, fontFamily: fonts.ui500, fontSize: 16, color: c.text }, Platform.OS === 'web' ? ({ outlineWidth: 0 } as object) : null]}
            />
            <Tap onPress={() => setConsent((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              {check(consent)}
              <Txt variant="ui" size={13.5} lineHeight={19} style={{ flex: 1 }}>
                I agree to receive these newsletters from Garowe World and know I can unsubscribe at any time.
              </Txt>
            </Tap>
            {error ? (
              <Txt variant="ui" size={13.5} color={c.danger} accessibilityLiveRegion="assertive">
                {error}
              </Txt>
            ) : null}
            <Button title={state === 'sending' ? 'Subscribing…' : 'Subscribe'} icon="mail" onPress={() => void submit()} disabled={!valid || state === 'sending'} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
