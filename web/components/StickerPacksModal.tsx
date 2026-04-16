"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StickerPack, StickerPackSearchResult } from "@/lib/types";
import { useAuth } from "@/lib/store";
import { uploadStickerFile } from "@/lib/media";
import { StickerImage } from "./StickerImage";
import { Modal } from "./Modal";
import { Search, ArrowLeft, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

type View = "list" | "search" | "create" | "pack";

export function StickerPacksModal({ open, onClose }: Props) {
  const meId = useAuth((s) => s.user?.id);
  const [view, setView] = useState<View>("list");
  const [my, setMy] = useState<StickerPack[]>([]);
  const [openPackId, setOpenPackId] = useState<string | null>(null);

  const loadMy = useCallback(async () => {
    const { data } = await api.get<StickerPack[]>("/stickers/my");
    setMy(data);
  }, []);

  useEffect(() => {
    if (open) {
      setView("list");
      setOpenPackId(null);
      loadMy();
    }
  }, [open, loadMy]);

  const openPack = (id: string) => {
    setOpenPackId(id);
    setView("pack");
  };

  return (
    <Modal open={open} onClose={onClose} title="Стикеры" width="max-w-lg">
      {view === "list" && (
        <div className="p-5">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setView("search")}
              className="flex-1 bg-cream-alt hover:bg-cream-border py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Search size={16} /> Поиск
            </button>
            <button
              onClick={() => setView("create")}
              className="flex-1 bg-brand hover:bg-brand-dark text-white py-2 rounded-lg font-semibold text-sm"
            >
              + Создать пак
            </button>
          </div>
          <div className="text-xs font-semibold text-ink-muted mb-2">МОИ ПАКИ</div>
          {my.length === 0 && <div className="text-ink-muted text-sm py-4 text-center">Пока ничего нет</div>}
          {my.map((p) => (
            <button
              key={p.id}
              onClick={() => openPack(p.id)}
              className="w-full flex items-center gap-3 p-2 hover:bg-cream rounded-lg text-left"
            >
              {p.coverKey ? (
                <StickerImage mediaKey={p.coverKey} size={48} />
              ) : (
                <div className="w-12 h-12 bg-slate-200 rounded" />
              )}
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-ink-muted">@{p.slug} · {p.stickers.length} стикеров</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {view === "search" && <SearchView onBack={() => { setView("list"); loadMy(); }} />}
      {view === "create" && <CreateView onCreated={(id) => openPack(id)} onCancel={() => setView("list")} />}
      {view === "pack" && openPackId && (
        <PackView packId={openPackId} meId={meId} onBack={() => { setView("list"); loadMy(); }} />
      )}
    </Modal>
  );
}

function SearchView({ onBack }: { onBack: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StickerPackSearchResult[]>([]);

  useEffect(() => {
    if (!q.trim()) return setResults([]);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get<StickerPackSearchResult[]>("/stickers/packs/search", { params: { q } });
        setResults(data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const install = async (id: string) => {
    try {
      await api.post(`/stickers/packs/${id}/install`, {});
      alert("Установлено");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? "Не получилось");
    }
  };

  return (
    <div className="p-5">
      <button onClick={onBack} className="text-brand-dark text-sm mb-3 flex items-center gap-1"><ArrowLeft size={16} /> Назад</button>
      <input
        type="text"
        autoFocus
        placeholder="Поиск по @slug или названию"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full px-4 py-3 bg-cream-alt rounded-lg focus:outline-none focus:ring-2 focus:ring-brand mb-3"
      />
      {results.map((p) => (
        <div key={p.id} className="flex items-center gap-3 p-2 hover:bg-cream rounded-lg">
          {p.coverKey ? <StickerImage mediaKey={p.coverKey} size={48} /> : <div className="w-12 h-12 bg-slate-200 rounded" />}
          <div className="flex-1">
            <div className="font-semibold">{p.name}</div>
            <div className="text-xs text-ink-muted">@{p.slug} · {p._count.stickers} стикеров</div>
          </div>
          <button onClick={() => install(p.id)} className="text-brand-dark font-semibold text-sm">Установить</button>
        </div>
      ))}
    </div>
  );
}

function CreateView({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!name.trim() || !slug.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post<StickerPack>("/stickers/packs", { name: name.trim(), slug: slug.trim() });
      onCreated(data.id);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? "Не получилось");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 space-y-3">
      <button onClick={onCancel} className="text-brand-dark text-sm flex items-center gap-1"><ArrowLeft size={16} /> Назад</button>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название пака"
        className="w-full px-4 py-3 bg-cream-alt rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <input
        value={slug}
        onChange={(e) => setSlug(e.target.value.toLowerCase())}
        placeholder="@slug (латиница)"
        className="w-full px-4 py-3 bg-cream-alt rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <button
        onClick={create}
        disabled={loading}
        className="w-full bg-brand hover:bg-brand-dark text-white py-3 rounded-lg font-semibold disabled:opacity-50"
      >
        Создать
      </button>
    </div>
  );
}

function PackView({ packId, meId, onBack }: { packId: string; meId: string | undefined; onBack: () => void }) {
  const [pack, setPack] = useState<StickerPack | null>(null);
  const [installed, setInstalled] = useState(false);
  const [emoji, setEmoji] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: p }, { data: my }] = await Promise.all([
      api.get<StickerPack>(`/stickers/packs/${packId}`),
      api.get<StickerPack[]>("/stickers/my"),
    ]);
    setPack(p);
    setInstalled(my.some((x) => x.id === packId));
  }, [packId]);

  useEffect(() => {
    load();
  }, [load]);

  const isAuthor = pack?.authorId === meId;

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPendingFile(f);
    e.target.value = "";
  };

  const confirmAdd = async () => {
    if (!pendingFile || !emoji) return;
    setBusy(true);
    try {
      const key = await uploadStickerFile(pendingFile);
      const mediaType = pendingFile.type || (pendingFile.name.toLowerCase().endsWith(".webm") ? "video/webm" : "image/png");
      await api.post(`/stickers/packs/${packId}/stickers`, { mediaKey: key, mediaType, emoji });
      setPendingFile(null);
      setEmoji("");
      await load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(err.message ?? "Не получилось");
    } finally {
      setBusy(false);
    }
  };

  const removeSticker = async (id: string) => {
    if (!confirm("Удалить стикер?")) return;
    await api.delete(`/stickers/packs/${packId}/stickers/${id}`);
    await load();
  };

  const install = async () => {
    await api.post(`/stickers/packs/${packId}/install`, {});
    await load();
  };
  const uninstall = async () => {
    await api.delete(`/stickers/packs/${packId}/install`);
    await load();
  };
  const deletePack = async () => {
    if (!confirm("Удалить пак у всех?")) return;
    await api.delete(`/stickers/packs/${packId}`);
    onBack();
  };

  if (!pack) return <div className="p-5 text-center text-ink-muted">Загрузка...</div>;

  return (
    <div className="p-5">
      <button onClick={onBack} className="text-brand-dark text-sm mb-3 flex items-center gap-1"><ArrowLeft size={16} /> Назад</button>
      <div className="text-center mb-4">
        <div className="text-xl font-bold">{pack.name}</div>
        <div className="text-sm text-ink-muted">@{pack.slug} · {pack.stickers.length} стикеров</div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {pack.stickers.map((s) => (
          <div key={s.id} className="relative group">
            <StickerImage mediaKey={s.mediaKey} mediaType={s.mediaType} size={70} />
            {isAuthor && (
              <button
                onClick={() => removeSticker(s.id)}
                className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100"
                title="Удалить"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {isAuthor && (
        <label className="block bg-brand hover:bg-brand-dark text-white text-center py-2 rounded-lg font-semibold cursor-pointer mb-2">
          + Добавить стикер
          <input type="file" accept="image/png,image/webp,image/jpeg,video/webm" hidden onChange={onPickFile} />
        </label>
      )}

      {!installed ? (
        <button onClick={install} className="w-full bg-cream-alt hover:bg-cream-alt py-2 rounded-lg font-semibold mb-2">
          Установить
        </button>
      ) : (
        <button onClick={uninstall} className="w-full bg-cream-alt hover:bg-cream-alt py-2 rounded-lg font-semibold mb-2">
          Удалить из своих
        </button>
      )}

      {isAuthor && (
        <button onClick={deletePack} className="w-full bg-red-50 text-red-600 py-2 rounded-lg font-semibold">
          Удалить пак
        </button>
      )}

      {pendingFile && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setPendingFile(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-xs space-y-3">
            <div className="text-center font-semibold">Эмодзи для стикера</div>
            <input
              autoFocus
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={4}
              placeholder="😀"
              className="w-full px-4 py-3 border-2 border-cream-border rounded-lg text-center text-2xl focus:outline-none focus:border-brand"
            />
            <div className="flex gap-2">
              <button onClick={() => setPendingFile(null)} className="flex-1 bg-cream-alt py-2 rounded-lg">Отмена</button>
              <button onClick={confirmAdd} disabled={busy || !emoji} className="flex-1 bg-brand text-white py-2 rounded-lg disabled:opacity-50">
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
