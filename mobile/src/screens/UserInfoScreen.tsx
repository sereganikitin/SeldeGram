import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { api } from '../api';
import { Chat } from '../types';
import { useAuth } from '../store/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'UserInfo'>;

export function UserInfoScreen({ route, navigation }: Props) {
  const { chatId } = route.params;
  const meId = useAuth((s) => s.user?.id);
  const [chat, setChat] = useState<Chat | null>(null);

  const load = useCallback(async () => {
    const { data } = await api.get<Chat>(`/chats/${chatId}`);
    setChat(data);
  }, [chatId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const other = chat?.members.find((m) => m.id !== meId);

  const deleteChat = () => {
    Alert.alert('Удалить чат?', 'Чат и сообщения будут удалены у обоих участников.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/chats/${chatId}`);
            navigation.popToTop();
          } catch (e: any) {
            Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
          }
        },
      },
    ]);
  };

  if (!chat || !other) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Avatar id={other.id} name={other.displayName} size={100} />
        <Text style={styles.name}>{other.displayName}</Text>
        <Text style={styles.username}>@{other.username}</Text>
      </View>
      <Button
        title="🖼 Обои чата"
        variant="secondary"
        onPress={() => navigation.navigate('WallpaperPicker', { chatId })}
      />
      <View style={{ height: 10 }} />
      <Button title="Удалить чат" variant="secondary" onPress={deleteChat} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { alignItems: 'center', marginVertical: 30, gap: 12 },
  name: { fontSize: 24, fontWeight: '700' },
  username: { fontSize: 16, color: '#777' },
});
