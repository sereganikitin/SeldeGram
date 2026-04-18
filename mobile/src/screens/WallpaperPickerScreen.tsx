import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { WALLPAPER_PRESETS } from '../wallpapers';
import { api } from '../api';
import { compressImage, uploadMedia } from '../media';
import { useAuth } from '../store/auth';
import { useColors } from '../theme';
import { Button } from '../ui/Button';

type Props = NativeStackScreenProps<RootStackParamList, 'WallpaperPicker'>;

export function WallpaperPickerScreen({ route, navigation }: Props) {
  const { chatId } = route.params;
  const colors = useColors();
  const patchMe = useAuth((s) => s.patchMe);
  const [uploading, setUploading] = useState(false);

  const apply = async (value: string | null) => {
    try {
      if (chatId) {
        await api.patch(`/chats/${chatId}/wallpaper`, { wallpaper: value });
      } else {
        await api.patch('/me', { defaultWallpaper: value });
        patchMe({ defaultWallpaper: value });
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Не получилось', e.response?.data?.message ?? e.message);
    }
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const compressed = await compressImage(result.assets[0].uri);
      const key = await uploadMedia(compressed.uri, compressed.contentType, compressed.size);
      await apply(`media:${key}`);
    } catch (e: any) {
      Alert.alert('Не получилось', e.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.section, { color: colors.textMuted }]}>
        {chatId ? 'Обои для этого чата' : 'Обои по умолчанию'}
      </Text>

      <View style={styles.grid}>
        {WALLPAPER_PRESETS.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => apply(p.id === 'default' ? null : `preset:${p.id}`)}
            style={[styles.tile, { backgroundColor: p.color2 ?? p.color1, borderColor: colors.border, overflow: 'hidden' }]}
          >
            {p.patternSvg && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <SvgXml
                  xml={p.patternSvg}
                  width="100%"
                  height="100%"
                  preserveAspectRatio="xMidYMid slice"
                />
              </View>
            )}
            <Text style={styles.tileLabel}>{p.name}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ padding: 16 }}>
        <Button title="Загрузить своё фото" onPress={pickPhoto} loading={uploading} />
      </View>

      {chatId && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          <Button title="Сбросить (как по умолчанию)" variant="secondary" onPress={() => apply(null)} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { fontSize: 13, padding: 16, paddingBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  tile: {
    width: '46%',
    aspectRatio: 1.2,
    margin: '2%',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'flex-end',
    padding: 10,
  },
  tileLabel: {
    color: '#fff',
    fontWeight: '600',
    textShadowColor: '#0008',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
