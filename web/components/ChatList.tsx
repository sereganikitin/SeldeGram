"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Chat, Message } from "@/lib/types";
import { useAuth } from "@/lib/store";
import { useWs, type WsState } from "@/lib/ws";
import { Avatar } from "./Avatar";
import { IconButton } from "./IconButton";
import { Plus, Smile, Phone, User, Megaphone, Users, Bookmark, Pin, Bell, BellOff, Archive, ArchiveRestore } from "lucide-react";
import { formatTime, messagePreview } from "@/lib/helpers";
import { StoriesBar } from "./StoriesBar";

interface Props {
  selectedId: string | null;
  onSelect: (chat: Chat) => void;
  onLogout: () => void;
  onNewChat: () => void;
  onOpenStickers: () => void;
  onOpenCalls: () => void;
}

export function ChatList({ selectedId, onSelect, onLogout, onNewChat, onOpenStickers, onOpenCalls }: Props) {
  const meId = useAuth((s) => s.user?.id);
  const me = useAuth((s) => s.user);
  const onMessage = useWs((s: WsState) => s.onMessage);
  const onChatUpdated = useWs((s: WsState) => s.onChatUpdated);
  const onChatDeleted = useWs((s: WsState) => s.onChatDeleted);
  const onRead = useWs((s: WsState) => s.onRead);
  const onDeleted = useWs((s: WsState) => s.onDeleted);
  const onEdited = useWs((s: WsState) => s.onEdited);
  const [chats, setChats] = useState<Chat[]>([]);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [menuChat, setMenuChat] = useState<{ chat: Chat; x: number; y: number } | null>(null);

  const patchMembership = async (chatId: string, patch: { pinned?: boolean; muted?: boolean; archived?: boolean }) => {
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, ...patch } : c)));
    try {
      await api.patch(`/chats/${chatId}/membership`, patch);
    } catch {
      load();
    }
  };

  const load = useCallback(async () => {
    const { data } = await api.get<Chat[]>("/chats");
    setChats(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => onChatUpdated(() => load()), [onChatUpdated, load]);
  useEffect(() => onChatDeleted((id) => setChats((p) => p.filter((c) => c.id !== id))), [onChatDeleted]);

  useEffect(
    () =>
      onMessage((msg: Message) => {
        setChats((prev) => {
          const idx = prev.findIndex((c) => c.id === msg.chatId);
          if (idx === -1) {
            load();
            return prev;
          }
          const isMine = msg.senderId === meId;
          const isOpen = msg.chatId === selectedId;
          const updated: Chat = {
            ...prev[idx],
            lastMessage: msg,
            unreadCount: isMine || isOpen ? prev[idx].unreadCount ?? 0 : (prev[idx].unreadCount ?? 0) + 1,
          };
          return [updated, ...prev.filter((_, i) => i !== idx)];
        });
      }),
    [meId, onMessage, load, selectedId],
  );

  useEffect(
    () =>
      onRead((chatId, userId) => {
        if (userId !== meId) return;
        setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)));
      }),
    [meId, onRead],
  );

  useEffect(
    () => onEdited((msg) => setChats((prev) => prev.map((c) => (c.lastMessage?.id === msg.id ? { ...c, lastMessage: msg } : c)))),
    [onEdited],
  );

  useEffect(
    () =>
      onDeleted((_, messageId) =>
        setChats((prev) =>
          prev.map((c) =>
            c.lastMessage?.id === messageId
              ? { ...c, lastMessage: { ...c.lastMessage!, deletedAt: new Date().toISOString() } }
              : c,
          ),
        ),
      ),
    [onDeleted],
  );

  // Сначала фильтруем архив, потом — saved/pinned сверху
  const filtered = chats
    .filter((c) => (showArchived ? c.archived : !c.archived))
    .filter((c) => (c.title ?? "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.type === "saved" && b.type !== "saved") return -1;
      if (a.type !== "saved" && b.type === "saved") return 1;
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return 0;
    });
  const archivedCount = chats.filter((c) => c.archived).length;

  return (
    <aside className="w-full md:w-80 lg:w-96 border-r border-cream-border dark:border-slate-800 flex flex-col bg-white dark:bg-slate-950 overflow-x-hidden">
      <header className="p-4 border-b border-cream-border dark:border-slate-800 flex items-center gap-3">
        {me && <Avatar id={me.id} name={me.displayName} avatarKey={me.avatarKey} size={40} />}
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate dark:text-white">{me?.displayName}</div>
          <div className="text-xs text-ink-muted dark:text-ink-muted truncate">@{me?.username}</div>
        </div>
        <IconButton icon={Plus} onClick={onNewChat} title="Новый чат" size="md" />
        <IconButton icon={Smile} onClick={onOpenStickers} title="Стикерпаки" size="md" variant="ghost" />
        <IconButton icon={Phone} onClick={onOpenCalls} title="История звонков" size="md" variant="ghost" />
        <IconButton icon={User} onClick={onLogout} title="Профиль" size="md" variant="ghost" />
      </header>

      <StoriesBar />

      <div className="p-3 border-b border-cream-border dark:border-slate-800">
        <input
          type="text"
          placeholder="Поиск"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 bg-cream-alt dark:bg-slate-800 dark:text-white dark:placeholder:text-ink-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      {archivedCount > 0 && (
        <button
          onClick={() => setShowArchived((v) => !v)}
          className="px-4 py-2 text-sm text-ink-muted hover:bg-cream dark:hover:bg-slate-900 border-b border-cream-border dark:border-slate-800 flex items-center gap-2"
        >
          {showArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          {showArchived ? "К чатам" : `Архив (${archivedCount})`}
        </button>
      )}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="text-center text-ink-muted py-10 px-4 text-sm">
            Чатов нет. Создайте чат в мобильном приложении — он появится здесь.
          </div>
        )}
        {filtered.map((chat) => {
          const other = chat.type === "direct" ? chat.members.find((m) => m.id !== meId) : null;
          return (
            <button
              key={chat.id}
              onClick={() => onSelect(chat)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenuChat({ chat, x: e.clientX, y: e.clientY });
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-cream-border dark:border-slate-800 hover:bg-cream dark:hover:bg-slate-900 text-left ${
                selectedId === chat.id ? "bg-brand/10 dark:bg-brand/20" : ""
              } ${chat.pinned ? "bg-cream/40 dark:bg-slate-900/40" : ""}`}
            >
              {chat.type === "saved" ? (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center flex-shrink-0">
                  <Bookmark size={22} color="#fff" fill="#fff" />
                </div>
              ) : (
                <Avatar id={other?.id ?? chat.id} name={chat.title ?? "?"} avatarKey={other?.avatarKey} size={48} />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold truncate dark:text-white flex items-center gap-1">
                    {chat.type === "channel" && <Megaphone size={14} className="text-brand-dark flex-shrink-0" />}
                    {chat.type === "group" && <Users size={14} className="text-brand-dark flex-shrink-0" />}
                    {chat.type === "saved" && <Bookmark size={14} className="text-brand-dark flex-shrink-0" />}
                    <span className="truncate">{chat.type === "saved" ? "Избранное" : chat.title}</span>
                  </div>
                  {chat.lastMessage && (
                    <div className="text-xs text-ink-muted dark:text-ink-muted flex-shrink-0">{formatTime(chat.lastMessage.createdAt)}</div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <div className="text-sm text-ink-muted dark:text-ink-muted truncate">
                    {chat.lastMessage && !chat.lastMessage.deletedAt ? (
                      <>
                        {chat.lastMessage.senderId === meId && "Вы: "}
                        {messagePreview(chat.lastMessage)}
                      </>
                    ) : (
                      "Нет сообщений"
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {chat.muted && <BellOff size={14} className="text-ink-muted" />}
                    {chat.pinned && <Pin size={14} className="text-brand-dark" />}
                    {!!chat.unreadCount && chat.unreadCount > 0 && (
                      <span className={`text-white text-xs rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center font-bold ${chat.muted ? "bg-ink-muted" : "bg-brand"}`}>
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {menuChat && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuChat(null)} onContextMenu={(e) => { e.preventDefault(); setMenuChat(null); }} />
          <div
            className="fixed z-50 bg-white dark:bg-slate-800 dark:text-white shadow-xl rounded-lg border border-cream-border dark:border-slate-700 py-1 min-w-[200px]"
            style={{ left: Math.min(menuChat.x, window.innerWidth - 220), top: Math.min(menuChat.y, window.innerHeight - 200) }}
          >
            <button
              onClick={() => {
                patchMembership(menuChat.chat.id, { pinned: !menuChat.chat.pinned });
                setMenuChat(null);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <Pin size={16} className="text-brand-dark" /> {menuChat.chat.pinned ? "Открепить" : "Закрепить"}
            </button>
            <button
              onClick={() => {
                patchMembership(menuChat.chat.id, { muted: !menuChat.chat.muted });
                setMenuChat(null);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700 flex items-center gap-2"
            >
              {menuChat.chat.muted ? <Bell size={16} className="text-brand-dark" /> : <BellOff size={16} className="text-brand-dark" />}
              {menuChat.chat.muted ? "Включить уведомления" : "Заглушить"}
            </button>
            <button
              onClick={() => {
                patchMembership(menuChat.chat.id, { archived: !menuChat.chat.archived });
                setMenuChat(null);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700 flex items-center gap-2"
            >
              {menuChat.chat.archived ? <ArchiveRestore size={16} className="text-brand-dark" /> : <Archive size={16} className="text-brand-dark" />}
              {menuChat.chat.archived ? "Из архива" : "В архив"}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
