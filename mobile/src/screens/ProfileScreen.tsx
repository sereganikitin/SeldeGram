import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { useAuth } from '../store/auth';
import { useTheme, useColors, ThemeMode } from '../theme';
import { api } from '../api';
import { compressImage, uploadMedia } from '../media';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const colors = useColors();
  const user = useAuth((s) => s.user);
  const patchMe = useAuth((s) => s.patchMe);
  const logout = useAuth((s) => s.logout);
  const themeMode = useTheme((s) => s.mode);
  const setThemeMode = useTheme((s) => s.setMode);
  const [name, setName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const saveName = async () => {
    if (!name.trim() || name === user?.displayName) return;
    setSaving(true);
    try {
      const { data } = await api.patch('/me', { displayName: name.trim() });
      patchMe(data);
    } catch (e: any) {
      Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const compressed = await compressImage(result.assets[0].uri);
      const key = await uploadMedia(compressed.uri, compressed.contentType, compressed.size);
      const { data } = await api.patch('/me', { avatarKey: key });
      patchMe(data);
    } catch (e: any) {
      Alert.alert('Не получилось', e.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  if (!user) return null;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <View style={styles.header}>
        <Pressable onPress={pickAvatar}>
          <Avatar id={user.id} name={user.displayName} avatarKey={user.avatarKey} size={120} />
          <Text style={[styles.changePhoto, { color: colors.primary }]}>
            {uploading ? 'Загрузка...' : 'Изменить фото'}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.label, { color: colors.textMuted }]}>Имя</Text>
      <View style={styles.nameRow}>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          value={name}
          onChangeText={setName}
          onEndEditing={saveName}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <Text style={[styles.label, { color: colors.textMuted }]}>@{user.username}</Text>
      <Text style={[styles.label, { color: colors.textMuted, marginBottom: 24 }]}>{user.email}</Text>

      <Text style={[styles.section, { color: colors.text }]}>Тема</Text>
      <View style={styles.themeRow}>
        {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => setThemeMode(m)}
            style={[
              styles.themeChip,
              {
                backgroundColor: themeMode === m ? colors.primary : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={{ color: themeMode === m ? '#fff' : colors.text }}>
              {m === 'system' ? 'Системная' : m === 'light' ? 'Светлая' : 'Тёмная'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.section, { color: colors.text, marginTop: 28 }]}>Обои</Text>
      <Button
        title="Выбрать обои по умолчанию"
        variant="secondary"
        onPress={() => navigation.navigate('WallpaperPicker', {})}
      />

      <View style={{ height: 20 }} />
      <Button
        title="Заблокированные"
        variant="secondary"
        onPress={() => navigation.navigate('BlockList')}
      />

      <View style={{ height: 20 }} />
      <Button title="Выйти" variant="secondary" onPress={logout} />
      {saving && <Text style={{ color: colors.textMuted, marginTop: 12 }}>Сохранение...</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: 24 },
  changePhoto: { fontSize: 14, textAlign: 'center', marginTop: 10 },
  label: { fontSize: 13, marginTop: 12, marginBottom: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 12 },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeChip: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
});
