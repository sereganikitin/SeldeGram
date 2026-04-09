"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Chat, Message } from "@/lib/types";
import { useAuth } from "@/lib/store";
import { useWs } from "@/lib/ws";
import { Avatar } from "./Avatar";
import { formatTime, messagePreview } from "@/lib/helpers";

interface Props {
  selectedId: string | null;
  onSelect: (chat: Chat) => void;
  onLogout: () => void;
}

export function ChatList({ selectedId, onSelect, onLogout }: Props) {
  const meId = useAuth((s) => s.user?.id);
  const me = useAuth((s) => s.user);
  const onMessage = useWs((s) => s.onMessage);
  const onChatUpdated = useWs((s) => s.onChatUpdated);
  const onChatDeleted = useWs((s) => s.onChatDeleted);
  const onRead = useWs((s) => s.onRead);
  const onDeleted = useWs((s) => s.onDeleted);
  const onEdited = useWs((s) => s.onEdited);
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
    <aside className="w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-white">
      <header className="p-4 border-b border-slate-200 flex items-center gap-3">
        {me && <Avatar id={me.id} name={me.displayName} avatarKey={me.avatarKey} size={40} />}
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{me?.displayName}</div>
          <div className="text-xs text-slate-500 truncate">@{me?.username}</div>
        </div>
        <button onClick={onLogout} className="text-sm text-slate-500 hover:text-slate-900">
          Выйти
        </button>
      </header>

      <div className="p-3 border-b border-slate-200">
        <input
          type="text"
          placeholder="Поиск"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 bg-slate-100 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="text-center text-slate-400 py-10 px-4 text-sm">
            Чатов нет. Создайте чат в мобильном приложении — он появится здесь.
          </div>
        )}
        {filtered.map((chat) => {
          const other = chat.type === "direct" ? chat.members.find((m) => m.id !== meId) : null;
          return (
            <button
              key={chat.id}
              onClick={() => onSelect(chat)}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 text-left ${
                selectedId === chat.id ? "bg-brand/10" : ""
              }`}
            >
              <Avatar id={other?.id ?? chat.id} name={chat.title ?? "?"} avatarKey={other?.avatarKey} size={48} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold truncate">
                    {chat.type === "channel" && "📢 "}
                    {chat.type === "group" && "👥 "}
                    {chat.title}
                  </div>
                  {chat.lastMessage && (
                    <div className="text-xs text-slate-400 flex-shrink-0">{formatTime(chat.lastMessage.createdAt)}</div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <div className="text-sm text-slate-500 truncate">
                    {chat.lastMessage?.senderId === meId && "Вы: "}
                    {chat.lastMessage ? messagePreview(chat.lastMessage) : "Нет сообщений"}
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
