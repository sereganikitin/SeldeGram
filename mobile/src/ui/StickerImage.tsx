import React, { useEffect, useState } from 'react';
import { Image, View, ActivityIndicator, StyleSheet } from 'react-native';
import { getMediaUrl } from '../media';

interface Props {
  mediaKey: string;
  size?: number;
}

export function StickerImage({ mediaKey, size = 150 }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMediaUrl(mediaKey).then((u) => !cancelled && setUrl(u)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mediaKey]);

  if (!url) {
    return (
      <View style={[styles.placeholder, { width: size, height: size }]}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Image source={{ uri: url }} style={{ width: size, height: size }} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  placeholder: { justifyContent: 'center', alignItems: 'center' },
});
