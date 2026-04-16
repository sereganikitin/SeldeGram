"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "./Modal";
import { MessageBubble } from "./MessageBubble";
import { api } from "@/lib/api";
import { Message } from "@/lib/types";
import { useAuth } from "@/lib/store";
import { useWs, type WsState } from "@/lib/ws";
import { IconButton } from "./IconButton";
import { Send } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  chatId: string;
  parent: Message | null;
}

export function ThreadModal({ open, onClose, chatId, parent }: Props) {
  const meId = useAuth((s) => s.user?.id);
  const onMessage = useWs((s: WsState) => s.onMessage);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!parent) return;
    const { data } = await api.get<Message[]>(`/chats/${chatId}/thread/${parent.id}`);
    setMessages(data);
  }, [chatId, parent]);

  useEffect(() => {
    if (open && parent) load();
  }, [open, parent, load]);

  useEffect(() => {
    if (!open || !parent) return;
    return onMessage((msg) => {
      if (msg.chatId !== chatId || msg.threadOfId !== parent.id) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });
  }, [open, parent, chatId, onMessage]);

  const send = async () => {
    if (!parent) return;
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      await api.post(`/chats/${chatId}/messages`, { content: text, threadOfId: parent.id });
    } catch (e: unknown) {
      setInput(text);
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? "Не получилось");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Комментарии" width="max-w-lg">
      {parent && (
        <div className="px-5 py-3 border-b border-cream-border dark:border-slate-800 bg-cream dark:bg-slate-900">
          <div className="text-xs font-bold uppercase text-ink-muted">Исходный пост</div>
          <div className="text-sm dark:text-white mt-1 line-clamp-3">{parent.content}</div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 min-h-[200px] max-h-[50vh]">
        {messages.length === 0 && (
          <div className="text-center text-ink-muted mt-10">Комментариев пока нет</div>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            mine={m.senderId === meId}
            showSenderName
            senderName={undefined}
            isRead={false}
            onAction={() => {}}
          />
        ))}
      </div>
      <div className="flex items-end gap-2 p-3 border-t border-cream-border dark:border-slate-800">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Комментарий..."
          rows={1}
          className="flex-1 resize-none px-4 py-2 bg-cream-alt dark:bg-slate-800 dark:text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand max-h-32"
        />
        <IconButton icon={Send} size="md" onClick={send} disabled={!input.trim() || sending} title="Отправить" className="flex-shrink-0 disabled:opacity-40" />
      </div>
    </Modal>
  );
}
