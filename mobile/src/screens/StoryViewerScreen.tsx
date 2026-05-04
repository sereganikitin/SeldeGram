import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { X, Trash2, Eye } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
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
  stories: (Story & { viewedByMe?: boolean; viewsCount?: number })[];
  hasUnseen?: boolean;
}

interface Viewer {
  user: StoryAuthor;
  viewedAt: string;
}

const PHOTO_DURATION_MS = 5000;

export function StoryViewerScreen({ route, navigation }: Props) {
  const { startIdx } = route.params;
  const meId = useAuth((s) => s.user?.id);

  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [gIdx, setGIdx] = useState(startIdx);
  const [sIdx, setSIdx] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [showViewers, setShowViewers] = useState(false);
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const videoRef = useRef<Video | null>(null);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    api.get<StoryGroup[]>('/stories')
      .then(({ data }) => setGroups(data))
      .catch(() => undefined);
  }, [navigation]);

  const group = groups[gIdx];
  const story = group?.stories[sIdx];
  const isMine = group?.author.id === meId;
  const isVideo = !!story?.mediaType.startsWith('video/');
  const durationMs = isVideo && videoDurationMs ? videoDurationMs : PHOTO_DURATION_MS;

  useEffect(() => {
    setSIdx(0);
  }, [gIdx]);

  useEffect(() => {
    if (!story) return;
    let cancelled = false;
    setMediaUrl(null);
    setVideoDurationMs(null);
    setViewers(null);
    setShowViewers(false);
    getMediaUrl(story.mediaKey).then((u) => {
      if (!cancelled) setMediaUrl(u);
    }).catch(() => undefined);
    if (!isMine) {
      api.post(`/stories/${story.id}/view`).catch(() => undefined);
    }
    return () => { cancelled = true; };
  }, [story?.id, isMine]);

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
    if (isVideo && !videoDurationMs) return;
    startRef.current = Date.now() - progress * durationMs;
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const p = Math.min(1, elapsed / durationMs);
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
  }, [story?.id, mediaUrl, paused, next, isVideo, videoDurationMs, durationMs]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (paused) videoRef.current.pauseAsync().catch(() => undefined);
    else videoRef.current.playAsync().catch(() => undefined);
  }, [paused]);

  const openViewers = async () => {
    if (!story) return;
    if (showViewers) {
      setShowViewers(false);
      setPaused(false);
      return;
    }
    setShowViewers(true);
    setPaused(true);
    try {
      const { data } = await api.get<Viewer[]>(`/stories/${story.id}/viewers`);
      setViewers(data);
    } catch {}
  };

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
          <>
            <Pressable onPress={openViewers} style={styles.viewersBtn}>
              <Eye size={16} color="#fff" />
              <Text style={styles.viewersBtnText}>{story.viewsCount ?? 0}</Text>
            </Pressable>
            <Pressable onPress={deleteStory} style={styles.headerBtn}>
              <Trash2 size={20} color="#fff" />
            </Pressable>
          </>
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
        {!mediaUrl ? (
          <ActivityIndicator color="#fff" />
        ) : isVideo ? (
          <Video
            ref={videoRef}
            source={{ uri: mediaUrl }}
            style={styles.media}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping={false}
            onLoad={(status) => {
              if (status.isLoaded && status.durationMillis) {
                setVideoDurationMs(status.durationMillis);
              }
            }}
          />
        ) : (
          <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="contain" />
        )}
      </View>

      {/* Лист зрителей */}
      {showViewers && (
        <View style={styles.viewersSheet}>
          <View style={styles.viewersHeader}>
            <Eye size={18} color="#ff7a99" />
            <Text style={styles.viewersTitle}>Просмотры {viewers ? `· ${viewers.length}` : ''}</Text>
            <Pressable
              onPress={() => { setShowViewers(false); setPaused(false); }}
              style={{ marginLeft: 'auto' }}
            >
              <X size={20} color="#3d1a28" />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 320 }}>
            {viewers === null ? (
              <Text style={styles.viewersEmpty}>Загрузка...</Text>
            ) : viewers.length === 0 ? (
              <Text style={styles.viewersEmpty}>Пока никто не посмотрел</Text>
            ) : (
              viewers.map((v) => (
                <View key={v.user.id} style={styles.viewerRow}>
                  <Avatar id={v.user.id} name={v.user.displayName} avatarKey={v.user.avatarKey} size={36} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.viewerName} numberOfLines={1}>{v.user.displayName}</Text>
                    <Text style={styles.viewerUsername}>@{v.user.username}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      )}
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
  viewersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  viewersBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  viewersSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 16,
    zIndex: 20,
  },
  viewersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#ffd4e1',
  },
  viewersTitle: { fontSize: 15, fontWeight: '700', color: '#3d1a28' },
  viewersEmpty: { textAlign: 'center', color: '#8c6471', paddingVertical: 24 },
  viewerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  viewerName: { fontSize: 14, fontWeight: '600', color: '#3d1a28' },
  viewerUsername: { fontSize: 12, color: '#8c6471' },
});
