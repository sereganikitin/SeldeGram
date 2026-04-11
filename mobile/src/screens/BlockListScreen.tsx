import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { api } from '../api';
import { Avatar } from '../ui/Avatar';
import { useColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'BlockList'>;

interface BlockedUser {
  id: string;
  username: string;
  displayName: string;
  avatarKey?: string | null;
}

export function BlockListScreen({}: Props) {
  const colors = useColors();
  const [users, setUsers] = useState<BlockedUser[]>([]);

  const load = useCallback(async () => {
    const { data } = await api.get<BlockedUser[]>('/me/blocks');
    setUsers(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const unblock = async (id: string) => {
    try {
      await api.delete(`/me/blocks/${id}`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (e: any) {
      Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>Никого не заблокировали</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <Avatar id={item.id} name={item.displayName} avatarKey={item.avatarKey} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>{item.displayName}</Text>
              <Text style={[styles.username, { color: colors.textMuted }]}>@{item.username}</Text>
            </View>
            <Pressable onPress={() => unblock(item.id)}>
              <Text style={[styles.unblock, { color: colors.primary }]}>Разблок.</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  name: { fontSize: 16, fontWeight: '600' },
  username: { fontSize: 13, marginTop: 2 },
  unblock: { fontWeight: '600' },
  empty: { textAlign: 'center', padding: 40 },
});
