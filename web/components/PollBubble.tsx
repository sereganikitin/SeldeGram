"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";

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
    <div className="min-w-[220px]">
      <div className={`text-sm font-bold mb-2 ${mine ? "text-white" : "dark:text-white"}`}>{poll.question}</div>
      {poll.options.map((opt: string, i: number) => {
        const pct = poll.totalVotes > 0 ? Math.round((poll.counts[i] / poll.totalVotes) * 100) : 0;
        const isMyVote = myVote === i;
        return (
          <button
            key={i}
            onClick={() => vote(i)}
            className="w-full flex items-center rounded-lg px-3 py-2 mb-1 relative overflow-hidden hover:opacity-90 text-left"
          >
            <div
              className={`absolute inset-0 rounded-lg ${mine ? "bg-white/20" : "bg-brand/10 dark:bg-brand/20"}`}
              style={{ width: `${pct}%` }}
            />
            <span className={`flex-1 text-sm z-[1] ${isMyVote ? "font-bold" : ""} ${mine ? "text-white" : "dark:text-white"}`}>
              {isMyVote ? "✓ " : ""}{opt}
            </span>
            <span className={`text-xs z-[1] ml-2 ${mine ? "text-white/70" : "text-slate-500"}`}>{pct}%</span>
          </button>
        );
      })}
      <div className={`text-xs mt-1 ${mine ? "text-white/60" : "text-slate-500"}`}>
        {poll.totalVotes} голосов
      </div>
    </div>
  );
}
