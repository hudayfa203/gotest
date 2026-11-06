import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { FeedSkeleton } from '../../../src/components/Skeleton';
import { Button, ErrorState } from '../../../src/components/StateViews';
import { openExternal } from '../../../src/lib/navigation';
import { Txt } from '../../../src/components/Txt';
import { useAppConfig } from '../../../src/features/UpdateGate';
import { useTheme } from '../../../src/state/theme';
import type { AppConfig } from '../../../src/types';

const TITLES: Record<keyof AppConfig['pages'], string> = {
  about: 'About Garowe World',
  editorialStandards: 'Editorial standards',
  privacy: 'Privacy policy',
  terms: 'Terms of use',
};

/** About / Editorial standards / Privacy / Terms — text managed in the newsroom dashboard (GET /config pages). */
export default function InfoPage() {
  const { key } = useLocalSearchParams<{ key: keyof AppConfig['pages'] }>();
  const { c } = useTheme();
  const config = useAppConfig();
  const title = TITLES[key as keyof AppConfig['pages']] ?? 'Information';
  const text = config.data?.pages?.[key as keyof AppConfig['pages']];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title={title} />
      {config.isPending ? (
        <FeedSkeleton hero={false} rows={3} />
      ) : !text ? (
        <ErrorState error={config.error} onRetry={() => void config.refetch()} title="This page isn’t available" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center', gap: 16 }}>
          <Txt variant="display" size={26} accessibilityRole="header">
            {title}
          </Txt>
          {text.split(/\n{2,}/).map((p, i) => (
            <Txt key={i} variant="serif" size={17} lineHeight={27}>
              {p.trim()}
            </Txt>
          ))}
          {key === 'about' && config.data?.publisher ? (
            <Txt variant="ui" size={14} muted>
              Garowe World is published by {config.data.publisher}.{config.data.contactEmail ? ` Contact: ${config.data.contactEmail}` : ''}
            </Txt>
          ) : null}
          {config.data?.pageUrls?.[key as keyof AppConfig['pages']] ? (
            <Button title="Read on goworld.news" kind="secondary" icon="external" onPress={() => void openExternal(config.data!.pageUrls![key as keyof AppConfig['pages']])} />
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
