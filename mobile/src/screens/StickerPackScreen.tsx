import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, TextInput, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { api } from '../api';
import { StickerPack } from '../types';
import { StickerImage } from '../ui/StickerImage';
import { Button } from '../ui/Button';
import { uploadMedia } from '../media';
import { useAuth } from '../store/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'StickerPack'>;

export function StickerPackScreen({ route, navigation }: Props) {
  const { packId } = route.params;
  const meId = useAuth((s) => s.user?.id);
  const [pack, setPack] = useState<StickerPack | null>(null);
  const [installed, setInstalled] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [emojiModal, setEmojiModal] = useState<{ uri: string; size: number; mimeType: string } | null>(null);
  const [emoji, setEmoji] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get<StickerPack>(`/stickers/packs/${packId}`);
    setPack(data);
    const my = await api.get<StickerPack[]>('/stickers/my');
    setInstalled(my.data.some((p) => p.id === packId));
  }, [packId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isAuthor = pack?.authorId === meId;

  const install = async () => {
    await api.post(`/stickers/packs/${packId}/install`, {});
    await load();
  };
  const uninstall = async () => {
    await api.delete(`/stickers/packs/${packId}/install`);
    await load();
  };

  const pickAndUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/png', 'image/webp', 'image/jpeg', 'video/webm'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    let mimeType = asset.mimeType ?? 'image/png';
    if (!asset.mimeType && asset.name?.toLowerCase().endsWith('.webm')) mimeType = 'video/webm';
    setEmojiModal({ uri: asset.uri, size: asset.size ?? 0, mimeType });
    setEmoji('');
  };

  const confirmAdd = async () => {
    if (!emojiModal || !emoji) return;
    setUploading(true);
    try {
      const key = await uploadMedia(emojiModal.uri, emojiModal.mimeType, emojiModal.size);
      await api.post(`/stickers/packs/${packId}/stickers`, {
        mediaKey: key,
        mediaType: emojiModal.mimeType,
        emoji,
      });
      setEmojiModal(null);
      setEmoji('');
      await load();
    } catch (e: any) {
      Alert.alert('Не получилось', e.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  const removeSticker = (stickerId: string) => {
    Alert.alert('Удалить стикер?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await api.delete(`/stickers/packs/${packId}/stickers/${stickerId}`);
          await load();
        },
      },
    ]);
  };

  const deletePack = () => {
    Alert.alert('Удалить пак?', 'Будет удалён у всех пользователей', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await api.delete(`/stickers/packs/${packId}`);
          navigation.goBack();
        },
      },
    ]);
  };

  if (!pack) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{pack.name}</Text>
        <Text style={styles.slug}>@{pack.slug} · {pack.stickers.length} стикеров</Text>
      </View>

      <FlatList
        data={pack.stickers}
        keyExtractor={(s) => s.id}
        numColumns={3}
        renderItem={({ item }) => (
          <Pressable
            onLongPress={isAuthor ? () => removeSticker(item.id) : undefined}
            style={styles.cell}
          >
            <StickerImage mediaKey={item.mediaKey} mediaType={item.mediaType} size={90} />
            <Text style={styles.cellEmoji}>{item.emoji}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Стикеров пока нет</Text>}
      />

      <View style={styles.actions}>
        {isAuthor && <Button title="+ Добавить стикер" onPress={pickAndUpload} loading={uploading} />}
        {!installed ? (
          <Button title="Установить" onPress={install} variant="secondary" />
        ) : (
          <Button title="Удалить из своих" onPress={uninstall} variant="secondary" />
        )}
        {isAuthor && <Button title="Удалить пак" onPress={deletePack} variant="secondary" />}
      </View>

      <Modal visible={!!emojiModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Эмодзи для стикера</Text>
            <TextInput
              style={styles.modalInput}
              value={emoji}
              onChangeText={setEmoji}
              placeholder="😀"
              maxLength={4}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Отмена" variant="secondary" onPress={() => setEmojiModal(null)} />
              <Button title="Добавить" onPress={confirmAdd} loading={uploading} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  header: { alignItems: 'center', marginBottom: 16 },
  name: { fontSize: 22, fontWeight: '700' },
  slug: { fontSize: 13, color: '#777', marginTop: 4 },
  cell: { flex: 1 / 3, alignItems: 'center', padding: 8 },
  cellEmoji: { fontSize: 18, marginTop: 4 },
  empty: { textAlign: 'center', color: '#aaa', padding: 30 },
  actions: { gap: 10, marginTop: 12 },
  modalBg: { flex: 1, backgroundColor: '#0007', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '80%', gap: 12 },
  modalTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 24,
    textAlign: 'center',
  },
});
