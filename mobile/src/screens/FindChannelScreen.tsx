import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Input } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { api } from '../api';
import { Chat, ChannelSearchResult } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'FindChannel'>;

export function FindChannelScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChannelSearchResult[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get<ChannelSearchResult[]>('/chats/channels/search', {
          params: { q: query },
        });
        setResults(data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const join = async (slug: string) => {
    try {
      const { data } = await api.post<Chat>(`/chats/channel/${encodeURIComponent(slug)}/join`, {});
      navigation.replace('Chat', { chatId: data.id, title: data.title ?? slug });
    } catch (e: any) {
      Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Input
        label="Поиск канала по @slug или названию"
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCapitalize="none"
      />
      <FlatList
        data={results}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => join(item.slug ?? '')} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#f0f0f0' }]}>
            <Avatar id={item.id} name={item.title ?? '?'} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.title}</Text>
              <Text style={styles.meta}>@{item.slug} · {item.memberCount} подписчиков</Text>
            </View>
            <Text style={styles.joinBtn}>Подписаться</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff5f9' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#ffd4e1' },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13, color: '#8c6471', marginTop: 2 },
  joinBtn: { color: '#ff7a99', fontSize: 14, fontWeight: '600' },
});
