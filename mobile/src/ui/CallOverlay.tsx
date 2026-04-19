import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { Audio } from 'expo-av';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react-native';
import { useCall } from '../store/call';
import { Avatar } from './Avatar';
// Рингтоны лежат в public/sounds/ веб-приложения.
const RINGTONE_URL = 'https://app.pinkcrab.ru/sounds/ringtone.mp3';
const DIALING_URL = 'https://app.pinkcrab.ru/sounds/dialing.mp3';

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

export function CallOverlay() {
  const state = useCall((s) => s.state);
  const peer = useCall((s) => s.peer);
  const kind = useCall((s) => s.kind);
  const muted = useCall((s) => s.muted);
  const speakerOn = useCall((s) => s.speakerOn);
  const isCaller = useCall((s) => s.isCaller);
  const acceptedAt = useCall((s) => s.acceptedAt);
  const error = useCall((s) => s.error);
  const accept = useCall((s) => s.acceptIncoming);
  const reject = useCall((s) => s.rejectIncoming);
  const hangup = useCall((s) => s.hangup);
  const toggleMute = useCall((s) => s.toggleMute);
  const toggleSpeaker = useCall((s) => s.toggleSpeaker);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (state !== 'active') return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [state]);

  // Рингтон
  useEffect(() => {
    if (state !== 'incoming-ringing' && state !== 'outgoing-ringing') return;
    const url = state === 'incoming-ringing' ? RINGTONE_URL : DIALING_URL;
    let sound: Audio.Sound | null = null;
    let cancelled = false;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
        });
        const { sound: s } = await Audio.Sound.createAsync(
          { uri: url },
          { isLooping: true, volume: 0.7, shouldPlay: true },
        );
        if (cancelled) { s.unloadAsync().catch(() => undefined); return; }
        sound = s;
      } catch (e) {
        console.log('[call] ringtone error', e);
      }
    })();
    return () => {
      cancelled = true;
      if (sound) {
        sound.stopAsync().catch(() => undefined);
        sound.unloadAsync().catch(() => undefined);
      }
    };
  }, [state]);

  const visible = state !== 'idle' && state !== 'ended' && !!peer;

  if (!visible || !peer) return null;

  const statusLabel =
    state === 'outgoing-ringing'
      ? 'Звоним...'
      : state === 'incoming-ringing'
        ? 'Входящий звонок'
        : state === 'connecting'
          ? 'Соединение...'
          : acceptedAt
            ? formatDuration(now - acceptedAt)
            : 'В разговоре';

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Avatar id={peer.id} name={peer.displayName || peer.username} avatarKey={peer.avatarKey} size={120} />
          <Text style={styles.name}>{peer.displayName || peer.username}</Text>
          <Text style={styles.status}>
            {kind === 'video' ? 'Видеозвонок' : 'Аудиозвонок'} · {statusLabel}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.buttons}>
            {state === 'incoming-ringing' ? (
              <>
                <Pressable onPress={reject} style={[styles.bigBtn, styles.btnDanger]}>
                  <PhoneOff size={28} color="#fff" />
                </Pressable>
                <Pressable onPress={accept} style={[styles.bigBtn, styles.btnSuccess]}>
                  <Phone size={28} color="#fff" />
                </Pressable>
              </>
            ) : (
              <>
                {(state === 'active' || state === 'connecting') && (
                  <>
                    <Pressable onPress={toggleMute} style={[styles.midBtn, muted && styles.btnActive]}>
                      {muted ? <MicOff size={22} color="#e84e76" /> : <Mic size={22} color="#fff" />}
                    </Pressable>
                    <Pressable onPress={toggleSpeaker} style={[styles.midBtn, speakerOn && styles.btnActive]}>
                      {speakerOn ? <Volume2 size={22} color="#e84e76" /> : <VolumeX size={22} color="#fff" />}
                    </Pressable>
                  </>
                )}
                <Pressable onPress={hangup} style={[styles.bigBtn, styles.btnDanger]}>
                  <PhoneOff size={28} color="#fff" />
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ff7a99',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
  },
  name: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 18, textAlign: 'center' },
  status: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 6 },
  error: { color: '#ffcccc', fontSize: 13, marginTop: 10, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 20, alignItems: 'center', marginTop: 32 },
  bigBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  midBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  btnDanger: { backgroundColor: '#dc2626' },
  btnSuccess: { backgroundColor: '#16a34a' },
  btnActive: { backgroundColor: '#fff' },
});
