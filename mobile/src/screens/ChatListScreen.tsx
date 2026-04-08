import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { api } from '../api';
import { Chat, Message } from '../types';
import { useAuth } from '../store/auth';
import { useWs } from '../store/ws';
import { Avatar } from '../ui/Avatar';
import { messagePreview, formatTime } from '../helpers';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

export function ChatListScreen({ navigation }: Props) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const meId = useAuth((s) => s.user?.id);
  const logout = useAuth((s) => s.logout);
  const connect = useWs((s) => s.connect);
  const onMessage = useWs((s) => s.onMessage);
  const onChatUpdated = useWs((s) => s.onChatUpdated);
  const onChatDeleted = useWs((s) => s.onChatDeleted);
  const onDeleted = useWs((s) => s.onDeleted);
  const onEdited = useWs((s) => s.onEdited);
  const onRead = useWs((s) => s.onRead);

  const load = async () => {
    const { data } = await api.get<Chat[]>('/chats');
    setChats(data);
  };

  useEffect(() => {
    load();
    connect();
  }, [connect]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  useEffect(() => {
    return onChatUpdated(() => load());
  }, [onChatUpdated]);

  useEffect(() => {
    return onChatDeleted((chatId) => {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
    });
  }, [onChatDeleted]);

  useEffect(() => {
    return onMessage((msg) => {
      setChats((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.chatId);
        if (idx === -1) {
          load();
          return prev;
        }
        const isMine = msg.senderId === meId;
        const updated: Chat = {
          ...prev[idx],
          lastMessage: msg,
          unreadCount: isMine ? prev[idx].unreadCount ?? 0 : (prev[idx].unreadCount ?? 0) + 1,
        };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });
    });
  }, [meId, onMessage]);

  useEffect(() => {
    return onEdited((msg) => {
      setChats((prev) =>
        prev.map((c) => (c.lastMessage?.id === msg.id ? { ...c, lastMessage: msg } : c)),
      );
    });
  }, [onEdited]);

  useEffect(() => {
    return onRead((chatId, userId) => {
      if (userId !== meId) return;
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)));
    });
  }, [meId, onRead]);

  useEffect(() => {
    return onDeleted((chatId, messageId) => {
      setChats((prev) =>
        prev.map((c) =>
          c.lastMessage?.id === messageId
            ? { ...c, lastMessage: { ...c.lastMessage!, deletedAt: new Date().toISOString() } }
            : c,
        ),
      );
    });
  }, [onDeleted]);

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
            <Avatar id={item.id} name={item.title ?? '?'} size={48} />
            <View style={styles.rowMain}>
              <View style={styles.rowTop}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.lastMessage && (
                  <Text style={styles.time}>{formatTime(item.lastMessage.createdAt)}</Text>
                )}
              </View>
              <View style={styles.rowBottom}>
                <Text style={styles.preview} numberOfLines={1}>
                  {previewLine(item.lastMessage, item.lastMessage?.senderId === meId)}
                </Text>
                {!!item.unreadCount && item.unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unreadCount}</Text>
                  </View>
                )}
              </View>
            </View>
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

function previewLine(msg: Message | null | undefined, mine: boolean): string {
  if (!msg) return 'Нет сообщений';
  const prefix = mine ? 'Вы: ' : '';
  return prefix + messagePreview(msg);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
    gap: 12,
  },
  rowMain: { flex: 1, justifyContent: 'center' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  title: { fontSize: 16, fontWeight: '600', flex: 1 },
  time: { fontSize: 12, color: '#888', marginLeft: 8 },
  preview: { fontSize: 14, color: '#777', flex: 1 },
  badge: {
    backgroundColor: '#0a84ff',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, color: '#888', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#aaa' },
  bottomBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#eee', padding: 12, gap: 12 },
  newBtn: { flex: 1, backgroundColor: '#0a84ff', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  newBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  logoutBtn: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: '#ddd' },
  logoutText: { color: '#666', fontSize: 14 },
});
