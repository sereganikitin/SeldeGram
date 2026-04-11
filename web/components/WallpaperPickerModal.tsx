"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { WALLPAPER_PRESETS } from "@/lib/wallpapers";
import { api } from "@/lib/api";
import { uploadFile } from "@/lib/media";
import { useAuth } from "@/lib/store";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Если задан — обои конкретного чата, иначе глобальные. */
  chatId?: string;
  onApplied?: () => void;
}

export function WallpaperPickerModal({ open, onClose, chatId, onApplied }: Props) {
  const patchMe = useAuth((s) => s.patchMe);
  const [uploading, setUploading] = useState(false);

  const apply = async (value: string | null) => {
    try {
      if (chatId) {
        await api.patch(`/chats/${chatId}/wallpaper`, { wallpaper: value });
      } else {
        await api.patch("/me", { defaultWallpaper: value });
        patchMe({ defaultWallpaper: value });
      }
      onApplied?.();
      onClose();
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(err.message ?? "Не получилось");
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    setUploading(true);
    try {
      const { key } = await uploadFile(f);
      await apply(`media:${key}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(err.message ?? "Не получилось");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={chatId ? "Обои чата" : "Обои по умолчанию"} width="max-w-md">
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3 mb-4">
          {WALLPAPER_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => apply(p.id === "default" ? null : `preset:${p.id}`)}
              className="aspect-[4/3] rounded-xl border border-cream-border dark:border-slate-700 flex items-end p-3 hover:scale-[1.02] transition relative overflow-hidden"
              style={{ backgroundColor: p.color2 ?? p.color1 }}
            >
              {p.patternSvg && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  dangerouslySetInnerHTML={{ __html: p.patternSvg }}
                />
              )}
              <span
                className="relative z-10 text-ink font-semibold text-sm"
                style={{ textShadow: "0 1px 3px rgba(255,255,255,0.7)" }}
              >
                {p.name}
              </span>
            </button>
          ))}
        </div>

        <label className="block w-full bg-brand hover:bg-brand-dark text-white text-center py-3 rounded-lg font-semibold cursor-pointer mb-2">
          {uploading ? "Загрузка..." : "📷 Загрузить своё фото"}
          <input type="file" accept="image/*" hidden onChange={onPickFile} />
        </label>

        {chatId && (
          <button
            onClick={() => apply(null)}
            className="w-full bg-cream-alt dark:bg-slate-800 dark:text-white hover:bg-cream-alt dark:hover:bg-slate-700 py-3 rounded-lg font-semibold"
          >
            Сбросить (как по умолчанию)
          </button>
        )}
      </div>
    </Modal>
  );
}
