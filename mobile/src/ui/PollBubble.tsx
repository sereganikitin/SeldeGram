import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { api } from '../api';
import { useAuth } from '../store/auth';

interface PollData {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, number>;
  totalVotes: number;
  counts: number[];
}

interface Props {
  messageId: string;
  mine: boolean;
}

export function PollBubble({ messageId, mine }: Props) {
  const meId = useAuth((s) => s.user?.id);
  const [poll, setPoll] = useState<PollData | null>(null);

  useEffect(() => {
    api.get<PollData | null>(`/messages/${messageId}/poll`).then(({ data }) => setPoll(data));
  }, [messageId]);

  const vote = async (idx: number) => {
    if (!poll) return;
    try {
      const { data } = await api.post<PollData>(`/polls/${poll.id}/vote`, { optionIdx: idx });
      setPoll(data);
    } catch {}
  };

  if (!poll) return null;

  const myVote = meId ? poll.votes[meId] : undefined;

  return (
    <View style={styles.container}>
      <Text style={[styles.question, { color: mine ? '#fff' : '#000' }]}>{poll.question}</Text>
      {poll.options.map((opt: string, i: number) => {
        const pct = poll.totalVotes > 0 ? Math.round((poll.counts[i] / poll.totalVotes) * 100) : 0;
        const isMyVote = myVote === i;
        return (
          <Pressable key={i} onPress={() => vote(i)} style={styles.option}>
            <View style={[styles.bar, { width: `${pct}%`, backgroundColor: mine ? '#fff3' : '#5fe3d422' }]} />
            <Text style={[styles.optText, { color: mine ? '#fff' : '#333' }, isMyVote && styles.bold]}>
              {isMyVote ? '✓ ' : ''}{opt}
            </Text>
            <Text style={[styles.pct, { color: mine ? '#cce4ff' : '#888' }]}>{pct}%</Text>
          </Pressable>
        );
      })}
      <Text style={[styles.total, { color: mine ? '#cce4ff' : '#888' }]}>
        {poll.totalVotes} голосов
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minWidth: 220 },
  question: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 8 },
  optText: { flex: 1, fontSize: 14, zIndex: 1 },
  bold: { fontWeight: '700' },
  pct: { fontSize: 12, zIndex: 1, marginLeft: 8 },
  total: { fontSize: 11, marginTop: 4 },
});
