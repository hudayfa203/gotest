import type { ErrorBoundaryProps } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../state/theme';
import { EmptyState } from './StateViews';

/** Route-level crash screen: explains, offers retry — never a blank screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  if (__DEV__) console.error(error);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top, justifyContent: 'center' }}>
      <EmptyState icon="alert" title="Something went wrong" body="This screen hit an unexpected problem. You can try again." action={{ title: 'Try again', onPress: () => void retry() }} />
    </View>
  );
}
