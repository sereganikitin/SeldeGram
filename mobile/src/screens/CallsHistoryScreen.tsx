import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react-native';
import { RootStackParamList } from '../navigation';
import { api } from '../api';
import { useAuth } from '../store/auth';
import { useCall } from '../store/call';
import { Avatar } from '../ui/Avatar';
import { useColors } from '../theme';
import { formatTime } from '../helpers';

type Props = NativeStackScreenProps<RootStackParamList, 'CallsHistory'>;

interface CallPeer {
  id: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
}

interface CallRecord {
  id: string;
  callerId: string;
  calleeId: string;
  kind: 'audio' | 'video';
  status: 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended';
  startedAt: string;
  acceptedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  caller: CallPeer;
  callee: CallPeer;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function statusLabel(r: CallRecord, isIncoming: boolean): string {
  if (r.status === 'ended' && r.durationSec != null) return formatDuration(r.durationSec);
  if (r.status === 'missed') return isIncoming ? 'Пропущенный' : 'Нет ответа';
  if (r.status === 'rejected') return 'Отклонён';
  if (r.status === 'ringing') return 'В процессе';
  return 'Завершён';
}

export function CallsHistoryScreen({ navigation }: Props) {
  const colors = useColors();
  const meId = useAuth((s) => s.user?.id);
  const [items, setItems] = useState<CallRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get<CallRecord[]>('/calls');
      setItems(data);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const callBack = (peer: CallPeer) => {
    useCall.getState().initiate(peer, 'audio');
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: colors.textMuted }}>Звонков ещё не было</Text>
          </View>
        }
        renderItem={({ item: r }) => {
          const isIncoming = r.calleeId === meId;
          const peer = isIncoming ? r.caller : r.callee;
          const isMissed = isIncoming && (r.status === 'missed' || r.status === 'rejected');
          const DirIcon = isMissed ? PhoneMissed : isIncoming ? PhoneIncoming : PhoneOutgoing;
          return (
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <Avatar id={peer.id} name={peer.displayName} avatarKey={peer.avatarKey} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: isMissed ? '#dc2626' : colors.text }]} numberOfLines={1}>
                  {peer.displayName}
                </Text>
                <View style={styles.meta}>
                  <DirIcon size={12} color={isMissed ? '#dc2626' : colors.primary} />
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    {statusLabel(r, isIncoming)} · {formatTime(r.startedAt)}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => callBack(peer)} style={[styles.callBtn, { backgroundColor: colors.primary }]}>
                <Phone size={18} color="#fff" />
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 12 },
  callBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingTop: 60, alignItems: 'center' },
});
