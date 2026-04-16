"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Sticker, StickerPack } from "@/lib/types";
import { StickerImage } from "./StickerImage";
import { Settings } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  stickers: Sticker[];
}

interface Props {
  onPick: (stickerId: string) => void;
  onOpenManage: () => void;
}

export function StickerPicker({ onPick, onOpenManage }: Props) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [recentResp, packsResp] = await Promise.all([
          api.get<Sticker[]>("/stickers/recent"),
          api.get<StickerPack[]>("/stickers/my"),
        ]);
        const t: Tab[] = [];
        if (recentResp.data.length > 0) t.push({ id: "recent", label: "🕒", stickers: recentResp.data });
        for (const p of packsResp.data) {
          t.push({ id: p.id, label: p.name.substring(0, 2).toUpperCase(), stickers: p.stickers });
        }
        setTabs(t);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="h-72 flex items-center justify-center text-ink-muted">Загрузка...</div>;

  if (tabs.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center gap-3 text-ink-muted">
        <div>У вас нет установленных стикерпаков</div>
        <button onClick={onOpenManage} className="text-brand-dark font-semibold">
          Открыть стикерпаки
        </button>
      </div>
    );
  }

  const active = tabs[activeIdx];

  return (
    <div className="h-80 bg-white border-t border-cream-border flex flex-col">
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-6 sm:grid-cols-8 gap-2">
        {active.stickers.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className="flex items-center justify-center hover:bg-cream-alt rounded p-1"
          >
            <StickerImage mediaKey={s.mediaKey} mediaType={s.mediaType} size={64} />
          </button>
        ))}
      </div>
      <div className="flex border-t border-cream-border bg-cream">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setActiveIdx(i)}
            className={`px-3 py-2 text-sm font-semibold ${
              i === activeIdx ? "border-t-2 border-brand text-brand-dark" : "text-ink-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={onOpenManage}
          className="ml-auto px-3 py-2 text-brand-dark"
          title="Управление стикерами"
        >
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
}
