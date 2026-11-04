import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { EmptyState } from '../src/components/StateViews';
import { useTheme } from '../src/state/theme';

export default function NotFound() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title="Not found" />
      <EmptyState icon="alert" title="This screen doesn’t exist" body="The link may be out of date." action={{ title: 'Go to Home', onPress: () => router.replace('/' as Href) }} />
    </View>
  );
}
