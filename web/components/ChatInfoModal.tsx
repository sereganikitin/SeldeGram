"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Chat, UserSearchResult } from "@/lib/types";
import { useAuth } from "@/lib/store";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";

interface Props {
  chatId: string;
  open: boolean;
  onClose: () => void;
  onChatGone: () => void;
  onOpenWallpaper?: () => void;
}

export function ChatInfoModal({ chatId, open, onClose, onChatGone, onOpenWallpaper }: Props) {
  const meId = useAuth((s) => s.user?.id);
  const [chat, setChat] = useState<Chat | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [addQ, setAddQ] = useState("");
  const [addResults, setAddResults] = useState<UserSearchResult[]>([]);
  const [blocked, setBlocked] = useState(false);

  const load = useCallback(async () => {
    if (!open) return;
    const { data } = await api.get<Chat>(`/chats/${chatId}`);
    setChat(data);
    setTitleDraft(data.title ?? "");
    if (data.type === "direct") {
      try {
        const { data: blocks } = await api.get<Array<{ id: string }>>("/me/blocks");
        const otherId = data.members.find((m) => m.id !== meId)?.id;
        setBlocked(!!otherId && blocks.some((b) => b.id === otherId));
      } catch {}
    }
  }, [chatId, open, meId]);

  useEffect(() => {
    load();
  }, [load]);

  const isAdmin = chat?.viewerRole === "admin";
  const isDirect = chat?.type === "direct";
  const other = isDirect && chat ? chat.members.find((m) => m.id !== meId) : null;

  const saveTitle = async () => {
    if (!titleDraft.trim()) return;
    try {
      await api.patch(`/chats/${chatId}`, { title: titleDraft.trim() });
      setEditingTitle(false);
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? "Не получилось");
    }
  };

  const searchToAdd = async (q: string) => {
    setAddQ(q);
    if (!q.trim()) return setAddResults([]);
    try {
      const { data } = await api.get<UserSearchResult[]>("/users/search", { params: { q } });
      setAddResults(data.filter((u) => !chat?.members.some((m) => m.id === u.id)));
    } catch {}
  };

  const addUser = async (username: string) => {
    try {
      await api.post(`/chats/${chatId}/members`, { username });
      setAddQ("");
      setAddResults([]);
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? "Не получилось");
    }
  };

  const removeUser = async (userId: string, isMe: boolean) => {
    if (!confirm(isMe ? "Покинуть чат?" : "Удалить участника?")) return;
    try {
      await api.delete(`/chats/${chatId}/members/${userId}`);
      if (isMe) {
        onChatGone();
        onClose();
      } else {
        await load();
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? "Не получилось");
    }
  };

  const toggleBlock = async () => {
    if (!other) return;
    try {
      if (blocked) {
        await api.delete(`/me/blocks/${other.id}`);
        setBlocked(false);
      } else {
        if (!confirm(`Заблокировать ${other.displayName}?`)) return;
        await api.post(`/me/blocks/${other.id}`);
        setBlocked(true);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? "Не получилось");
    }
  };

  const deleteChat = async () => {
    if (!confirm("Удалить чат?")) return;
    try {
      await api.delete(`/chats/${chatId}`);
      onChatGone();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? "Не получилось");
    }
  };

  if (!chat) return <Modal open={open} onClose={onClose} title="Информация" />;

  return (
    <Modal open={open} onClose={onClose} title="Информация" width="max-w-md">
      <div className="p-5">
        <div className="flex flex-col items-center mb-6">
          <Avatar
            id={other?.id ?? chat.id}
            name={chat.title ?? "?"}
            avatarKey={other?.avatarKey}
            size={96}
          />
          {editingTitle && isAdmin ? (
            <div className="mt-3 flex items-center gap-2 w-full">
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="flex-1 text-center text-xl font-bold border-b border-brand bg-transparent focus:outline-none"
                autoFocus
              />
              <button onClick={saveTitle} className="text-brand-dark text-2xl">
                ✓
              </button>
            </div>
          ) : (
            <h3
              onClick={() => isAdmin && !isDirect && setEditingTitle(true)}
              className={`mt-3 text-xl font-bold ${isAdmin && !isDirect ? "cursor-pointer" : ""}`}
            >
              {chat.title}
            </h3>
          )}
          {chat.slug && <div className="text-sm text-brand-dark mt-1">@{chat.slug}</div>}
          <div className="text-sm text-slate-500 mt-1">
            {chat.memberCount ?? chat.members.length}{" "}
            {chat.type === "channel" ? "подписчиков" : isDirect ? "участника" : "участников"}
          </div>
        </div>

        {isAdmin && chat.type !== "channel" && !isDirect && (
          <div className="mb-4">
            <input
              type="text"
              placeholder="+ Добавить участника"
              value={addQ}
              onChange={(e) => searchToAdd(e.target.value)}
              className="w-full px-4 py-2 bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
            />
            {addResults.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {addResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => addUser(u.username)}
                    className="w-full flex items-center gap-2 p-2 hover:bg-slate-50 text-left"
                  >
                    <Avatar id={u.id} name={u.displayName} avatarKey={u.avatarKey} size={32} />
                    <span className="text-sm">{u.displayName}</span>
                    <span className="text-xs text-slate-500">@{u.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-1 mb-5">
          {chat.members.map((m) => {
            const isMe = m.id === meId;
            const canRemove = isMe || (isAdmin && !isDirect);
            return (
              <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                <Avatar id={m.id} name={m.displayName} avatarKey={m.avatarKey} size={40} />
                <div className="flex-1">
                  <div className="font-semibold text-sm">
                    {m.displayName} {isMe && <span className="text-brand-dark font-normal">(вы)</span>}
                  </div>
                  <div className="text-xs text-slate-500">
                    @{m.username} {m.role === "admin" && "· админ"}
                  </div>
                </div>
                {canRemove && (
                  <button
                    onClick={() => removeUser(m.id, isMe)}
                    className="text-red-600 text-sm font-semibold"
                  >
                    {isMe ? "Выйти" : "✕"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {onOpenWallpaper && (
          <button
            onClick={onOpenWallpaper}
            className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white font-semibold py-3 rounded-lg mb-2"
          >
            🖼 Обои чата
          </button>
        )}
        {isDirect && (
          <>
            <button
              onClick={toggleBlock}
              className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white font-semibold py-3 rounded-lg mb-2"
            >
              {blocked ? "✓ Разблокировать" : "🚫 Заблокировать"}
            </button>
            <button
              onClick={deleteChat}
              className="w-full bg-red-50 text-red-600 font-semibold py-3 rounded-lg hover:bg-red-100"
            >
              Удалить чат
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
