"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Chat, Message } from "@/lib/types";
import { useAuth } from "@/lib/store";
import { useWs, type WsState } from "@/lib/ws";
import { Avatar } from "./Avatar";
import { MessageBubble } from "./MessageBubble";
import { StickerPicker } from "./StickerPicker";
import { ChatInfoModal } from "./ChatInfoModal";
import { ChatBackground } from "./ChatBackground";
import { WallpaperPickerModal } from "./WallpaperPickerModal";
import { VoiceRecorder } from "./VoiceRecorder";
import { ThreadModal } from "./ThreadModal";
import { formatDateLabel, messagePreview, lastSeenText } from "@/lib/helpers";
import { uploadFile } from "@/lib/media";
import { useCall } from "@/lib/call";

interface Props {
  chat: Chat;
  onBack?: () => void;
  onChatGone: () => void;
  onOpenStickers: () => void;
}

export function ChatView({ chat, onBack, onChatGone, onOpenStickers }: Props) {
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
  const [stickersOpen, setStickersOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [wallpaper, setWallpaper] = useState<string | null>(chat.viewerWallpaper ?? null);
  const [pinnedMsg, setPinnedMsg] = useState<Message | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const me = useAuth((s) => s.user);
  const onPinned = useWs((s: WsState) => s.onPinned);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [peerOnline, setPeerOnline] = useState<boolean | undefined>(undefined);
  const [peerLastSeen, setPeerLastSeen] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  // WS: реакции
  useEffect(() => {
    const ws = useWs.getState().socket;
    if (!ws) return;
    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message:reactions" && data.payload.chatId === chat.id) {
          const { messageId: mid, reactions } = data.payload;
          setMessages((prev) => prev.map((m) => m.id === mid ? { ...m, reactions } : m));
        }
      } catch {}
    };
    ws.addEventListener("message", handler);
    return () => ws.removeEventListener("message", handler);
  }, [chat.id]);

  // WS: обновление статуса собеседника
  const onPresence = useWs((s: WsState) => s.onPresence);
  useEffect(() => {
    if (chat.type !== "direct") return;
    const other = chat.members.find((m) => m.id !== meId);
    if (!other) return;
    return onPresence((userId, online, lastSeenAt) => {
      if (userId === other.id) {
        setPeerOnline(online);
        setPeerLastSeen(lastSeenAt);
      }
    });
  }, [chat.type, chat.members, meId, onPresence]);

  // Загрузка
  useEffect(() => {
    api.get<Message[]>(`/chats/${chat.id}/messages`).then(({ data }) => setMessages(data));
    api.get<{ userId: string; lastReadAt: string }[]>(`/chats/${chat.id}/reads`).then(({ data }) => setReads(data));
    api.get<Chat>(`/chats/${chat.id}`).then(({ data }) => {
      setWallpaper(data.viewerWallpaper ?? null);
      if (data.type === "direct") {
        const other = data.members.find((m) => m.id !== meId);
        if (other) {
          setPeerOnline(other.isOnline);
          setPeerLastSeen(other.lastSeenAt ?? null);
        }
      }
    });
    api.get<Message | null>(`/chats/${chat.id}/pinned`).then(({ data }) => setPinnedMsg(data));
    setEditingId(null);
    setReplyTo(null);
    setInput("");
    setSearchOpen(false);
    setSearchQ("");
  }, [chat.id, meId]);

  useEffect(() => {
    return onPinned((cid, messageId) => {
      if (cid !== chat.id) return;
      if (!messageId) return setPinnedMsg(null);
      api.get<Message | null>(`/chats/${chat.id}/pinned`).then(({ data }) => setPinnedMsg(data));
    });
  }, [chat.id, onPinned]);

  useEffect(() => {
    if (!searchOpen || !searchQ.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get<Message[]>(`/chats/${chat.id}/search`, { params: { q: searchQ } });
        setSearchResults(data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [chat.id, searchOpen, searchQ]);

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
      if (m.deletedAt) continue;
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

  const sendFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      for (const f of arr) {
        const { key, contentType, name, size } = await uploadFile(f);
        await api.post(`/chats/${chat.id}/messages`, {
          mediaKey: key,
          mediaType: contentType,
          mediaName: name,
          mediaSize: size,
          replyToId: replyTo?.id,
        });
      }
      setReplyTo(null);
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(err.message ?? "Не получилось");
    } finally {
      setUploading(false);
    }
  };

  const sendVoice = async (blob: Blob, durationMs: number) => {
    setVoiceRecording(false);
    setUploading(true);
    try {
      const { uploadBlob: doUpload } = await import("@/lib/media");
      const key = await doUpload(blob, "audio/webm", blob.size);
      await api.post(`/chats/${chat.id}/messages`, {
        mediaKey: key,
        mediaType: "audio/webm",
        mediaName: "voice.webm",
        mediaSize: durationMs,
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(err.message ?? "Не получилось");
    } finally {
      setUploading(false);
    }
  };

  const sendSticker = async (stickerId: string) => {
    setStickersOpen(false);
    try {
      await api.post(`/chats/${chat.id}/messages`, { stickerId });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? "Не получилось");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) sendFiles(e.dataTransfer.files);
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

  const handleAction = (msg: Message) => (action: "reply" | "edit" | "delete" | "copy" | "pin" | "thread") => {
    if (action === "reply") setReplyTo(msg);
    else if (action === "copy") navigator.clipboard?.writeText(msg.content).catch(() => {});
    else if (action === "edit") {
      setEditingId(msg.id);
      setInput(msg.content);
    } else if (action === "delete") {
      if (confirm("Удалить сообщение?")) {
        api.delete(`/chats/${chat.id}/messages/${msg.id}`).catch(() => {});
      }
    } else if (action === "pin") {
      if (pinnedMsg?.id === msg.id) {
        api.delete(`/chats/${chat.id}/pin`).catch(() => {});
      } else {
        api.post(`/chats/${chat.id}/pin/${msg.id}`).catch(() => {});
      }
    } else if (action === "thread") {
      setThreadParent(msg);
    }
  };

  const canPost = !(chat.type === "channel" && chat.viewerRole !== "admin");
  const other = chat.type === "direct" ? chat.members.find((m) => m.id !== meId) : null;
  const typingName = typingUserId ? senderNameById.get(typingUserId) : null;
  const effectiveWallpaper = wallpaper ?? me?.defaultWallpaper ?? null;

  return (
    <ChatBackground wallpaper={effectiveWallpaper}>
    <section
      className="flex-1 flex flex-col min-h-0 min-w-0 relative overflow-x-hidden w-full max-w-full"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="absolute inset-0 z-30 bg-brand/20 border-4 border-dashed border-brand rounded-lg flex items-center justify-center pointer-events-none">
          <div className="text-brand-dark text-2xl font-bold">Отпустите файл для отправки</div>
        </div>
      )}
      <header className="bg-white dark:bg-slate-950 border-b border-cream-border dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="md:hidden text-ink-muted mr-1">
            ←
          </button>
        )}
        <button
          onClick={() => setInfoOpen(true)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left hover:bg-cream dark:hover:bg-slate-900 -mx-2 px-2 py-1 rounded-lg"
        >
          <Avatar id={other?.id ?? chat.id} name={chat.title ?? "?"} avatarKey={other?.avatarKey} size={40} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate dark:text-white">
              {chat.type === "channel" && "📢 "}
              {chat.type === "group" && "👥 "}
              {chat.title}
            </div>
            {typingName ? (
              <div className="text-xs text-brand-dark italic">{typingName} печатает...</div>
            ) : (
              <div className="text-xs text-ink-muted dark:text-ink-muted">
                {chat.type === "direct"
                  ? lastSeenText(peerLastSeen ?? other?.lastSeenAt, peerOnline ?? other?.isOnline)
                  : `${chat.memberCount ?? chat.members.length} участников`}
              </div>
            )}
          </div>
        </button>
        {chat.type === "direct" && other && (
          <button
            onClick={() => {
              useCall.getState().initiate({
                id: other.id,
                username: other.username,
                displayName: other.displayName,
                avatarKey: other.avatarKey ?? null,
              }, "audio");
            }}
            className="text-brand-dark text-lg px-2"
            title="Позвонить"
          >
            📞
          </button>
        )}
        <button
          onClick={() => setSearchOpen((v) => !v)}
          className="text-brand-dark text-lg px-2"
          title="Поиск"
        >
          🔎
        </button>
        <button
          onClick={() => setInfoOpen(true)}
          className="text-brand-dark text-xl px-2"
          title="Информация"
        >
          ⓘ
        </button>
      </header>

      {pinnedMsg && !pinnedMsg.deletedAt && (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-cream-border dark:border-slate-800 px-4 py-2 flex items-center gap-2">
          <span className="text-brand-dark">📌</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-brand-dark font-semibold">Закреплённое</div>
            <div className="text-sm text-ink dark:text-slate-300 truncate">
              {pinnedMsg.content || "📷 Медиа"}
            </div>
          </div>
          {(chat.type === "direct" || chat.viewerRole === "admin") && (
            <button
              onClick={() => api.delete(`/chats/${chat.id}/pin`).catch(() => {})}
              className="text-ink-muted hover:text-ink dark:hover:text-white text-lg px-2"
              title="Открепить"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {searchOpen && (
        <div className="bg-white dark:bg-slate-950 border-b border-cream-border dark:border-slate-800 p-3">
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            autoFocus
            placeholder="Поиск по сообщениям"
            className="w-full px-3 py-2 bg-cream-alt dark:bg-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
          />
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto border border-cream-border dark:border-slate-800 rounded-lg">
              {searchResults.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQ("");
                    document.getElementById(`msg-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="w-full text-left px-3 py-2 border-b border-cream-border dark:border-slate-800 hover:bg-cream dark:hover:bg-slate-900 last:border-b-0"
                >
                  <div className="text-sm dark:text-white truncate">{m.content}</div>
                  <div className="text-xs text-ink-muted">{senderNameById.get(m.senderId) ?? ""}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {items.map((item) => {
          if (item.kind === "date") {
            return (
              <div key={item.id} className="text-center my-3">
                <span className="bg-white text-ink-muted text-xs px-3 py-1 rounded-full border border-cream-border">
                  {item.label}
                </span>
              </div>
            );
          }
          const m = item.m;
          const mine = m.senderId === meId;
          const isRead = mine && new Date(m.createdAt).getTime() <= minOtherLastRead;
          return (
            <div id={`msg-${m.id}`} key={m.id}>
              <MessageBubble
                message={m}
                mine={mine}
                showSenderName={chat.type !== "direct"}
                senderName={senderNameById.get(m.senderId)}
                isRead={isRead}
                onAction={handleAction(m)}
                onReact={(emoji) => api.post(`/chats/${chat.id}/messages/${m.id}/react`, { emoji }).catch(() => {})}
                canComment={chat.type === "channel" && !m.threadOfId}
              />
            </div>
          );
        })}
      </div>

      {(replyTo || editingId) && (
        <div className="flex items-center gap-3 px-4 py-2 bg-cream-alt dark:bg-slate-900 border-t border-cream-border dark:border-slate-800">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-brand-dark font-semibold">{editingId ? "Изменение" : "Ответ"}</div>
            <div className="text-sm text-ink-muted truncate">{editingId ? input : messagePreview(replyTo!)}</div>
          </div>
          <button
            onClick={() => {
              setReplyTo(null);
              setEditingId(null);
              if (editingId) setInput("");
            }}
            className="text-ink-muted hover:text-ink px-2"
          >
            ✕
          </button>
        </div>
      )}

      {canPost ? (
        <>
          <div className="flex items-end gap-2 p-3 bg-white dark:bg-slate-950 border-t border-cream-border dark:border-slate-800">
            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              onChange={(e) => {
                if (e.target.files) sendFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !!editingId}
              className="w-10 h-10 rounded-full hover:bg-cream-alt flex items-center justify-center text-xl flex-shrink-0 disabled:opacity-40"
              title="Прикрепить"
            >
              {uploading ? "⏳" : "📎"}
            </button>
            <button
              onClick={() => {
                const q = prompt("Вопрос опроса:");
                if (!q?.trim()) return;
                const optStr = prompt("Варианты через ; (минимум 2):");
                const opts = (optStr ?? "").split(";").map((s) => s.trim()).filter(Boolean);
                if (opts.length < 2) { alert("Нужно минимум 2 варианта"); return; }
                api.post(`/chats/${chat.id}/poll`, { question: q.trim(), options: opts }).catch(() => {});
              }}
              disabled={!!editingId}
              className="w-10 h-10 rounded-full hover:bg-cream-alt dark:hover:bg-slate-800 flex items-center justify-center text-xl flex-shrink-0 disabled:opacity-40"
              title="Опрос"
            >
              📊
            </button>
            <button
              onClick={() => setStickersOpen((v) => !v)}
              disabled={!!editingId}
              className="w-10 h-10 rounded-full hover:bg-cream-alt dark:hover:bg-slate-800 flex items-center justify-center text-xl flex-shrink-0 disabled:opacity-40"
              title="Стикеры"
            >
              {stickersOpen ? "⌨" : "😀"}
            </button>
            <textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              onFocus={() => setStickersOpen(false)}
              placeholder={editingId ? "Изменить..." : "Сообщение..."}
              rows={1}
              className="flex-1 resize-none px-4 py-2 bg-cream-alt dark:bg-slate-800 dark:text-white dark:placeholder:text-ink-muted rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand max-h-32"
            />
            {input.trim() || editingId ? (
              <button
                onClick={send}
                disabled={!input.trim()}
                className="w-10 h-10 rounded-full bg-brand hover:bg-brand-dark disabled:opacity-40 text-white flex items-center justify-center text-xl"
              >
                {editingId ? "✓" : "↑"}
              </button>
            ) : (
              <button
                onClick={() => setVoiceRecording(true)}
                disabled={uploading}
                className="w-10 h-10 rounded-full bg-brand hover:bg-brand-dark disabled:opacity-40 text-white flex items-center justify-center text-xl"
              >
                🎤
              </button>
            )}
          </div>
          {voiceRecording && <VoiceRecorder onRecorded={sendVoice} onCancel={() => setVoiceRecording(false)} />}
          {stickersOpen && !voiceRecording && <StickerPicker onPick={sendSticker} onOpenManage={() => { setStickersOpen(false); onOpenStickers(); }} />}
        </>
      ) : (
        <div className="p-4 text-center text-sm text-ink-muted bg-white border-t border-cream-border">
          Только админы могут писать в канал
        </div>
      )}

      <ChatInfoModal
        chatId={chat.id}
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        onChatGone={onChatGone}
        onOpenWallpaper={() => {
          setInfoOpen(false);
          setWallpaperOpen(true);
        }}
      />
      <WallpaperPickerModal
        open={wallpaperOpen}
        onClose={() => setWallpaperOpen(false)}
        chatId={chat.id}
        onApplied={() => api.get<Chat>(`/chats/${chat.id}`).then(({ data }) => setWallpaper(data.viewerWallpaper ?? null))}
      />
      <ThreadModal
        open={!!threadParent}
        onClose={() => setThreadParent(null)}
        chatId={chat.id}
        parent={threadParent}
      />
    </section>
    </ChatBackground>
  );
}
