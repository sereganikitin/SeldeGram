import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Button } from '../ui/Button';
import { api } from '../api';
import { Chat, UserSearchResult } from '../types';
import { useAuth } from '../store/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupInfo'>;

export function GroupInfoScreen({ route, navigation }: Props) {
  const { chatId } = route.params;
  const meId = useAuth((s) => s.user?.id);
  const [chat, setChat] = useState<Chat | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<UserSearchResult[]>([]);

  const load = useCallback(async () => {
    const { data } = await api.get<Chat>(`/chats/${chatId}`);
    setChat(data);
    setTitleDraft(data.title ?? '');
  }, [chatId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isAdmin = chat?.viewerRole === 'admin';

  const saveTitle = async () => {
    if (!titleDraft.trim()) return;
    try {
      await api.patch(`/chats/${chatId}`, { title: titleDraft.trim() });
      setEditingTitle(false);
      await load();
    } catch (e: any) {
      Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
    }
  };

  const searchToAdd = async (q: string) => {
    setAddQuery(q);
    if (!q.trim()) {
      setAddResults([]);
      return;
    }
    try {
      const { data } = await api.get<UserSearchResult[]>('/users/search', { params: { q } });
      setAddResults(data.filter((u) => !chat?.members.some((m) => m.id === u.id)));
    } catch {}
  };

  const addUser = async (username: string) => {
    try {
      await api.post(`/chats/${chatId}/members`, { username });
      setAdding(false);
      setAddQuery('');
      setAddResults([]);
      await load();
    } catch (e: any) {
      Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
    }
  };

  const removeUser = (userId: string, isMe: boolean) => {
    Alert.alert(
      isMe ? 'Покинуть группу?' : 'Удалить участника?',
      undefined,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: isMe ? 'Покинуть' : 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/chats/${chatId}/members/${userId}`);
              if (isMe) {
                navigation.popToTop();
              } else {
                await load();
              }
            } catch (e: any) {
              Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
            }
          },
        },
      ],
    );
  };

  if (!chat) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {editingTitle ? (
          <View style={styles.titleEdit}>
            <TextInput
              style={styles.titleInput}
              value={titleDraft}
              onChangeText={setTitleDraft}
              autoFocus
              onSubmitEditing={saveTitle}
            />
            <Pressable onPress={saveTitle}>
              <Text style={styles.saveBtn}>✓</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => isAdmin && setEditingTitle(true)}
            disabled={!isAdmin}
          >
            <Text style={styles.title}>{chat.title}</Text>
            {isAdmin && <Text style={styles.editHint}>нажмите для редактирования</Text>}
          </Pressable>
        )}
        <Text style={styles.subtitle}>{chat.members.length} участников</Text>
      </View>

      {isAdmin && !adding && (
        <Button title="+ Добавить участника" variant="secondary" onPress={() => setAdding(true)} />
      )}

      {adding && (
        <View style={styles.addBox}>
          <TextInput
            style={styles.addInput}
            placeholder="Поиск по username..."
            value={addQuery}
            onChangeText={searchToAdd}
            autoFocus
            autoCapitalize="none"
          />
          <FlatList
            data={addResults}
            keyExtractor={(u) => u.id}
            style={{ maxHeight: 200 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => addUser(item.username)} style={styles.addRow}>
                <Text>{item.displayName} <Text style={styles.username}>@{item.username}</Text></Text>
              </Pressable>
            )}
          />
          <Button title="Отмена" variant="secondary" onPress={() => { setAdding(false); setAddQuery(''); }} />
        </View>
      )}

      <FlatList
        data={chat.members}
        keyExtractor={(m) => m.id}
        style={{ flex: 1, marginTop: 16 }}
        renderItem={({ item }) => {
          const isMe = item.id === meId;
          const canRemove = isMe || isAdmin;
          return (
            <View style={styles.memberRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>
                  {item.displayName} {isMe && <Text style={styles.you}>(вы)</Text>}
                </Text>
                <Text style={styles.username}>
                  @{item.username} {item.role === 'admin' && '· админ'}
                </Text>
              </View>
              {canRemove && (
                <Pressable onPress={() => removeUser(item.id, isMe)}>
                  <Text style={styles.removeBtn}>{isMe ? 'Выйти' : '✕'}</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  editHint: { fontSize: 11, color: '#999', textAlign: 'center', marginTop: 2 },
  subtitle: { fontSize: 14, color: '#777', marginTop: 6 },
  titleEdit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderColor: '#0a84ff',
    minWidth: 200,
    textAlign: 'center',
  },
  saveBtn: { fontSize: 26, color: '#0a84ff' },
  addBox: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 12, marginBottom: 8 },
  addInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: '#fff' },
  addRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  memberName: { fontSize: 16, fontWeight: '600' },
  you: { color: '#0a84ff', fontWeight: '400' },
  username: { fontSize: 13, color: '#777', marginTop: 2 },
  removeBtn: { color: '#d00', fontSize: 14, fontWeight: '600' },
});
