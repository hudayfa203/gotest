import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Linking, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endpoints } from '../api';
import { Button } from '../components/StateViews';
import { Txt } from '../components/Txt';
import { APP_VERSION } from '../config';
import { isUpdateRequired } from '../lib/version';

export function useAppConfig() {
  return useQuery({ queryKey: ['config'], queryFn: ({ signal }) => endpoints.config(signal), staleTime: 10 * 60_000 });
}

/** Blocks the app with "Update required" when this version is below config.minSupportedAppVersion. */
export function UpdateGate({ children }: { children: ReactNode }) {
  const { data } = useAppConfig();
  const insets = useSafeAreaInsets();
  if (!data || !isUpdateRequired(APP_VERSION, data.minSupportedAppVersion)) return <>{children}</>;
  const storeUrl = Platform.OS === 'ios' ? data.storeUrls?.ios : Platform.OS === 'android' ? data.storeUrls?.android : undefined;
  const storeName = Platform.OS === 'ios' ? 'the App Store' : Platform.OS === 'android' ? 'Google Play' : 'the App Store or Google Play';
  return (
    <View style={{ flex: 1, backgroundColor: '#061A40', paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24, paddingHorizontal: 28, justifyContent: 'space-between' }} accessibilityViewIsModal>
      <Image source={require('../../assets/images/logo-primary-reversed.png')} style={{ width: 240, height: 60 }} contentFit="contain" accessibilityLabel="Garowe World" />
      <View style={{ gap: 14 }}>
        <Txt variant="display" size={30} color="#FFFFFF" accessibilityRole="header">
          Update required
        </Txt>
        <Txt variant="body" size={16} lineHeight={24} color="rgba(255,255,255,0.85)">
          This version of Garowe World ({APP_VERSION}) is no longer supported. Please install the latest version (minimum {data.minSupportedAppVersion}) to keep reading.
        </Txt>
      </View>
      {storeUrl ? (
        <Button kind="light" title={`Open ${storeName}`} icon="external" onPress={() => void Linking.openURL(storeUrl)} />
      ) : (
        <Txt variant="ui" size={14} color="rgba(255,255,255,0.75)">
          Update the app from {storeName}.
        </Txt>
      )}
    </View>
  );
}
