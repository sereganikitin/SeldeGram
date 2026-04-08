import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { parseWallpaper } from '../wallpapers';
import { getMediaUrl } from '../media';
import { useColors } from '../theme';

interface Props {
  wallpaper?: string | null;
  children: React.ReactNode;
}

export function ChatBackground({ wallpaper, children }: Props) {
  const colors = useColors();
  const parsed = parseWallpaper(wallpaper);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (parsed?.kind === 'media') {
      getMediaUrl(parsed.key).then(setImageUrl).catch(() => {});
    } else {
      setImageUrl(null);
    }
  }, [parsed?.kind === 'media' ? parsed.key : null]);

  if (parsed?.kind === 'media' && imageUrl) {
    return (
      <View style={{ flex: 1 }}>
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        {children}
      </View>
    );
  }

  if (parsed?.kind === 'preset') {
    // Простой одноцветный фон (градиент потребовал бы expo-linear-gradient, обойдёмся плотным цветом)
    return (
      <View style={{ flex: 1, backgroundColor: parsed.preset.color2 ?? parsed.preset.color1 }}>
        {children}
      </View>
    );
  }

  return <View style={{ flex: 1, backgroundColor: colors.bg }}>{children}</View>;
}
