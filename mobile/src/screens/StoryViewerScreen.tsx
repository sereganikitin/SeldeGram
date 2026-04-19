import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { X, Trash2 } from 'lucide-react-native';
import { RootStackParamList } from '../navigation';
import { api } from '../api';
import { getMediaUrl } from '../media';
import { useAuth } from '../store/auth';
import { Avatar } from '../ui/Avatar';

type Props = NativeStackScreenProps<RootStackParamList, 'StoryViewer'>;

interface StoryAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
}
interface Story {
  id: string;
  mediaKey: string;
  mediaType: string;
  createdAt: string;
  expiresAt: string;
}
interface StoryGroup {
  author: StoryAuthor;
  stories: Story[];
}

const STORY_DURATION_MS = 5000;

export function StoryViewerScreen({ route, navigation }: Props) {
  const { startIdx } = route.params;
  const meId = useAuth((s) => s.user?.id);

  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [gIdx, setGIdx] = useState(startIdx);
  const [sIdx, setSIdx] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    api.get<StoryGroup[]>('/stories')
      .then(({ data }) => setGroups(data))
      .catch(() => undefined);
  }, [navigation]);

  const group = groups[gIdx];
  const story = group?.stories[sIdx];
  const isMine = group?.author.id === meId;

  useEffect(() => {
    setSIdx(0);
  }, [gIdx]);

  useEffect(() => {
    if (!story) return;
    let cancelled = false;
    setMediaUrl(null);
    getMediaUrl(story.mediaKey).then((u) => {
      if (!cancelled) setMediaUrl(u);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [story?.id]);

  const next = useCallback(() => {
    if (!group) return;
    if (sIdx + 1 < group.stories.length) {
      setSIdx(sIdx + 1);
    } else if (gIdx + 1 < groups.length) {
      setGIdx(gIdx + 1);
    } else {
      navigation.goBack();
    }
  }, [group, sIdx, gIdx, groups.length, navigation]);

  const prev = useCallback(() => {
    if (sIdx > 0) {
      setSIdx(sIdx - 1);
    } else if (gIdx > 0) {
      const newG = gIdx - 1;
      setGIdx(newG);
      setTimeout(() => setSIdx(Math.max(0, (groups[newG]?.stories.length ?? 1) - 1)), 0);
    }
  }, [sIdx, gIdx, groups]);

  useEffect(() => {
    if (!story || !mediaUrl || paused) return;
    startRef.current = Date.now() - progress * STORY_DURATION_MS;
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const p = Math.min(1, elapsed / STORY_DURATION_MS);
      setProgress(p);
      if (p >= 1) {
        setProgress(0);
        next();
        return;
      }
      rafRef.current = requestAnimationFrame(tick) as unknown as number;
    };
    rafRef.current = requestAnimationFrame(tick) as unknown as number;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [story?.id, mediaUrl, paused, next]);

  useEffect(() => {
    setProgress(0);
  }, [story?.id]);

  const deleteStory = async () => {
    if (!story) return;
    Alert.alert('Удалить историю?', '', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/stories/${story.id}`);
            if ((group?.stories.length ?? 0) <= 1) {
              navigation.goBack();
            } else {
              setGroups((prev) => prev.map((g) =>
                g.author.id === group!.author.id
                  ? { ...g, stories: g.stories.filter((s) => s.id !== story.id) }
                  : g,
              ));
              next();
            }
          } catch {
            Alert.alert('Не получилось');
          }
        },
      },
    ]);
  };

  if (!group || !story) {
    return (
      <View style={styles.backdrop}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.backdrop}>
      {/* Прогресс-бары */}
      <View style={styles.progressRow}>
        {group.stories.map((s, i) => (
          <View key={s.id} style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: i < sIdx ? '100%' : i === sIdx ? `${Math.round(progress * 100)}%` : '0%' },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Шапка */}
      <View style={styles.header}>
        <Avatar
          id={group.author.id}
          name={group.author.displayName}
          avatarKey={group.author.avatarKey}
          size={36}
        />
        <Text style={styles.name} numberOfLines={1}>{group.author.displayName}</Text>
        {isMine && (
          <Pressable onPress={deleteStory} style={styles.headerBtn}>
            <Trash2 size={20} color="#fff" />
          </Pressable>
        )}
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <X size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Медиа + тап-зоны */}
      <Pressable
        style={styles.leftTap}
        onPress={prev}
        onPressIn={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
      />
      <Pressable
        style={styles.rightTap}
        onPress={next}
        onPressIn={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
      />

      <View style={styles.mediaWrap} pointerEvents="none">
        {mediaUrl ? (
          <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="contain" />
        ) : (
          <ActivityIndicator color="#fff" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  progressRow: {
    position: 'absolute',
    top: 44,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  progressTrack: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff' },
  header: {
    position: 'absolute',
    top: 54,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  name: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaWrap: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  media: { width: '100%', height: '100%' },
  leftTap: { position: 'absolute', top: 100, bottom: 0, left: 0, width: '35%', zIndex: 5 },
  rightTap: { position: 'absolute', top: 100, bottom: 0, right: 0, width: '35%', zIndex: 5 },
});
