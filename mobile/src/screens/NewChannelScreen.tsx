import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { api } from '../api';
import { Chat } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'NewChannel'>;

export function NewChannelScreen({ navigation }: Props) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!title.trim() || !slug.trim()) {
      Alert.alert('Заполните название и @slug');
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post<Chat>('/chats/channel', {
        title: title.trim(),
        slug: slug.trim(),
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
      <Input label="Название канала" value={title} onChangeText={setTitle} />
      <Input
        label="Публичный @slug (только латиница и цифры)"
        value={slug}
        onChangeText={setSlug}
        autoCapitalize="none"
      />
      <Text style={styles.hint}>
        По slug ваш канал смогут найти другие пользователи. Изменить нельзя.
      </Text>
      <Button title="Создать канал" onPress={create} loading={creating} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  hint: { fontSize: 13, color: '#888', marginBottom: 16 },
});
