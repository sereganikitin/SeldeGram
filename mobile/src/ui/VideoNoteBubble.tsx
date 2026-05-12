import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Volume2, VolumeX, Play } from 'lucide-react-native';
import { getMediaUrl } from '../media';

interface Props {
  mediaKey: string;
}

const SIZE = 220;

export function VideoNoteBubble({ mediaKey }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<Video | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMediaUrl(mediaKey)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mediaKey]);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setPlaying(status.isPlaying);
    if (status.didJustFinish) {
      setPlaying(false);
      videoRef.current?.setPositionAsync(0).catch(() => undefined);
    }
  };

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      await v.pauseAsync().catch(() => undefined);
    } else {
      setMuted(false);
      await v.setIsMutedAsync(false).catch(() => undefined);
      await v.setPositionAsync(0).catch(() => undefined);
      await v.playAsync().catch(() => undefined);
    }
  };

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    await videoRef.current?.setIsMutedAsync(next).catch(() => undefined);
  };

  return (
    <View style={styles.wrap}>
      {url ? (
        <Pressable onPress={togglePlay} style={styles.touchable}>
          <Video
            ref={videoRef}
            source={{ uri: url }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            isMuted={muted}
            shouldPlay={false}
            isLooping={false}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          />
          {!playing && (
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.playBadge}>
                <Play size={26} color="#ad1d50" fill="#ad1d50" />
              </View>
            </View>
          )}
        </Pressable>
      ) : (
        <View style={styles.placeholder}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
      {playing && (
        <Pressable onPress={toggleMute} style={styles.muteBtn}>
          {muted ? <VolumeX size={16} color="#fff" /> : <Volume2 size={16} color="#fff" />}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  touchable: { width: '100%', height: '100%' },
  video: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  playBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: '#0006',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteBtn: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
