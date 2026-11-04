import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { track } from '../../lib/analytics';
import { formatDuration } from '../../lib/format';
import { useTheme } from '../../state/theme';
import type { PodcastEpisode } from '../../types';
import { Icon } from '../Icon';
import { Tap } from '../Tap';
import { Txt } from '../Txt';

/** Podcast episode player (expo-audio). The audio is only loaded after the reader taps Play. */
export function AudioPlayer({ episode, compact }: { episode: PodcastEpisode; compact?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const { c } = useTheme();
  if (!loaded) {
    return (
      <Shell episode={episode} compact={compact}>
        <PlayButton playing={false} onPress={() => setLoaded(true)} label={`Play episode: ${episode.title}`} />
        <View style={{ flex: 1, gap: 6 }}>
          <Bar progress={0} color={c.border} />
          <Txt variant="ui" size={12} muted>
            {episode.durationSeconds ? formatDuration(episode.durationSeconds) : 'Audio'}
          </Txt>
        </View>
      </Shell>
    );
  }
  return <LoadedPlayer episode={episode} compact={compact} />;
}

function LoadedPlayer({ episode, compact }: { episode: PodcastEpisode; compact?: boolean }) {
  const { c } = useTheme();
  const player = useAudioPlayer(episode.audioUrl);
  const status = useAudioPlayerStatus(player);
  const tracked = useRef(false);
  useEffect(() => {
    player.play();
  }, [player]);
  useEffect(() => {
    if (status.playing && !tracked.current) {
      tracked.current = true;
      track('audio_play', { articleId: episode.articleId, props: { series: episode.seriesSlug } });
    }
  }, [status.playing, episode]);
  const duration = status.duration || episode.durationSeconds || 0;
  const progress = duration ? Math.min(1, status.currentTime / duration) : 0;
  const toggle = () => {
    if (status.playing) player.pause();
    else {
      if (status.didJustFinish || (duration && status.currentTime >= duration - 0.25)) void player.seekTo(0);
      player.play();
    }
  };
  return (
    <Shell episode={episode} compact={compact}>
      <PlayButton playing={status.playing} onPress={toggle} label={status.playing ? 'Pause' : 'Play'} />
      <View style={{ flex: 1, gap: 6 }}>
        <Bar progress={progress} color={c.border} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt variant="ui" size={12} muted accessibilityLabel={`Elapsed ${formatDuration(status.currentTime)}`}>
            {formatDuration(status.currentTime)}
          </Txt>
          <Txt variant="ui" size={12} muted>
            {duration ? formatDuration(duration) : status.isBuffering ? 'Loading…' : ''}
          </Txt>
        </View>
      </View>
      <Tap onPress={() => void player.seekTo(Math.max(0, status.currentTime - 15))} accessibilityLabel="Back 15 seconds" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Txt variant="uiBold" size={12} color={c.text}>
          −15s
        </Txt>
      </Tap>
    </Shell>
  );
}

function Shell({ episode, compact, children }: { episode: PodcastEpisode; compact?: boolean; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: c.border }}>
      {!compact ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="headphones" size={16} color={c.accent} />
          <Txt variant="kicker" size={10.5} color={c.link} numberOfLines={1} style={{ flex: 1 }}>
            {episode.seriesTitle}
            {episode.episodeNo ? ` · Episode ${episode.episodeNo}` : ''}
          </Txt>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>{children}</View>
    </View>
  );
}

function PlayButton({ playing, onPress, label }: { playing: boolean; onPress: () => void; label: string }) {
  return (
    <Tap onPress={onPress} haptics accessibilityLabel={label} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#E1141E', alignItems: 'center', justifyContent: 'center', paddingLeft: playing ? 0 : 3 }}>
      <Icon name={playing ? 'pause' : 'play'} size={20} color="#FFFFFF" />
    </Tap>
  );
}

function Bar({ progress, color }: { progress: number; color: string }) {
  return (
    <View style={{ height: 4, borderRadius: 2, backgroundColor: color, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
      <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: '#E1141E' }} />
    </View>
  );
}
