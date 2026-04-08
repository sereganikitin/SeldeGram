import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { api } from '../api';
import { Chat } from '../types';
import { Avatar } from '../ui/Avatar';

type Props = NativeStackScreenProps<RootStackParamList, 'Forward'>;

export function ForwardScreen({ route, navigation }: Props) {
  const { messageId } = route.params;
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    api.get<Chat[]>('/chats').then(({ data }) => setChats(data));
  }, []);

  const send = async (chat: Chat) => {
    try {
      await api.post(`/chats/${chat.id}/messages`, { forwardedFromId: messageId });
      navigation.replace('Chat', { chatId: chat.id, title: chat.title ?? 'Чат' });
    } catch (e: any) {
      Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Переслать в...</Text>
      <FlatList
        data={chats}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => send(item)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#f0f0f0' }]}>
            <Avatar id={item.id} name={item.title ?? '?'} size={40} />
            <Text style={styles.title}>{item.title}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { fontSize: 14, color: '#666', padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 16, fontWeight: '600' },
});
