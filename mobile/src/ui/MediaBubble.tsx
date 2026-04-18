import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, Pressable, Linking } from 'react-native';
import { getMediaUrl } from '../media';
import { formatFileSize } from '../helpers';
import { FileText } from 'lucide-react-native';

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
  const isVideo = mediaType.startsWith('video/');

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

  if (isVideo) {
    return (
      <Pressable onPress={() => url && Linking.openURL(url)} style={styles.videoBox}>
        <Text style={styles.videoIcon}>▶</Text>
        <Text style={mine ? styles.fileNameMine : styles.fileNameOther}>{mediaName ?? 'Видео'}</Text>
        {mediaSize != null && (
          <Text style={mine ? styles.fileSizeMine : styles.fileSizeOther}>{formatFileSize(mediaSize)}</Text>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={() => url && Linking.openURL(url)} style={styles.fileRow}>
      <FileText size={24} color={mine ? '#fff' : '#3d1a28'} />
      <View style={{ flex: 1 }}>
        <Text style={mine ? styles.fileNameMine : styles.fileNameOther} numberOfLines={1}>
          {mediaName ?? 'Файл'}
        </Text>
        {mediaSize != null && (
          <Text style={mine ? styles.fileSizeMine : styles.fileSizeOther}>{formatFileSize(mediaSize)}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: { width: 220, height: 220, borderRadius: 12, backgroundColor: '#0002' },
  imagePlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#0001',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBox: {
    width: 220,
    height: 130,
    borderRadius: 12,
    backgroundColor: '#000a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  videoIcon: { color: '#fff', fontSize: 40, marginBottom: 6 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 200 },
  fileIcon: { fontSize: 28 },
  fileNameMine: { color: '#fff', fontSize: 15, fontWeight: '600' },
  fileNameOther: { color: '#000', fontSize: 15, fontWeight: '600' },
  fileSizeMine: { color: '#cce4ff', fontSize: 12 },
  fileSizeOther: { color: '#777', fontSize: 12 },
  errorMine: { color: '#fff', fontStyle: 'italic' },
  errorOther: { color: '#a00', fontStyle: 'italic' },
});
