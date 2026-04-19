import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Plus } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { useAuth } from '../store/auth';
import { Avatar } from './Avatar';
import { uploadMedia, compressImage } from '../media';
import { useColors } from '../theme';
import type { RootStackParamList } from '../navigation';

export interface StoryAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
}

export interface Story {
  id: string;
  mediaKey: string;
  mediaType: string;
  createdAt: string;
  expiresAt: string;
}

export interface StoryGroup {
  author: StoryAuthor;
  stories: Story[];
}

export function StoriesBar() {
  const colors = useColors();
  const me = useAuth((s) => s.user);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<StoryGroup[]>('/stories');
      setGroups(data);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, 60_000);
      return () => clearInterval(id);
    }, [load]),
  );

  const myGroup = groups.find((g) => g.author.id === me?.id);
  const others = groups.filter((g) => g.author.id !== me?.id);

  const pickAndUpload = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]) return;
    setUploading(true);
    try {
      const compressed = await compressImage(res.assets[0].uri);
      const key = await uploadMedia(compressed.uri, compressed.contentType, compressed.size);
      await api.post('/stories', { mediaKey: key, mediaType: compressed.contentType });
      await load();
    } catch (e: any) {
      Alert.alert('Не получилось', e.message ?? 'Ошибка');
    } finally {
      setUploading(false);
    }
  };

  const openViewer = (idx: number) => {
    nav.navigate('StoryViewer', { startIdx: idx });
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={[styles.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
    >
      {/* Моя история */}
      <Pressable
        onPress={() => {
          if (myGroup) {
            const idx = groups.findIndex((g) => g.author.id === me?.id);
            openViewer(idx);
          } else {
            pickAndUpload();
          }
        }}
        style={styles.cell}
        disabled={uploading}
      >
        <View style={[styles.ringWrap, myGroup ? styles.ringActive : null]}>
          <View style={[styles.innerPad, { backgroundColor: colors.surface }]}>
            <Avatar id={me?.id ?? ''} name={me?.displayName ?? '?'} avatarKey={me?.avatarKey} size={52} />
          </View>
          <View style={[styles.plusBadge, { borderColor: colors.surface }]}>
            {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Plus size={12} color="#fff" strokeWidth={3} />}
          </View>
        </View>
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {uploading ? '...' : 'Вы'}
        </Text>
      </Pressable>

      {others.map((g) => {
        const idx = groups.findIndex((x) => x.author.id === g.author.id);
        return (
          <Pressable key={g.author.id} onPress={() => openViewer(idx)} style={styles.cell}>
            <View style={[styles.ringWrap, styles.ringActive]}>
              <View style={[styles.innerPad, { backgroundColor: colors.surface }]}>
                <Avatar id={g.author.id} name={g.author.displayName} avatarKey={g.author.avatarKey} size={52} />
              </View>
            </View>
            <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
              {g.author.displayName.split(' ')[0]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: 1 },
  container: { gap: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  cell: { alignItems: 'center', width: 64 },
  ringWrap: { padding: 2, borderRadius: 999, position: 'relative' },
  ringActive: { backgroundColor: '#ff7a99' },
  innerPad: { padding: 2, borderRadius: 999 },
  plusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff7a99',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  label: { fontSize: 11, marginTop: 4, maxWidth: 60 },
});
