"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Chat, UserSearchResult, ChannelSearchResult } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (chat: Chat) => void;
}

type Tab = "direct" | "group" | "channel" | "find";

export function NewChatModal({ open, onClose, onCreated }: Props) {
  const [tab, setTab] = useState<Tab>("direct");

  useEffect(() => {
    if (open) setTab("direct");
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Новый чат" width="max-w-lg">
      <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
        {([
          ["direct", "💬 Личный"],
          ["group", "👥 Группа"],
          ["channel", "📢 Канал"],
          ["find", "🔎 Найти"],
        ] as Array<[Tab, string]>).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === k ? "text-brand-dark border-b-2 border-brand" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-5">
        {tab === "direct" && <DirectTab onCreated={onCreated} />}
        {tab === "group" && <GroupTab onCreated={onCreated} />}
        {tab === "channel" && <ChannelTab onCreated={onCreated} />}
        {tab === "find" && <FindChannelTab onCreated={onCreated} />}
      </div>
    </Modal>
  );
}

function DirectTab({ onCreated }: { onCreated: (c: Chat) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);

  useEffect(() => {
    if (!q.trim()) return setResults([]);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get<UserSearchResult[]>("/users/search", { params: { q } });
        setResults(data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const start = async (username: string) => {
    try {
      const { data } = await api.post<Chat>("/chats/direct", { username });
      onCreated(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? "Не получилось");
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Поиск по username или имени"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
        className="w-full px-4 py-3 bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand mb-3"
      />
      <div className="max-h-96 overflow-y-auto">
        {results.map((u) => (
          <button
            key={u.id}
            onClick={() => start(u.username)}
            className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg text-left"
          >
            <Avatar id={u.id} name={u.displayName} avatarKey={u.avatarKey} size={40} />
            <div>
              <div className="font-semibold">{u.displayName}</div>
              <div className="text-xs text-slate-500">@{u.username}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupTab({ onCreated }: { onCreated: (c: Chat) => void }) {
  const [title, setTitle] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [selected, setSelected] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) return setResults([]);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get<UserSearchResult[]>("/users/search", { params: { q } });
        setResults(data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const toggle = (u: UserSearchResult) => {
    setSelected((prev) => (prev.some((x) => x.id === u.id) ? prev.filter((x) => x.id !== u.id) : [...prev, u]));
  };

  const create = async () => {
    if (!title.trim() || selected.length === 0) {
      alert("Введите название и добавьте участников");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<Chat>("/chats/group", {
        title: title.trim(),
        memberUsernames: selected.map((u) => u.username),
      });
      onCreated(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? "Не получилось");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Название группы"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-4 py-3 bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((u) => (
            <button
              key={u.id}
              onClick={() => toggle(u)}
              className="bg-brand text-white px-3 py-1 rounded-full text-sm"
            >
              {u.displayName} ✕
            </button>
          ))}
        </div>
      )}
      <input
        type="text"
        placeholder="Добавить участников"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full px-4 py-3 bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <div className="max-h-60 overflow-y-auto">
        {results.map((u) => {
          const isSel = selected.some((x) => x.id === u.id);
          return (
            <button
              key={u.id}
              onClick={() => toggle(u)}
              className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg text-left"
            >
              <Avatar id={u.id} name={u.displayName} avatarKey={u.avatarKey} size={36} />
              <div className="flex-1">
                <div className="font-semibold text-sm">{u.displayName}</div>
                <div className="text-xs text-slate-500">@{u.username}</div>
              </div>
              {isSel && <span className="text-brand-dark">✓</span>}
            </button>
          );
        })}
      </div>
      <button
        onClick={create}
        disabled={loading}
        className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold py-3 rounded-lg"
      >
        Создать группу ({selected.length})
      </button>
    </div>
  );
}

function ChannelTab({ onCreated }: { onCreated: (c: Chat) => void }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!title.trim() || !slug.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post<Chat>("/chats/channel", { title: title.trim(), slug: slug.trim() });
      onCreated(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? "Не получилось");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Название канала"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-4 py-3 bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <input
        type="text"
        placeholder="@slug (латиница, цифры, подчёркивание)"
        value={slug}
        onChange={(e) => setSlug(e.target.value.toLowerCase())}
        className="w-full px-4 py-3 bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <p className="text-xs text-slate-500">По slug канал смогут найти другие пользователи. Изменить нельзя.</p>
      <button
        onClick={create}
        disabled={loading}
        className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold py-3 rounded-lg"
      >
        Создать канал
      </button>
    </div>
  );
}

function FindChannelTab({ onCreated }: { onCreated: (c: Chat) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ChannelSearchResult[]>([]);

  useEffect(() => {
    if (!q.trim()) return setResults([]);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get<ChannelSearchResult[]>("/chats/channels/search", { params: { q } });
        setResults(data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const join = async (slug: string) => {
    try {
      const { data } = await api.post<Chat>(`/chats/channel/${encodeURIComponent(slug)}/join`, {});
      onCreated(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? "Не получилось");
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Поиск канала по @slug или названию"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
        className="w-full px-4 py-3 bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand mb-3"
      />
      <div className="max-h-96 overflow-y-auto space-y-1">
        {results.map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg">
            <Avatar id={c.id} name={c.title ?? "?"} size={40} />
            <div className="flex-1">
              <div className="font-semibold">{c.title}</div>
              <div className="text-xs text-slate-500">
                @{c.slug} · {c.memberCount} подписчиков
              </div>
            </div>
            <button
              onClick={() => c.slug && join(c.slug)}
              className="text-brand-dark font-semibold text-sm"
            >
              Подписаться
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
