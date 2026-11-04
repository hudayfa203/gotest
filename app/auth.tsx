import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { endpoints, registerDevice, setSessionToken } from '../src/api';
import { describeError } from '../src/api/client';
import { EmptyState } from '../src/components/StateViews';
import { Txt } from '../src/components/Txt';
import { mergeBookmarks } from '../src/features/saved';
import { haptic } from '../src/lib/haptics';
import { useTheme } from '../src/state/theme';

/** Opened by the emailed link goworldnews://auth?token=… → POST /auth/verify { token, app: true } (+ X-Device-Token). */
export default function AuthCallback() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { c } = useTheme();
  const [state, setState] = useState<{ kind: 'working' } | { kind: 'done'; synced: string } | { kind: 'error'; message: string }>({ kind: 'working' });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      if (!token) {
        setState({ kind: 'error', message: 'This sign-in link is incomplete.' });
        return;
      }
      try {
        await registerDevice();
        const r = await endpoints.authVerify(String(token));
        await setSessionToken(r.sessionToken);
        haptic.success();
        const m = await mergeBookmarks().catch(() => null);
        setState({ kind: 'done', synced: m ? `${m.downloaded} saved ${m.downloaded === 1 ? 'story' : 'stories'} downloaded, ${m.uploaded} uploaded.` : '' });
      } catch (e) {
        setState({ kind: 'error', message: `${describeError(e)} Sign-in links work once and expire; request a new one if needed.` });
      }
    })();
  }, [token]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}>
      {state.kind === 'working' ? (
        <View style={{ alignItems: 'center', gap: 14 }}>
          <ActivityIndicator color={c.textMuted} size="large" />
          <Txt variant="title" size={16}>
            Signing you in…
          </Txt>
        </View>
      ) : state.kind === 'done' ? (
        <EmptyState icon="check" title="You’re signed in" body={`Your saved stories now sync with your account. ${state.synced}`} action={{ title: 'Continue', onPress: () => router.replace('/saved' as Href) }} />
      ) : (
        <EmptyState icon="alert" title="Couldn’t sign you in" body={state.message} action={{ title: 'Request a new link', onPress: () => router.replace('/settings/sign-in' as Href) }} />
      )}
    </View>
  );
}
