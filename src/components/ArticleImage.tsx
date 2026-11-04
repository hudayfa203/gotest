import { Image, type ImageContentFit } from 'expo-image';
import { PixelRatio, View, type StyleProp, type ViewStyle } from 'react-native';
import { aspectRatio, pickImageUrl } from '../lib/blocks';
import { useTheme } from '../state/theme';
import type { ImageRef } from '../types';

/** Responsive news image: picks the right variant for the rendered width, fades in, caches on disk. */
export function ArticleImage({
  image, width, ratio, style, contentFit = 'cover', radius = 0, priority, accessible = true, recyclingKey,
}: {
  image?: ImageRef | { url: string; width: number; height: number; alt: string; variants?: ImageRef['variants'] } | null;
  width: number;
  ratio?: number;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  radius?: number;
  priority?: 'low' | 'normal' | 'high';
  accessible?: boolean;
  recyclingKey?: string;
}) {
  const { c } = useTheme();
  const r = ratio ?? aspectRatio(image ?? undefined);
  const h = Math.round(width / r);
  return (
    <View style={[{ width, height: h, backgroundColor: c.surface, borderRadius: radius, overflow: 'hidden' }, style]}>
      {image ? (
        <Image
          source={{ uri: pickImageUrl(image, Math.round(width * PixelRatio.get())) }}
          style={{ width: '100%', height: '100%' }}
          contentFit={contentFit}
          transition={220}
          cachePolicy="memory-disk"
          priority={priority}
          recyclingKey={recyclingKey}
          accessible={accessible}
          accessibilityLabel={accessible ? image.alt : undefined}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}
