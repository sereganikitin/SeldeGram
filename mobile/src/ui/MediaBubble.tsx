import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, Pressable, Linking } from 'react-native';
import { getMediaUrl } from '../media';

interface Props {
  mediaKey: string;
  mediaType: string;
  mediaName?: string | null;
  mediaSize?: number | null;
  mine: boolean;
}

export function MediaBubble({ mediaKey, mediaType, mediaName, mediaSize, mine }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMediaUrl(mediaKey)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [mediaKey]);

  const isImage = mediaType.startsWith('image/');

  if (error) {
    return <Text style={mine ? styles.errorMine : styles.errorOther}>Ошибка загрузки</Text>;
  }

  if (isImage) {
    if (!url) {
      return (
        <View style={styles.imagePlaceholder}>
          <ActivityIndicator />
        </View>
      );
    }
    return <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />;
  }

  // Файл
  return (
    <Pressable onPress={() => url && Linking.openURL(url)} style={styles.fileRow}>
      <Text style={styles.fileIcon}>📄</Text>
      <View style={{ flex: 1 }}>
        <Text style={mine ? styles.fileNameMine : styles.fileNameOther} numberOfLines={1}>
          {mediaName ?? 'Файл'}
        </Text>
        {mediaSize != null && (
          <Text style={mine ? styles.fileSizeMine : styles.fileSizeOther}>{formatSize(mediaSize)}</Text>
        )}
      </View>
    </Pressable>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  image: { width: 220, height: 220, borderRadius: 12, backgroundColor: '#0002' },
  imagePlaceholder: { width: 220, height: 220, borderRadius: 12, backgroundColor: '#0001', justifyContent: 'center', alignItems: 'center' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 200 },
  fileIcon: { fontSize: 28 },
  fileNameMine: { color: '#fff', fontSize: 15, fontWeight: '600' },
  fileNameOther: { color: '#000', fontSize: 15, fontWeight: '600' },
  fileSizeMine: { color: '#cce4ff', fontSize: 12 },
  fileSizeOther: { color: '#777', fontSize: 12 },
  errorMine: { color: '#fff', fontStyle: 'italic' },
  errorOther: { color: '#a00', fontStyle: 'italic' },
});
