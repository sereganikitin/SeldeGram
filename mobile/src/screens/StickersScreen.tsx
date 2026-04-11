import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { api } from '../api';
import { StickerPack, StickerPackSearchResult } from '../types';
import { StickerImage } from '../ui/StickerImage';
import { Button } from '../ui/Button';

type Props = NativeStackScreenProps<RootStackParamList, 'Stickers'>;

export function StickersScreen({ navigation }: Props) {
  const [my, setMy] = useState<StickerPack[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StickerPackSearchResult[]>([]);

  const load = useCallback(async () => {
    const { data } = await api.get<StickerPack[]>('/stickers/my');
    setMy(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const search = async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    try {
      const { data } = await api.get<StickerPackSearchResult[]>('/stickers/packs/search', {
        params: { q },
      });
      setResults(data);
    } catch {}
  };

  const install = async (id: string) => {
    try {
      await api.post(`/stickers/packs/${id}/install`, {});
      Alert.alert('Установлено');
      await load();
    } catch (e: any) {
      Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="+ Создать пак" onPress={() => navigation.navigate('CreateStickerPack')} />

      <Text style={styles.section}>Мои паки</Text>
      <FlatList
        data={my}
        keyExtractor={(p) => p.id}
        horizontal={false}
        ListEmptyComponent={<Text style={styles.empty}>Пока ничего нет</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('StickerPack', { packId: item.id })}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#f0f0f0' }]}
          >
            {item.coverKey ? (
              <StickerImage mediaKey={item.coverKey} size={50} />
            ) : (
              <View style={styles.coverPh} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>@{item.slug} · {item.stickers.length} стикеров</Text>
            </View>
          </Pressable>
        )}
      />

      <Text style={styles.section}>Поиск</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Название или @slug"
        value={query}
        onChangeText={search}
        autoCapitalize="none"
      />
      <FlatList
        data={results}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row}>
            {item.coverKey ? (
              <StickerImage mediaKey={item.coverKey} size={50} />
            ) : (
              <View style={styles.coverPh} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>@{item.slug} · {item._count.stickers} стикеров</Text>
            </View>
            <Pressable onPress={() => install(item.id)}>
              <Text style={styles.installBtn}>Установить</Text>
            </Pressable>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff5f9' },
  section: { fontSize: 14, fontWeight: '600', color: '#8c6471', marginTop: 16, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ffd4e1',
  },
  coverPh: { width: 50, height: 50, backgroundColor: '#eee', borderRadius: 8 },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13, color: '#8c6471', marginTop: 2 },
  installBtn: { color: '#ff7a99', fontWeight: '600' },
  empty: { color: '#b59aa4', textAlign: 'center', padding: 12 },
  searchInput: { borderWidth: 1, borderColor: '#ffd4e1', borderRadius: 10, padding: 12, fontSize: 16 },
});
