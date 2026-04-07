import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Input } from '../ui/Input';
import { api } from '../api';
import { UserSearchResult, Chat } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'NewChat'>;

export function NewChatScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get<UserSearchResult[]>('/users/search', { params: { q: query } });
        setResults(data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const startChat = async (username: string) => {
    try {
      const { data } = await api.post<Chat>('/chats/direct', { username });
      navigation.replace('Chat', { chatId: data.id, title: data.title ?? username });
    } catch (e: any) {
      Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Input label="Поиск по username или имени" value={query} onChangeText={setQuery} autoFocus />
      <FlatList
        data={results}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => startChat(item.username)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#f0f0f0' }]}>
            <Text style={styles.name}>{item.displayName}</Text>
            <Text style={styles.username}>@{item.username}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  name: { fontSize: 16, fontWeight: '600' },
  username: { fontSize: 13, color: '#777', marginTop: 2 },
});
