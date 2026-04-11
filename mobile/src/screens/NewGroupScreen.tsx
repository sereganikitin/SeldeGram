import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { api } from '../api';
import { Chat, UserSearchResult } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'NewGroup'>;

export function NewGroupScreen({ navigation }: Props) {
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [selected, setSelected] = useState<UserSearchResult[]>([]);
  const [creating, setCreating] = useState(false);

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

  const toggle = (u: UserSearchResult) => {
    setSelected((prev) =>
      prev.some((x) => x.id === u.id) ? prev.filter((x) => x.id !== u.id) : [...prev, u],
    );
  };

  const create = async () => {
    if (!title.trim()) {
      Alert.alert('Введите название группы');
      return;
    }
    if (selected.length === 0) {
      Alert.alert('Добавьте хотя бы одного участника');
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post<Chat>('/chats/group', {
        title: title.trim(),
        memberUsernames: selected.map((u) => u.username),
      });
      navigation.replace('Chat', { chatId: data.id, title: data.title ?? title });
    } catch (e: any) {
      Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Input label="Название группы" value={title} onChangeText={setTitle} />

      {selected.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {selected.map((u) => (
            <Pressable key={u.id} onPress={() => toggle(u)} style={styles.chip}>
              <Text style={styles.chipText}>{u.displayName} ✕</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Input label="Добавить участников" value={query} onChangeText={setQuery} />
      <FlatList
        data={results}
        keyExtractor={(u) => u.id}
        style={{ flex: 1 }}
        renderItem={({ item }) => {
          const isSelected = selected.some((u) => u.id === item.id);
          return (
            <Pressable
              onPress={() => toggle(item)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#f0f0f0' }]}
            >
              <Avatar id={item.id} name={item.displayName} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.displayName}</Text>
                <Text style={styles.username}>@{item.username}</Text>
              </View>
              <Text style={styles.check}>{isSelected ? '✓' : ''}</Text>
            </Pressable>
          );
        }}
      />

      <Button title={`Создать группу (${selected.length})`} onPress={create} loading={creating} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff5f9' },
  chips: { flexGrow: 0, marginBottom: 12 },
  chip: { backgroundColor: '#ff7a99', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 },
  chipText: { color: '#fff', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ffd4e1',
    gap: 12,
  },
  name: { fontSize: 16, fontWeight: '600' },
  username: { fontSize: 13, color: '#8c6471', marginTop: 2 },
  check: { fontSize: 22, color: '#ff7a99', width: 30, textAlign: 'right' },
});
