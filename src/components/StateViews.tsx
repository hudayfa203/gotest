import { View, type ViewStyle } from 'react-native';
import { describeError, isNetworkError } from '../api/client';
import { ALLOW_SERVER_OVERRIDE, getApiUrl } from '../config';
import { useTheme } from '../state/theme';
import { Icon, type IconName } from './Icon';
import { Tap } from './Tap';
import { Txt } from './Txt';

export function Button({ title, onPress, kind = 'primary', icon, disabled, style, accessibilityHint }: { title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'light'; icon?: IconName; disabled?: boolean; style?: ViewStyle; accessibilityHint?: string }) {
  const { c, isDark } = useTheme();
  const bg = kind === 'light' ? '#FFFFFF' : kind === 'primary' ? (isDark ? '#FFFFFF' : c.brand) : kind === 'danger' ? c.danger : kind === 'secondary' ? c.surface : 'transparent';
  const fg = kind === 'light' ? '#061A40' : kind === 'primary' ? (isDark ? '#061A40' : '#FFFFFF') : kind === 'danger' ? '#FFFFFF' : c.text;
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      haptics
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={accessibilityHint}
      style={[{ minHeight: 48, paddingHorizontal: 20, borderRadius: 999, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: disabled ? 0.5 : 1, borderWidth: kind === 'secondary' ? 1 : 0, borderColor: c.border }, style]}
    >
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Txt variant="uiBold" size={15} color={fg}>
        {title}
      </Txt>
    </Tap>
  );
}

export function EmptyState({ icon = 'info', title, body, action, style }: { icon?: IconName; title: string; body?: string; action?: { title: string; onPress: () => void }; style?: ViewStyle }) {
  const { c } = useTheme();
  return (
    <View style={[{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48, gap: 12 }, style]}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={28} color={c.textMuted} />
      </View>
      <Txt variant="title" size={18} align="center" accessibilityRole="header">
        {title}
      </Txt>
      {body ? (
        <Txt variant="body" muted align="center" size={15} lineHeight={22}>
          {body}
        </Txt>
      ) : null}
      {action ? <Button title={action.title} onPress={action.onPress} style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry, style, title = 'Couldn’t load this' }: { error: unknown; onRetry?: () => void; style?: ViewStyle; title?: string }) {
  // test builds: say which server failed, and where to change it (Settings → Server)
  const body = ALLOW_SERVER_OVERRIDE && isNetworkError(error) ? `${describeError(error)}\n\nTest build · server: ${getApiUrl()}\nChange it in Settings → Server.` : describeError(error);
  return <EmptyState icon="alert" title={title} body={body} action={onRetry ? { title: 'Try again', onPress: onRetry } : undefined} style={style} />;
}
