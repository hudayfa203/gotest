import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { endpoints } from '../src/api';
import { isGone, isNotFound } from '../src/api/client';
import { EmptyState } from '../src/components/StateViews';
import { Txt } from '../src/components/Txt';
import { getSiteUrl } from '../src/config';
import { openExternal } from '../src/lib/navigation';
import { useTheme } from '../src/state/theme';

/**
 * Link resolver: `?path=/old/url` → GET /resolve (old slugs, redirects, withdrawn) → article in-app;
 * anything that isn't an article opens on the website. `?url=` opens externally.
 */
export default function LinkResolver() {
  const { path, url } = useLocalSearchParams<{ path?: string; url?: string }>();
  const { c } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const leave = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));
    void (async () => {
      if (url) {
        leave();
        await openExternal(String(url));
        return;
      }
      if (!path) return leave();
      try {
        const r = await endpoints.resolve(String(path));
        if (r.kind === 'article' && r.articleId) return router.replace(`/article/${r.articleId}` as Href);
        if (r.kind === 'redirect') {
          leave();
          return void openExternal(`${getSiteUrl()}${r.canonicalPath}`);
        }
        if (r.kind === 'gone' && r.articleId) return router.replace(`/article/${r.articleId}` as Href);
        leave();
        await openExternal(`${getSiteUrl()}${String(path)}`);
      } catch (e) {
        if (isNotFound(e) || isGone(e)) setError('This page could not be found on GO World News.');
        else {
          leave();
          await openExternal(`${getSiteUrl()}${String(path)}`);
        }
      }
    })();
  }, [path, url]);

  return (
    <View style={{ flex: 1, backgroundColor: error ? c.bg : 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' }}>
      {error ? (
        <EmptyState icon="alert" title="Link not found" body={error} action={{ title: 'Go to Home', onPress: () => router.replace('/' as Href) }} />
      ) : (
        <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 14, padding: 20, alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={c.textMuted} />
          <Txt variant="ui" size={14}>
            Opening link…
          </Txt>
        </View>
      )}
    </View>
  );
}
