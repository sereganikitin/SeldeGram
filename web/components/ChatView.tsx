"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Chat, Message } from "@/lib/types";
import { useAuth } from "@/lib/store";
import { useWs, type WsState } from "@/lib/ws";
import { Avatar } from "./Avatar";
import { MessageBubble } from "./MessageBubble";
import { formatDateLabel, messagePreview } from "@/lib/helpers";

interface Props {
  chat: Chat;
  onBack?: () => void;
}

export function ChatView({ chat, onBack }: Props) {
  const meId = useAuth((s) => s.user?.id);
  const onMessage = useWs((s: WsState) => s.onMessage);
  const onEdited = useWs((s: WsState) => s.onEdited);
  const onDeletedWs = useWs((s: WsState) => s.onDeleted);
  const onReadWs = useWs((s: WsState) => s.onRead);
  const onTypingWs = useWs((s: WsState) => s.onTyping);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reads, setReads] = useState<{ userId: string; lastReadAt: string }[]>([]);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  // Загрузка
  useEffect(() => {
    api.get<Message[]>(`/chats/${chat.id}/messages`).then(({ data }) => setMessages(data));
    api.get<{ userId: string; lastReadAt: string }[]>(`/chats/${chat.id}/reads`).then(({ data }) => setReads(data));
    setEditingId(null);
    setReplyTo(null);
    setInput("");
  }, [chat.id]);

  // WS
  useEffect(
    () =>
      onMessage((msg) => {
        if (msg.chatId !== chat.id) return;
        setMessages((p) => (p.some((m) => m.id === msg.id) ? p : [...p, msg]));
      }),
    [chat.id, onMessage],
  );

  useEffect(
    () =>
      onEdited((msg) => {
        if (msg.chatId !== chat.id) return;
        setMessages((p) => p.map((m) => (m.id === msg.id ? msg : m)));
      }),
    [chat.id, onEdited],
  );

  useEffect(
    () =>
      onDeletedWs((cid, mid) => {
        if (cid !== chat.id) return;
        setMessages((p) =>
          p.map((m) =>
            m.id === mid ? { ...m, content: "", mediaKey: null, mediaType: null, deletedAt: new Date().toISOString() } : m,
          ),
        );
      }),
    [chat.id, onDeletedWs],
  );

  useEffect(
    () =>
      onReadWs((cid, userId, lastReadAt) => {
        if (cid !== chat.id) return;
        setReads((prev) => {
          const others = prev.filter((r) => r.userId !== userId);
          return [...others, { userId, lastReadAt }];
        });
      }),
    [chat.id, onReadWs],
  );

  useEffect(
    () =>
      onTypingWs((cid, userId) => {
        if (cid !== chat.id || userId === meId) return;
        setTypingUserId(userId);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setTypingUserId(null), 3000);
      }),
    [chat.id, meId, onTypingWs],
  );

  // Скролл вниз
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Mark read
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    api.post(`/chats/${chat.id}/read`, { messageId: last.id }).catch(() => {});
  }, [chat.id, messages]);

  const minOtherLastRead = useMemo(() => {
    const others = reads.filter((r) => r.userId !== meId);
    if (others.length === 0) return 0;
    return Math.min(...others.map((r) => new Date(r.lastReadAt).getTime()));
  }, [reads, meId]);

  const senderNameById = useMemo(() => {
    const map = new Map<string, string>();
    chat.members.forEach((m) => map.set(m.id, m.displayName));
    return map;
  }, [chat]);

  const items = useMemo(() => {
    const result: Array<{ kind: "msg"; m: Message } | { kind: "date"; id: string; label: string }> = [];
    let lastDay = "";
    for (const m of messages) {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) {
        result.push({ kind: "date", id: "d-" + day, label: formatDateLabel(m.createdAt) });
        lastDay = day;
      }
      result.push({ kind: "msg", m });
    }
    return result;
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const replyId = replyTo?.id;
    setReplyTo(null);
    try {
      if (editingId) {
        await api.patch(`/chats/${chat.id}/messages/${editingId}`, { content: text });
        setEditingId(null);
      } else {
        await api.post(`/chats/${chat.id}/messages`, { content: text, replyToId: replyId });
      }
    } catch {
      setInput(text);
    }
  };

  const onInputChange = useCallback(
    (v: string) => {
      setInput(v);
      const now = Date.now();
      if (now - lastTypingSentRef.current > 1500) {
        lastTypingSentRef.current = now;
        api.post(`/chats/${chat.id}/typing`, {}).catch(() => {});
      }
    },
    [chat.id],
  );

  const handleAction = (msg: Message) => (action: "reply" | "edit" | "delete" | "copy") => {
    if (action === "reply") setReplyTo(msg);
    else if (action === "copy") navigator.clipboard?.writeText(msg.content).catch(() => {});
    else if (action === "edit") {
      setEditingId(msg.id);
      setInput(msg.content);
    } else if (action === "delete") {
      if (confirm("Удалить сообщение?")) {
        api.delete(`/chats/${chat.id}/messages/${msg.id}`).catch(() => {});
      }
    }
  };

  const canPost = !(chat.type === "channel" && chat.viewerRole !== "admin");
  const other = chat.type === "direct" ? chat.members.find((m) => m.id !== meId) : null;
  const typingName = typingUserId ? senderNameById.get(typingUserId) : null;

  return (
    <section className="flex-1 flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="md:hidden text-slate-500 mr-1">
            ←
          </button>
        )}
        <Avatar id={other?.id ?? chat.id} name={chat.title ?? "?"} avatarKey={other?.avatarKey} size={40} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">
            {chat.type === "channel" && "📢 "}
            {chat.type === "group" && "👥 "}
            {chat.title}
          </div>
          {typingName ? (
            <div className="text-xs text-brand-dark italic">{typingName} печатает...</div>
          ) : (
            <div className="text-xs text-slate-500">
              {chat.type === "direct" ? "был в сети" : `${chat.memberCount ?? chat.members.length} участников`}
            </div>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {items.map((item) => {
          if (item.kind === "date") {
            return (
              <div key={item.id} className="text-center my-3">
                <span className="bg-white text-slate-500 text-xs px-3 py-1 rounded-full border border-slate-200">
                  {item.label}
                </span>
              </div>
            );
          }
          const m = item.m;
          const mine = m.senderId === meId;
          const isRead = mine && new Date(m.createdAt).getTime() <= minOtherLastRead;
          return (
            <MessageBubble
              key={m.id}
              message={m}
              mine={mine}
              showSenderName={chat.type !== "direct"}
              senderName={senderNameById.get(m.senderId)}
              isRead={isRead}
              onAction={handleAction(m)}
            />
          );
        })}
      </div>

      {(replyTo || editingId) && (
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-100 border-t border-slate-200">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-brand-dark font-semibold">{editingId ? "Изменение" : "Ответ"}</div>
            <div className="text-sm text-slate-600 truncate">{editingId ? input : messagePreview(replyTo!)}</div>
          </div>
          <button
            onClick={() => {
              setReplyTo(null);
              setEditingId(null);
              if (editingId) setInput("");
            }}
            className="text-slate-400 hover:text-slate-700 px-2"
          >
            ✕
          </button>
        </div>
      )}

      {canPost ? (
        <div className="flex items-end gap-2 p-3 bg-white border-t border-slate-200">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={editingId ? "Изменить..." : "Сообщение..."}
            rows={1}
            className="flex-1 resize-none px-4 py-2 bg-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand max-h-32"
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="w-10 h-10 rounded-full bg-brand hover:bg-brand-dark disabled:opacity-40 text-white flex items-center justify-center text-xl"
          >
            {editingId ? "✓" : "↑"}
          </button>
        </div>
      ) : (
        <div className="p-4 text-center text-sm text-slate-500 bg-white border-t border-slate-200">
          Только админы могут писать в канал
        </div>
      )}
    </section>
  );
}
