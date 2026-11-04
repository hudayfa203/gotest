import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '../../src/api';
import { describeError } from '../../src/api/client';
import { Icon } from '../../src/components/Icon';
import { IconButton } from '../../src/components/ScreenHeader';
import { Button } from '../../src/components/StateViews';
import { Txt } from '../../src/components/Txt';
import { haptic } from '../../src/lib/haptics';
import { useTheme } from '../../src/state/theme';
import { fonts } from '../../src/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Passwordless sign-in: POST /auth/request { email, app: true } emails a one-time link
 * goworldnews://auth?token=… which opens app/auth.tsx → POST /auth/verify.
 */
export default function SignInScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [result, setResult] = useState<{ emailDelivered: boolean; devNote?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const valid = EMAIL_RE.test(email.trim());

  const submit = async () => {
    if (!valid) return;
    setState('sending');
    setError(null);
    try {
      const r = await endpoints.authRequest(email.trim());
      setResult(r);
      setState('sent');
      haptic.success();
    } catch (e) {
      setError(describeError(e));
      setState('error');
      haptic.warning();
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: Platform.OS === 'android' ? insets.top : 12, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <IconButton icon="close" label="Close" onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18, maxWidth: 520, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#0B2A5E', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="user" size={26} color="#FFFFFF" />
        </View>
        <Txt variant="display" size={28} accessibilityRole="header">
          Sign in to sync your saved stories
        </Txt>
        <Txt variant="body" size={15.5} lineHeight={23} muted>
          No password needed. Enter your email and we’ll send a one-time sign-in link. Open it on this phone to finish. An account is optional — the app works fully without one.
        </Txt>

        {state === 'sent' && result ? (
          <Animated.View entering={FadeIn} style={{ gap: 10, backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border }} accessibilityLiveRegion="polite">
            {result.emailDelivered ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="mail" size={20} color={c.success} />
                  <Txt variant="title" size={16}>
                    Check your email
                  </Txt>
                </View>
                <Txt variant="body" size={14.5} lineHeight={21}>
                  If {email.trim()} can receive email, a sign-in link is on its way. Tap the link on this device to sign in. It expires after a short time.
                </Txt>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="alert" size={20} color={c.warning} />
                  <Txt variant="title" size={16}>
                    Email could not be sent
                  </Txt>
                </View>
                <Txt variant="body" size={14.5} lineHeight={21}>
                  The server has no email provider configured, so no sign-in email was sent. {result.devNote ?? ''}
                </Txt>
              </>
            )}
            <Button title="Use a different email" kind="secondary" onPress={() => setState('idle')} />
          </Animated.View>
        ) : (
          <View style={{ gap: 12 }}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="you@example.com"
              placeholderTextColor={c.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={() => void submit()}
              accessibilityLabel="Email address"
              style={[{ minHeight: 52, borderRadius: 12, borderWidth: focused ? 2 : 1, borderColor: focused ? c.focus : c.border, backgroundColor: c.surface, paddingHorizontal: focused ? 13 : 14, fontFamily: fonts.ui500, fontSize: 16, color: c.text }, Platform.OS === 'web' ? ({ outlineWidth: 0 } as object) : null]}
            />
            {error ? (
              <Txt variant="ui" size={13.5} color={c.danger} accessibilityLiveRegion="assertive">
                {error}
              </Txt>
            ) : null}
            <Button title={state === 'sending' ? 'Sending…' : 'Email me a sign-in link'} onPress={() => void submit()} disabled={!valid || state === 'sending'} icon="mail" />
          </View>
        )}
        <Txt variant="ui" size={12} muted lineHeight={17}>
          By signing in you agree to the Terms of use. We use your email only to sign you in. You can delete your account at any time in Settings.
        </Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
