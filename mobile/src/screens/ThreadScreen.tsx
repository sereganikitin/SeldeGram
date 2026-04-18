import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { api } from '../api';
import { Send } from 'lucide-react-native';
import { Message } from '../types';
import { useAuth } from '../store/auth';
import { useWs } from '../store/ws';
import { useColors } from '../theme';
import { MessageBubble } from '../ui/MessageBubble';

type Props = NativeStackScreenProps<RootStackParamList, 'Thread'>;

export function ThreadScreen({ route }: Props) {
  const { chatId, messageId } = route.params;
  const colors = useColors();
  const meId = useAuth((s) => s.user?.id);
  const [parent, setParent] = useState<Message | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const onMessage = useWs((s) => s.onMessage);

  const load = useCallback(async () => {
    const { data } = await api.get<Message[]>(`/chats/${chatId}/thread/${messageId}`);
    setMessages(data);
  }, [chatId, messageId]);

  useEffect(() => {
    // Загружаем родителя отдельно — берём из основного листа чата
    api.get<Message[]>(`/chats/${chatId}/messages`).then(({ data }) => {
      const p = data.find((m) => m.id === messageId);
      if (p) setParent(p);
    });
    load();
  }, [chatId, messageId, load]);

  // Real-time приём новых комментариев
  useEffect(() => {
    return onMessage((msg) => {
      if (msg.chatId !== chatId) return;
      if (msg.threadOfId !== messageId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });
  }, [chatId, messageId, onMessage]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try {
      await api.post(`/chats/${chatId}/messages`, {
        content: text,
        threadOfId: messageId,
      });
    } catch (e: any) {
      setInput(text);
      Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {parent && (
        <View style={[styles.parentBar, { backgroundColor: colors.surfaceAlt, borderBottomColor: colors.border }]}>
          <Text style={[styles.parentLabel, { color: colors.textMuted }]}>Исходный пост</Text>
          <Text style={[styles.parentText, { color: colors.text }]} numberOfLines={3}>
            {parent.content}
          </Text>
        </View>
      )}
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 40 }}>
            Комментариев пока нет
          </Text>
        }
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            mine={item.senderId === meId}
            showSenderName
            senderName={undefined}
            isRead={false}
            onLongPress={() => undefined}
          />
        )}
      />
      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceAlt }]}
          value={input}
          onChangeText={setInput}
          placeholder="Комментарий..."
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <Pressable onPress={send} disabled={!input.trim() || sending} style={[styles.sendBtn, { backgroundColor: colors.primary }]}>
          <Send size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  parentBar: { padding: 12, borderBottomWidth: 1 },
  parentLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  parentText: { fontSize: 14, marginTop: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: 1, gap: 8 },
  input: { flex: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, maxHeight: 120 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendText: { color: '#fff', fontSize: 22, fontWeight: '700' },
});
