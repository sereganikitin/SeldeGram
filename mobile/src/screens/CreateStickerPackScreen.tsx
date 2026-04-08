import React, { useState } from 'react';
import { View, StyleSheet, Alert, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { api } from '../api';
import { StickerPack } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateStickerPack'>;

export function CreateStickerPackScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!name.trim() || !slug.trim()) {
      Alert.alert('Заполните название и slug');
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post<StickerPack>('/stickers/packs', {
        name: name.trim(),
        slug: slug.trim(),
      });
      navigation.replace('StickerPack', { packId: data.id });
    } catch (e: any) {
      Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Input label="Название пака" value={name} onChangeText={setName} />
      <Input label="@slug (латиница)" value={slug} onChangeText={setSlug} autoCapitalize="none" />
      <Text style={styles.hint}>После создания вы сможете добавлять в пак стикеры</Text>
      <Button title="Создать" onPress={create} loading={creating} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  hint: { fontSize: 13, color: '#888', marginBottom: 16 },
});
