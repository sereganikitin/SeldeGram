import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Audio } from 'expo-av';

interface Props {
  onRecorded: (uri: string, durationMs: number) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onRecorded, onCancel }: Props) {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    start();
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const start = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Нет доступа к микрофону');
        onCancel();
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      Alert.alert('Не удалось начать запись');
      onCancel();
    }
  };

  const stop = async () => {
    timerRef.current && clearInterval(timerRef.current);
    const rec = recordingRef.current;
    if (!rec) return onCancel();
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      const status = await rec.getStatusAsync();
      const durationMs = status.durationMillis ?? seconds * 1000;
      if (uri) {
        onRecorded(uri, durationMs);
      } else {
        onCancel();
      }
    } catch {
      onCancel();
    }
    recordingRef.current = null;
  };

  const cancel = async () => {
    timerRef.current && clearInterval(timerRef.current);
    recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    recordingRef.current = null;
    onCancel();
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.recDot} />
      <Text style={styles.time}>{fmt(seconds)}</Text>
      <View style={{ flex: 1 }} />
      <Pressable onPress={cancel} style={styles.cancelBtn}>
        <Text style={styles.cancelText}>Отмена</Text>
      </Pressable>
      <Pressable onPress={stop} style={styles.stopBtn}>
        <Text style={styles.stopText}>⏹</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#f00' },
  time: { fontSize: 16, fontWeight: '600', color: '#333', fontVariant: ['tabular-nums'] },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  cancelText: { color: '#888', fontSize: 14 },
  stopBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#5fe3d4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopText: { fontSize: 20, color: '#fff' },
});
