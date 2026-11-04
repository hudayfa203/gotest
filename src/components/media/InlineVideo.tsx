import { useEvent } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { track } from '../../lib/analytics';
import { formatDuration } from '../../lib/format';
import type { ImageRef } from '../../types';
import { ArticleImage } from '../ArticleImage';
import { Icon } from '../Icon';
import { Tap } from '../Tap';
import { Txt } from '../Txt';

/**
 * Native video (expo-video) with native controls + fullscreen. Shows the poster with a play button
 * first, so no video data is downloaded until the reader asks for it.
 */
export function InlineVideo({ url, poster, title, articleId, width, durationSeconds, radius = 0, autoPlay = false }: { url: string; poster?: ImageRef | null; title: string; articleId?: string; width: number; durationSeconds?: number; radius?: number; autoPlay?: boolean }) {
  const [started, setStarted] = useState(autoPlay);
  const h = Math.round((width * 9) / 16);
  useEffect(() => setStarted(autoPlay), [url, autoPlay]);
  if (!started) {
    return (
      <Tap onPress={() => setStarted(true)} haptics pressScale={0.99} accessibilityRole="button" accessibilityLabel={`Play video: ${title}${durationSeconds ? `, ${formatDuration(durationSeconds)}` : ''}`} style={{ width, height: h, borderRadius: radius, overflow: 'hidden', backgroundColor: '#061A40' }}>
        {poster ? <ArticleImage image={poster} width={width} ratio={16 / 9} accessible={false} /> : <LinearGradient colors={['#061A40', '#0B2A5E', '#1A4FB0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width, height: h }} />}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,26,64,0.25)' }}>
          <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: '#E1141E', alignItems: 'center', justifyContent: 'center', paddingLeft: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
            <Icon name="play" size={30} color="#FFFFFF" />
          </View>
        </View>
        {!poster ? (
          <Txt variant="title" size={14} color="#FFFFFF" numberOfLines={1} style={{ position: 'absolute', left: 14, right: 70, bottom: 12 }}>
            {title}
          </Txt>
        ) : null}
        {durationSeconds ? (
          <View style={{ position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Txt variant="uiBold" size={12} color="#FFFFFF">
              {formatDuration(durationSeconds)}
            </Txt>
          </View>
        ) : null}
      </Tap>
    );
  }
  return <PlayingVideo url={url} width={width} height={h} radius={radius} articleId={articleId} title={title} />;
}

function PlayingVideo({ url, width, height, radius, articleId, title }: { url: string; width: number; height: number; radius: number; articleId?: string; title: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const tracked = useRef(false);
  useEffect(() => {
    if (isPlaying && !tracked.current) {
      tracked.current = true;
      track('video_play', { articleId, props: { source: 'file' } });
    }
  }, [isPlaying, articleId]);
  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: '#000' }}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        nativeControls
        contentFit="contain"
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture={false}
        accessibilityLabel={`Video: ${title}`}
      />
    </View>
  );
}
