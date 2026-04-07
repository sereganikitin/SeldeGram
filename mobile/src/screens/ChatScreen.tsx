import React, { useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { api } from '../api';
import { Message } from '../types';
import { useAuth } from '../store/auth';
import { useWs } from '../store/ws';
import { uploadMedia } from '../media';
import { MediaBubble } from '../ui/MediaBubble';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export function ChatScreen({ route }: Props) {
  const { chatId } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const meId = useAuth((s) => s.user?.id);
  const onMessage = useWs((s) => s.onMessage);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    api.get<Message[]>(`/chats/${chatId}/messages`).then(({ data }) => setMessages(data));
  }, [chatId]);

  useEffect(() => {
    return onMessage((msg) => {
      if (msg.chatId !== chatId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
  }, [chatId, onMessage]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const sendText = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try {
      await api.post(`/chats/${chatId}/messages`, { content: text });
    } catch (e) {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const pickAndSendImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Нет доступа', 'Разрешите доступ к фото в настройках');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const contentType = asset.mimeType ?? 'image/jpeg';
      const size = asset.fileSize ?? 0;
      if (size === 0) throw new Error('Cannot read file size');
      const key = await uploadMedia(asset.uri, contentType, size);
      await api.post(`/chats/${chatId}/messages`, {
        mediaKey: key,
        mediaType: contentType,
        mediaName: asset.fileName ?? 'image.jpg',
        mediaSize: size,
      });
    } catch (e: any) {
      Alert.alert('Не получилось', e.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  const pickAndSendFile = async () => {
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
      });
    } catch (e: any) {
      Alert.alert('Не получилось', e.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  const showAttach = () => {
    Alert.alert('Прикрепить', undefined, [
      { text: 'Фото', onPress: pickAndSendImage },
      { text: 'Файл', onPress: pickAndSendFile },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => {
          const mine = item.senderId === meId;
          const hasMedia = !!item.mediaKey && !!item.mediaType;
          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
              {hasMedia && (
                <MediaBubble
                  mediaKey={item.mediaKey!}
                  mediaType={item.mediaType!}
                  mediaName={item.mediaName}
                  mediaSize={item.mediaSize}
                  mine={mine}
                />
              )}
              {item.content ? (
                <Text style={[mine ? styles.textMine : styles.textOther, hasMedia && { marginTop: 6 }]}>
                  {item.content}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
      <View style={styles.inputBar}>
        <Pressable onPress={showAttach} style={styles.attachBtn} disabled={uploading}>
          {uploading ? <ActivityIndicator /> : <Text style={styles.attachText}>📎</Text>}
        </Pressable>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Сообщение..."
          placeholderTextColor="#999"
          multiline
        />
        <Pressable onPress={sendText} disabled={sending || !input.trim()} style={styles.sendBtn}>
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  bubble: { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, marginVertical: 4 },
  bubbleMine: { backgroundColor: '#0a84ff', alignSelf: 'flex-end' },
  bubbleOther: { backgroundColor: '#eee', alignSelf: 'flex-start' },
  textMine: { color: '#fff', fontSize: 16 },
  textOther: { color: '#000', fontSize: 16 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 8,
  },
  attachBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  attachText: { fontSize: 24 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a84ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendText: { color: '#fff', fontSize: 22, fontWeight: '700' },
});
