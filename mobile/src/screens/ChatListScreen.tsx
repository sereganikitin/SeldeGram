import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { api } from '../api';
import { Chat, Message } from '../types';

function previewText(msg?: Message | null): string {
  if (!msg) return 'Нет сообщений';
  if (msg.content) return msg.content;
  if (msg.mediaType?.startsWith('image/')) return '📷 Фото';
  if (msg.mediaKey) return '📄 Файл';
  return '';
}
import { useAuth } from '../store/auth';
import { useWs } from '../store/ws';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

export function ChatListScreen({ navigation }: Props) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const logout = useAuth((s) => s.logout);
  const connect = useWs((s) => s.connect);
  const onMessage = useWs((s) => s.onMessage);

  const load = async () => {
    const { data } = await api.get<Chat[]>('/chats');
    setChats(data);
  };

  useEffect(() => {
    load();
    connect();
  }, [connect]);

  // Обновлять список при возврате с экрана чата
  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  // Если в фоне приходит сообщение — поднимаем чат вверх и обновляем lastMessage
  useEffect(() => {
    return onMessage((msg) => {
      setChats((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.chatId);
        if (idx === -1) {
          load();
          return prev;
        }
        const updated = { ...prev[idx], lastMessage: msg };
        const next = [updated, ...prev.filter((_, i) => i !== idx)];
        return next;
      });
    });
  }, [onMessage]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={chats}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Нет чатов</Text>
            <Text style={styles.emptyHint}>Нажмите "Новый чат" внизу</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate('Chat', { chatId: item.id, title: item.title ?? 'Chat' })
            }
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#f0f0f0' }]}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.preview} numberOfLines={1}>
              {previewText(item.lastMessage)}
            </Text>
          </Pressable>
        )}
      />
      <View style={styles.bottomBar}>
        <Pressable onPress={() => navigation.navigate('NewChat')} style={styles.newBtn}>
          <Text style={styles.newBtnText}>+ Новый чат</Text>
        </Pressable>
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Выйти</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  preview: { fontSize: 14, color: '#777' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, color: '#888', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#aaa' },
  bottomBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#eee', padding: 12, gap: 12 },
  newBtn: { flex: 1, backgroundColor: '#0a84ff', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  newBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  logoutBtn: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: '#ddd' },
  logoutText: { color: '#666', fontSize: 14 },
});
