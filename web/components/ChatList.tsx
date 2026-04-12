"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Chat, Message } from "@/lib/types";
import { useAuth } from "@/lib/store";
import { useWs, type WsState } from "@/lib/ws";
import { Avatar } from "./Avatar";
import { formatTime, messagePreview } from "@/lib/helpers";

interface Props {
  selectedId: string | null;
  onSelect: (chat: Chat) => void;
  onLogout: () => void;
  onNewChat: () => void;
  onOpenStickers: () => void;
}

export function ChatList({ selectedId, onSelect, onLogout, onNewChat, onOpenStickers }: Props) {
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

  const filtered = chats.filter((c) => (c.title ?? "").toLowerCase().includes(search.toLowerCase()));

  return (
    <aside className="w-full md:w-80 lg:w-96 border-r border-cream-border dark:border-slate-800 flex flex-col bg-white dark:bg-slate-950 overflow-x-hidden">
      <header className="p-4 border-b border-cream-border dark:border-slate-800 flex items-center gap-3">
        {me && <Avatar id={me.id} name={me.displayName} avatarKey={me.avatarKey} size={40} />}
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate dark:text-white">{me?.displayName}</div>
          <div className="text-xs text-ink-muted dark:text-ink-muted truncate">@{me?.username}</div>
        </div>
        <button
          onClick={onNewChat}
          className="w-9 h-9 rounded-full bg-brand hover:bg-brand-dark text-white text-xl flex items-center justify-center"
          title="Новый чат"
        >
          +
        </button>
        <button
          onClick={onOpenStickers}
          className="w-9 h-9 rounded-full hover:bg-cream-alt dark:hover:bg-slate-800 text-xl flex items-center justify-center"
          title="Стикерпаки"
        >
          😀
        </button>
        <button
          onClick={onLogout}
          className="w-9 h-9 rounded-full hover:bg-cream-alt dark:hover:bg-slate-800 flex items-center justify-center"
          title="Профиль"
        >
          👤
        </button>
      </header>

      <div className="p-3 border-b border-cream-border dark:border-slate-800">
        <input
          type="text"
          placeholder="Поиск"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 bg-cream-alt dark:bg-slate-800 dark:text-white dark:placeholder:text-ink-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

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
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-cream-border dark:border-slate-800 hover:bg-cream dark:hover:bg-slate-900 text-left ${
                selectedId === chat.id ? "bg-brand/10 dark:bg-brand/20" : ""
              }`}
            >
              <Avatar id={other?.id ?? chat.id} name={chat.title ?? "?"} avatarKey={other?.avatarKey} size={48} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold truncate dark:text-white">
                    {chat.type === "channel" && "📢 "}
                    {chat.type === "group" && "👥 "}
                    {chat.title}
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
                  {!!chat.unreadCount && chat.unreadCount > 0 && (
                    <span className="bg-brand text-white text-xs rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center font-bold flex-shrink-0">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
