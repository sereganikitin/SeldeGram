import React, { useEffect, useState } from 'react';
import { Image, View, ActivityIndicator, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { getMediaUrl } from '../media';

interface Props {
  mediaKey: string;
  mediaType?: string;
  size?: number;
}

export function StickerImage({ mediaKey, mediaType, size = 150 }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMediaUrl(mediaKey).then((u) => !cancelled && setUrl(u)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mediaKey]);

  const isVideo = mediaType?.startsWith('video/');

  if (!url) {
    return (
      <View style={[styles.placeholder, { width: size, height: size }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (isVideo) {
    return <VideoSticker url={url} size={size} />;
  }

  return <Image source={{ uri: url }} style={{ width: size, height: size }} resizeMode="contain" />;
}

function VideoSticker({ url, size }: { url: string; size: number }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ width: size, height: size, backgroundColor: 'transparent' }}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { justifyContent: 'center', alignItems: 'center' },
});
