import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import { getMediaUrl } from '../media';
import { Play, Pause } from 'lucide-react-native';

interface Props {
  mediaKey: string;
  duration?: number;
  mine: boolean;
}

export function AudioPlayer({ mediaKey, duration, mine }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [totalMs, setTotalMs] = useState(duration ?? 0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getMediaUrl(mediaKey).then((u) => !cancelled && setUrl(u)).catch(() => {});
    return () => {
      cancelled = true;
      soundRef.current?.unloadAsync();
    };
  }, [mediaKey]);

  const toggle = async () => {
    if (!url) return;
    // Синхронный lock: игнорируем повторные нажатия пока предыдущая операция не завершилась.
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      if (soundRef.current) {
        if (playing) {
          await soundRef.current.pauseAsync();
        } else {
          await soundRef.current.playAsync();
        }
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setPlaying(status.isPlaying);
          setPosition(status.positionMillis ?? 0);
          if (status.durationMillis) setTotalMs(status.durationMillis);
          if (status.didJustFinish) {
            setPlaying(false);
            setPosition(0);
            soundRef.current?.setPositionAsync(0);
          }
        },
      );
      soundRef.current = sound;
    } finally {
      busyRef.current = false;
    }
  };

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = totalMs > 0 ? position / totalMs : 0;

  return (
    <View style={styles.container}>
      <Pressable onPress={toggle} style={[styles.playBtn, { backgroundColor: mine ? '#fff3' : '#ff7a9922' }]}>
        {playing
          ? <Pause size={18} color={mine ? '#fff' : '#ff7a99'} fill={mine ? '#fff' : '#ff7a99'} />
          : <Play size={18} color={mine ? '#fff' : '#ff7a99'} fill={mine ? '#fff' : '#ff7a99'} />}
      </Pressable>
      <View style={styles.waveArea}>
        <View style={styles.waveTrack}>
          <View style={[styles.waveFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: mine ? '#fff' : '#ff7a99' }]} />
        </View>
        <Text style={[styles.time, { color: mine ? '#ffd4e1' : '#8c6471' }]}>
          {playing ? fmt(position) : fmt(totalMs)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180 },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: { fontSize: 16 },
  waveArea: { flex: 1 },
  waveTrack: { height: 4, backgroundColor: '#0002', borderRadius: 2, overflow: 'hidden' },
  waveFill: { height: '100%', borderRadius: 2 },
  time: { fontSize: 11, marginTop: 4 },
});
