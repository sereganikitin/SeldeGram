import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { api } from '../api';
import { Chat, Message } from '../types';
import { useAuth } from '../store/auth';
import { useWs } from '../store/ws';
import { Avatar } from '../ui/Avatar';
import { messagePreview, formatTime } from '../helpers';
import { useColors } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Megaphone, Users, Smile, User, Plus, Phone, Bookmark, Pin, BellOff, Archive, ArchiveRestore } from 'lucide-react-native';
import { StoriesBar } from '../ui/StoriesBar';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

export function ChatListScreen({ navigation }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<Chat[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const patchMembership = async (chatId: string, patch: { pinned?: boolean; muted?: boolean; archived?: boolean }) => {
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, ...patch } : c)));
    try {
      await api.patch(`/chats/${chatId}/membership`, patch);
    } catch {}
  };

  const showChatMenu = (chat: Chat) => {
    Alert.alert(chat.type === 'saved' ? 'Избранное' : chat.title ?? '', undefined, [
      {
        text: chat.pinned ? 'Открепить' : 'Закрепить',
        onPress: () => patchMembership(chat.id, { pinned: !chat.pinned }),
      },
      {
        text: chat.muted ? 'Включить уведомления' : 'Заглушить',
        onPress: () => patchMembership(chat.id, { muted: !chat.muted }),
      },
      {
        text: chat.archived ? 'Из архива' : 'В архив',
        onPress: () => patchMembership(chat.id, { archived: !chat.archived }),
      },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };
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
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={[...chats]
          .filter((c) => (showArchived ? c.archived : !c.archived))
          .sort((a, b) => {
            if (a.type === 'saved' && b.type !== 'saved') return -1;
            if (a.type !== 'saved' && b.type === 'saved') return 1;
            const ap = a.pinned ? 1 : 0;
            const bp = b.pinned ? 1 : 0;
            if (ap !== bp) return bp - ap;
            return 0;
          })}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
        ListHeaderComponent={
          <>
            <StoriesBar />
            {chats.some((c) => c.archived) && (
              <Pressable
                onPress={() => setShowArchived((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                {showArchived ? <ArchiveRestore size={16} color={colors.textMuted} /> : <Archive size={16} color={colors.textMuted} />}
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                  {showArchived ? 'К чатам' : `Архив (${chats.filter((c) => c.archived).length})`}
                </Text>
              </Pressable>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Нет чатов</Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>Нажмите "Новый чат" внизу</Text>
          </View>
        }
        renderItem={({ item }) => {
          // Для direct берём avatarKey второго участника
          const other = item.type === 'direct' ? item.members.find((m) => m.id !== meId) : null;
          const avatarKey = other?.avatarKey ?? null;
          const avatarId = other?.id ?? item.id;
          return (
            <Pressable
              onPress={() => navigation.navigate('Chat', { chatId: item.id, title: item.title ?? 'Chat' })}
              onLongPress={() => showChatMenu(item)}
              delayLongPress={350}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: colors.border, backgroundColor: item.pinned ? colors.surfaceAlt : 'transparent' },
                pressed && { backgroundColor: colors.surfaceAlt },
              ]}
            >
              {item.type === 'saved' ? (
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Bookmark size={22} color="#fff" fill="#fff" />
                </View>
              ) : (
                <Avatar id={avatarId} name={item.title ?? '?'} avatarKey={avatarKey} size={48} />
              )}
              <View style={styles.rowMain}>
                <View style={styles.rowTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 }}>
                    {item.type === 'channel' && <Megaphone size={14} color={colors.primary} />}
                    {item.type === 'group' && <Users size={14} color={colors.primary} />}
                    {item.type === 'saved' && <Bookmark size={14} color={colors.primary} />}
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                      {item.type === 'saved' ? 'Избранное' : item.title}
                    </Text>
                  </View>
                  {item.lastMessage && (
                    <Text style={[styles.time, { color: colors.textMuted }]}>{formatTime(item.lastMessage.createdAt)}</Text>
                  )}
                </View>
                <View style={styles.rowBottom}>
                  <Text style={[styles.preview, { color: colors.textMuted }]} numberOfLines={1}>
                    {previewLine(item.lastMessage, item.lastMessage?.senderId === meId)}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {item.muted && <BellOff size={14} color={colors.textMuted} />}
                    {item.pinned && <Pin size={14} color={colors.primary} />}
                    {!!item.unreadCount && item.unreadCount > 0 && (
                      <View style={[styles.badge, { backgroundColor: item.muted ? colors.textMuted : colors.primary }]}>
                        <Text style={styles.badgeText}>{item.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
      <View
        style={[
          styles.bottomBar,
          { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Pressable onPress={() => navigation.navigate('NewChat')} style={[styles.newBtn, { backgroundColor: colors.primary }]}>
          <Plus size={18} color="#fff" />
          <Text style={styles.newBtnText}>Новый чат</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Stickers')} style={[styles.iconBtn, { backgroundColor: '#ffe8f0', borderColor: colors.border }]}>
          <Smile size={20} color="#e84e76" />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('CallsHistory')} style={[styles.iconBtn, { backgroundColor: '#ffe8f0', borderColor: colors.border }]}>
          <Phone size={20} color="#e84e76" />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Profile')} style={[styles.iconBtn, { backgroundColor: '#ffe8f0', borderColor: colors.border }]}>
          <User size={18} color="#e84e76" />
        </Pressable>
      </View>
    </View>
  );
}

function previewLine(msg: Message | null | undefined, mine: boolean): string {
  if (!msg || msg.deletedAt) return 'Нет сообщений';
  const prefix = mine ? 'Вы: ' : '';
  return prefix + messagePreview(msg);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  rowMain: { flex: 1, justifyContent: 'center' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  title: { fontSize: 16, fontWeight: '600', flex: 1 },
  time: { fontSize: 12, marginLeft: 8 },
  preview: { fontSize: 14, flex: 1 },
  badge: {
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
  emptyText: { fontSize: 18, marginBottom: 8 },
  emptyHint: { fontSize: 14 },
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 12,
  },
  newBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  newBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  iconBtn: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
