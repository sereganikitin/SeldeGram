import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ActionSheetIOS,
  Clipboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { api } from '../api';
import { Chat, ChatRead, Message } from '../types';
import { useAuth } from '../store/auth';
import { useWs } from '../store/ws';
import { uploadMedia, compressImage } from '../media';
import { setActiveChat } from '../push';
import { MessageBubble } from '../ui/MessageBubble';
import { DateSeparator } from '../ui/DateSeparator';
import { StickerPicker } from '../ui/StickerPicker';
import { VoiceRecorder } from '../ui/VoiceRecorder';
import { ChatBackground } from '../ui/ChatBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../theme';
import { formatDateLabel, messagePreview, lastSeenText } from '../helpers';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

type ListItem =
  | { kind: 'msg'; message: Message }
  | { kind: 'date'; id: string; label: string };

function buildItems(messages: Message[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDate = '';
  for (const m of messages) {
    if (m.deletedAt) continue;
    const day = new Date(m.createdAt).toDateString();
    if (day !== lastDate) {
      items.push({ kind: 'date', id: 'd-' + day, label: formatDateLabel(m.createdAt) });
      lastDate = day;
    }
    items.push({ kind: 'msg', message: m });
  }
  return items;
}

export function ChatScreen({ route, navigation }: Props) {
  const { chatId } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [reads, setReads] = useState<ChatRead[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [pinnedMsg, setPinnedMsg] = useState<Message | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [peerOnline, setPeerOnline] = useState<boolean | undefined>(undefined);
  const [peerLastSeen, setPeerLastSeen] = useState<string | null>(null);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const myUser = useAuth((s) => s.user);
  const meId = useAuth((s) => s.user?.id);
  const onMessage = useWs((s) => s.onMessage);
  const onEdited = useWs((s) => s.onEdited);
  const onDeleted = useWs((s) => s.onDeleted);
  const onRead = useWs((s) => s.onRead);
  const onTyping = useWs((s) => s.onTyping);
  const onPinned = useWs((s) => s.onPinned);
  const onPresence = useWs((s) => s.onPresence);
  const listRef = useRef<FlatList<ListItem>>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  // Загрузка чата + сообщений + reads + pinned + peer key
  useEffect(() => {
    api.get<Message[]>(`/chats/${chatId}/messages`).then(({ data }) => setMessages(data));
    api.get<Chat>(`/chats/${chatId}`).then(({ data }) => {
      setChat(data);
      // Загружаем publicKey собеседника в direct-чатах
      if (data.type === 'direct') {
        const other = data.members.find((m) => m.id !== meId);
        if (other) {
          setPeerOnline(other.isOnline);
          setPeerLastSeen(other.lastSeenAt ?? null);
        }
      }
    });
    api.get<ChatRead[]>(`/chats/${chatId}/reads`).then(({ data }) => setReads(data));
    api.get<Message | null>(`/chats/${chatId}/pinned`).then(({ data }) => setPinnedMsg(data));
    setActiveChat(chatId);
    return () => setActiveChat(null);
  }, [chatId, meId]);

  // WS: реакции — слушаем через raw WS
  useEffect(() => {
    const ws = useWs.getState().socket;
    if (!ws) return;
    const handler = (event: { data: string }) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message:reactions' && data.payload.chatId === chatId) {
          const { messageId: mid, reactions } = data.payload;
          setMessages((prev) => prev.map((m) => m.id === mid ? { ...m, reactions } : m));
        }
      } catch {}
    };
    ws.addEventListener('message', handler as any);
    return () => ws.removeEventListener('message', handler as any);
  }, [chatId]);

  // WS: статус собеседника
  useEffect(() => {
    if (chat?.type !== 'direct') return;
    const other = chat.members.find((m) => m.id !== meId);
    if (!other) return;
    return onPresence((userId, online, lastSeenAt) => {
      if (userId === other.id) {
        setPeerOnline(online);
        setPeerLastSeen(lastSeenAt);
      }
    });
  }, [chat?.type, chat?.members, meId, onPresence]);


  // WS: pin/unpin
  useEffect(() => {
    return onPinned((cid, messageId) => {
      if (cid !== chatId) return;
      if (!messageId) {
        setPinnedMsg(null);
        return;
      }
      api.get<Message | null>(`/chats/${chatId}/pinned`).then(({ data }) => setPinnedMsg(data));
    });
  }, [chatId, onPinned]);

  // Подмена заголовка с онлайн-статусом
  useEffect(() => {
    if (!chat?.title) return;
    if (chat.type === 'direct' && peerOnline !== undefined) {
      const status = peerOnline ? ' 🟢' : '';
      navigation.setOptions({ title: chat.title + status });
    } else {
      navigation.setOptions({ title: chat.title });
    }
  }, [chat?.title, chat?.type, peerOnline, navigation]);

  // Обработчик header кнопки info — выбираем экран по типу чата
  useEffect(() => {
    if (!chat) return;
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
          <Pressable onPress={() => setSearchOpen((v) => !v)}>
            <Text style={{ fontSize: 18, color: '#ff7a99', paddingHorizontal: 8 }}>🔎</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (chat.type === 'direct') navigation.navigate('UserInfo', { chatId });
              else navigation.navigate('GroupInfo', { chatId });
            }}
          >
            <Text style={{ fontSize: 20, color: '#ff7a99', paddingHorizontal: 8 }}>ⓘ</Text>
          </Pressable>
        </View>
      ),
    });
  }, [chat, chatId, navigation]);

  // WS: новые сообщения
  useEffect(() => {
    return onMessage((msg) => {
      if (msg.chatId !== chatId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });
  }, [chatId, onMessage]);

  // WS: редактирование
  useEffect(() => {
    return onEdited((msg) => {
      if (msg.chatId !== chatId) return;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    });
  }, [chatId, onEdited]);

  // WS: удаление
  useEffect(() => {
    return onDeleted((cid, mid) => {
      if (cid !== chatId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === mid
            ? { ...m, content: '', mediaKey: null, mediaType: null, deletedAt: new Date().toISOString() }
            : m,
        ),
      );
    });
  }, [chatId, onDeleted]);

  // WS: read receipts
  useEffect(() => {
    return onRead((cid, userId, lastReadAt) => {
      if (cid !== chatId) return;
      setReads((prev) => {
        const others = prev.filter((r) => r.userId !== userId);
        return [...others, { userId, lastReadAt }];
      });
    });
  }, [chatId, onRead]);

  // WS: typing
  useEffect(() => {
    return onTyping((cid, userId) => {
      if (cid !== chatId || userId === meId) return;
      setTypingUserId(userId);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setTypingUserId(null), 3000);
    });
  }, [chatId, meId, onTyping]);

  // Скролл вниз при новых сообщениях
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  // Поиск с debounce
  useEffect(() => {
    if (!searchOpen || !searchQ.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get<Message[]>(`/chats/${chatId}/search`, { params: { q: searchQ } });
        setSearchResults(data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [chatId, searchOpen, searchQ]);

  // Отметить прочитанным самое последнее сообщение (независимо от отправителя)
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    api.post(`/chats/${chatId}/read`, { messageId: last.id }).catch(() => undefined);
  }, [chatId, messages]);

  const items = useMemo(() => buildItems(messages), [messages]);

  // Минимум lastReadAt среди других участников — нужно чтобы показать ✓✓ на своих сообщениях
  const minOtherLastRead = useMemo(() => {
    const others = reads.filter((r) => r.userId !== meId);
    if (others.length === 0) return 0;
    return Math.min(...others.map((r) => new Date(r.lastReadAt).getTime()));
  }, [reads, meId]);

  const senderNameById = useMemo(() => {
    const map = new Map<string, string>();
    chat?.members.forEach((m) => map.set(m.id, m.displayName));
    return map;
  }, [chat]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    const replyId = replyTo?.id;
    setReplyTo(null);
    try {
      if (editingId) {
        await api.patch(`/chats/${chatId}/messages/${editingId}`, { content: text });
        setEditingId(null);
      } else {
        await api.post(`/chats/${chatId}/messages`, { content: text, replyToId: replyId });
      }
    } catch (e) {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const onInputChange = (text: string) => {
    setInput(text);
    const now = Date.now();
    if (now - lastTypingSentRef.current > 1500) {
      lastTypingSentRef.current = now;
      api.post(`/chats/${chatId}/typing`, {}).catch(() => undefined);
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Нет доступа', 'Разрешите доступ к фото в настройках');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const compressed = await compressImage(asset.uri);
      const key = await uploadMedia(compressed.uri, compressed.contentType, compressed.size);
      await api.post(`/chats/${chatId}/messages`, {
        mediaKey: key,
        mediaType: compressed.contentType,
        mediaName: asset.fileName ?? 'image.jpg',
        mediaSize: compressed.size,
        replyToId: replyTo?.id,
      });
      setReplyTo(null);
    } catch (e: any) {
      Alert.alert('Не получилось', e.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const contentType = asset.mimeType ?? 'application/octet-stream';
      const size = asset.size ?? 0;
      if (size === 0) throw new Error('Cannot read file size');
      const key = await uploadMedia(asset.uri, contentType, size);
      await api.post(`/chats/${chatId}/messages`, {
        mediaKey: key,
        mediaType: contentType,
        mediaName: asset.name,
        mediaSize: size,
        replyToId: replyTo?.id,
      });
      setReplyTo(null);
    } catch (e: any) {
      Alert.alert('Не получилось', e.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  const sendVoice = async (uri: string, durationMs: number) => {
    setRecording(false);
    setUploading(true);
    try {
      const contentType = 'audio/m4a';
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const size = blob.size;
      const key = await uploadMedia(uri, contentType, size);
      await api.post(`/chats/${chatId}/messages`, {
        mediaKey: key,
        mediaType: contentType,
        mediaName: 'voice.m4a',
        mediaSize: durationMs,
      });
    } catch (e: any) {
      Alert.alert('Не получилось', e.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  const sendSticker = async (stickerId: string) => {
    setStickersOpen(false);
    try {
      await api.post(`/chats/${chatId}/messages`, { stickerId });
    } catch (e: any) {
      Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
    }
  };

  const createPoll = () => {
    Alert.prompt('Опрос', 'Введите вопрос:', (question) => {
      if (!question?.trim()) return;
      Alert.prompt('Варианты', 'Введите варианты через ; (минимум 2):', async (optStr) => {
        const options = (optStr ?? '').split(';').map((s: string) => s.trim()).filter(Boolean);
        if (options.length < 2) { Alert.alert('Нужно минимум 2 варианта'); return; }
        try {
          await api.post(`/chats/${chatId}/poll`, { question: question.trim(), options });
        } catch (e: any) {
          Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
        }
      });
    });
  };

  const showAttach = () => {
    Alert.alert('Прикрепить', undefined, [
      { text: 'Фото', onPress: pickImage },
      { text: 'Файл', onPress: pickFile },
      { text: '📊 Опрос', onPress: createPoll },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  const onMessageLongPress = (msg: Message) => {
    const mine = msg.senderId === meId;
    const canPin = chat?.type === 'direct' || chat?.viewerRole === 'admin';
    const isChannelPost = chat?.type === 'channel' && !msg.threadOfId;
    const quickReactions = ['❤️', '👍', '😂', '😮', '😢', '🔥'];
    const options: { text: string; onPress?: () => void; style?: 'destructive' | 'cancel' }[] = [
      ...quickReactions.map((emoji) => ({
        text: emoji,
        onPress: () => api.post(`/chats/${chatId}/messages/${msg.id}/react`, { emoji }).catch(() => undefined),
      })),
      { text: 'Ответить', onPress: () => setReplyTo(msg) },
      { text: 'Переслать', onPress: () => navigation.navigate('Forward', { messageId: msg.id }) },
    ];
    if (isChannelPost) {
      options.push({
        text: '💬 Комментарии',
        onPress: () => navigation.navigate('Thread', { chatId, messageId: msg.id }),
      });
    }
    if (canPin) {
      options.push({
        text: pinnedMsg?.id === msg.id ? 'Открепить' : 'Закрепить',
        onPress: () => {
          if (pinnedMsg?.id === msg.id) {
            api.delete(`/chats/${chatId}/pin`).catch((e) =>
              Alert.alert('Не получилось', e.response?.data?.message ?? e.message),
            );
          } else {
            api.post(`/chats/${chatId}/pin/${msg.id}`).catch((e) =>
              Alert.alert('Не получилось', e.response?.data?.message ?? e.message),
            );
          }
        },
      });
    }
    if (msg.content) {
      options.push({
        text: 'Копировать',
        onPress: () => {
          // @ts-ignore Clipboard deprecated but works
          Clipboard.setString(msg.content);
        },
      });
    }
    if (mine && msg.content && !msg.deletedAt) {
      options.push({
        text: 'Изменить',
        onPress: () => {
          setEditingId(msg.id);
          setInput(msg.content);
        },
      });
    }
    if (mine && !msg.deletedAt) {
      options.push({
        text: 'Удалить',
        style: 'destructive',
        onPress: () =>
          api.delete(`/chats/${chatId}/messages/${msg.id}`).catch((e) =>
            Alert.alert('Не получилось', e.response?.data?.message ?? e.message),
          ),
      });
    }
    options.push({ text: 'Отмена', style: 'cancel' });
    Alert.alert('Действия', undefined, options);
  };

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === 'date') return <DateSeparator label={item.label} />;
      const msg = item.message;
      const mine = msg.senderId === meId;
      const isRead = mine && new Date(msg.createdAt).getTime() <= minOtherLastRead;
      const showSenderName = chat?.type !== 'direct';
      return (
        <MessageBubble
          message={msg}
          mine={mine}
          showSenderName={showSenderName}
          senderName={senderNameById.get(msg.senderId)}
          isRead={isRead}
          onLongPress={() => onMessageLongPress(msg)}
        />
      );
    },
    [chat?.type, meId, minOtherLastRead, senderNameById],
  );

  const typingName = typingUserId ? senderNameById.get(typingUserId) : null;

  const wallpaper = chat?.viewerWallpaper ?? myUser?.defaultWallpaper ?? null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ChatBackground wallpaper={wallpaper}>
      {pinnedMsg && !pinnedMsg.deletedAt && (
        <Pressable
          style={[styles.pinnedBar, { backgroundColor: colors.surfaceAlt, borderBottomColor: colors.border }]}
          onPress={() => {
            const idx = messages.findIndex((m) => m.id === pinnedMsg.id);
            if (idx !== -1) {
              const itemIdx = items.findIndex((it) => it.kind === 'msg' && it.message.id === pinnedMsg.id);
              if (itemIdx !== -1) listRef.current?.scrollToIndex({ index: itemIdx, animated: true });
            }
          }}
        >
          <Text style={[styles.pinnedLabel, { color: colors.primary }]}>📌 Закреплённое</Text>
          <Text style={[styles.pinnedText, { color: colors.text }]} numberOfLines={1}>
            {pinnedMsg.content || '📷 Медиа'}
          </Text>
        </Pressable>
      )}
      {searchOpen && (
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TextInput
            value={searchQ}
            onChangeText={setSearchQ}
            placeholder="Поиск по сообщениям"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text, backgroundColor: colors.surfaceAlt }]}
            autoFocus
          />
          {searchResults.length > 0 && (
            <FlatList
              data={searchResults}
              keyExtractor={(m) => m.id}
              style={styles.searchResults}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.searchResultRow}
                  onPress={() => {
                    setSearchOpen(false);
                    setSearchQ('');
                    const itemIdx = items.findIndex((it) => it.kind === 'msg' && it.message.id === item.id);
                    if (itemIdx !== -1) listRef.current?.scrollToIndex({ index: itemIdx, animated: true });
                  }}
                >
                  <Text style={{ color: colors.text }} numberOfLines={2}>
                    {item.content}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {senderNameById.get(item.senderId) ?? ''}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>
      )}
      {typingName && (
        <View style={[styles.typingBar, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.typingText, { color: colors.primary }]}>{typingName} печатает...</Text>
        </View>
      )}
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => (item.kind === 'msg' ? item.message.id : item.id)}
        contentContainerStyle={{ padding: 12 }}
        renderItem={renderItem}
      />

      {(replyTo || editingId) && (
        <View style={styles.replyBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.replyLabel}>{editingId ? 'Изменение' : 'Ответ'}</Text>
            <Text style={styles.replyContent} numberOfLines={1}>
              {editingId ? input : messagePreview(replyTo!)}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setReplyTo(null);
              setEditingId(null);
              if (editingId) setInput('');
            }}
          >
            <Text style={styles.replyClose}>✕</Text>
          </Pressable>
        </View>
      )}

      {chat?.type === 'channel' && chat.viewerRole !== 'admin' ? (
        <View style={[styles.readOnlyBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Text style={styles.readOnlyText}>Только админы могут писать в канал</Text>
        </View>
      ) : (
        <>
          <View
            style={[
              styles.inputBar,
              {
                paddingBottom:
                  stickersOpen || recording ? 10 : Math.max(insets.bottom, 10),
              },
            ]}
          >
            <Pressable
              onPress={showAttach}
              style={[styles.attachBtn, { backgroundColor: colors.surfaceAlt }]}
              disabled={uploading || !!editingId}
            >
              {uploading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.attachText}>📎</Text>}
            </Pressable>
            <Pressable
              onPress={() => setStickersOpen((v) => !v)}
              style={[styles.attachBtn, { backgroundColor: colors.surfaceAlt }]}
              disabled={!!editingId}
            >
              <Text style={styles.attachText}>{stickersOpen ? '⌨' : '😀'}</Text>
            </Pressable>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border }]}
              value={input}
              onChangeText={onInputChange}
              placeholder={editingId ? 'Изменить сообщение...' : 'Сообщение...'}
              placeholderTextColor={colors.textMuted}
              multiline
              onFocus={() => setStickersOpen(false)}
            />
            {input.trim() || editingId ? (
              <Pressable onPress={send} disabled={sending || !input.trim()} style={styles.sendBtn}>
                <Text style={styles.sendText}>{editingId ? '✓' : '↑'}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setRecording(true)} disabled={uploading} style={styles.sendBtn}>
                <Text style={styles.sendText}>🎤</Text>
              </Pressable>
            )}
          </View>
          {recording && (
            <VoiceRecorder
              onRecorded={sendVoice}
              onCancel={() => setRecording(false)}
            />
          )}
          {stickersOpen && !recording && <StickerPicker onPick={sendSticker} onClose={() => setStickersOpen(false)} />}
        </>
      )}
      </ChatBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  typingBar: { paddingHorizontal: 16, paddingVertical: 4, backgroundColor: '#ffe8f0' },
  typingText: { fontSize: 12, color: '#ff7a99', fontStyle: 'italic' },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffe8f0',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    gap: 12,
  },
  replyLabel: { fontSize: 12, color: '#ff7a99', fontWeight: '600' },
  replyContent: { fontSize: 13, color: '#555', marginTop: 2 },
  replyClose: { fontSize: 18, color: '#8c6471', paddingHorizontal: 8 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ffd4e1',
    backgroundColor: '#fff',
    gap: 6,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachText: { fontSize: 22 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ff7a99',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  readOnlyBar: { padding: 14, borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'center' },
  readOnlyText: { color: '#8c6471', fontSize: 14 },
  pinnedBar: { paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1 },
  pinnedLabel: { fontSize: 11, fontWeight: '700' },
  pinnedText: { fontSize: 13, marginTop: 2 },
  searchBar: { borderBottomWidth: 1, padding: 10 },
  searchInput: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  searchResults: { maxHeight: 200, marginTop: 8 },
  searchResultRow: { paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#0001' },
});
