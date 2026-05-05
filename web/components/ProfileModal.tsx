"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { useAuth } from "@/lib/store";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { api } from "@/lib/api";
import { uploadFile } from "@/lib/media";
import { Image as ImageIcon, Ban, LogOut, ShieldCheck } from "lucide-react";
import { TwoFactorModal } from "./TwoFactorModal";

interface Props {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  onOpenWallpaper: () => void;
  onOpenBlockList: () => void;
}

export function ProfileModal({ open, onClose, onLogout, onOpenWallpaper, onOpenBlockList }: Props) {
  const user = useAuth((s) => s.user);
  const patchMe = useAuth((s) => s.patchMe);
  const [twoFaOpen, setTwoFaOpen] = useState(false);
  const themeMode = useTheme((s) => s.mode);
  const setThemeMode = useTheme((s) => s.setMode);
  const [name, setName] = useState(user?.displayName ?? "");
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const saveName = async () => {
    if (!name.trim() || name === user.displayName) return;
    try {
      const { data } = await api.patch("/me", { displayName: name.trim() });
      patchMe(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? "Не получилось");
    }
  };

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    setUploading(true);
    try {
      const { key } = await uploadFile(f);
      const { data } = await api.patch("/me", { avatarKey: key });
      patchMe(data);
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(err.message ?? "Не получилось");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Профиль" width="max-w-md">
      <div className="p-5 space-y-5">
        <div className="flex flex-col items-center">
          <label className="cursor-pointer relative">
            <Avatar id={user.id} name={user.displayName} avatarKey={user.avatarKey} size={120} />
            <input type="file" accept="image/*" hidden onChange={onPickAvatar} />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm rounded-full opacity-0 hover:opacity-100 transition">
              {uploading ? "Загрузка..." : "Изменить"}
            </div>
          </label>
        </div>

        <div>
          <label className="block text-xs text-ink-muted dark:text-ink-muted mb-1">Имя</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            className="w-full px-4 py-3 bg-cream-alt dark:bg-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div className="text-sm text-ink-muted dark:text-ink-muted space-y-1">
          <div>@{user.username}</div>
          <div>{user.email}</div>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2 dark:text-white">Тема</div>
          <div className="flex gap-2">
            {(["system", "light", "dark"] as ThemeMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setThemeMode(m)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
                  themeMode === m
                    ? "bg-brand text-white border-brand"
                    : "bg-white dark:bg-slate-800 border-cream-border dark:border-slate-700 dark:text-white hover:bg-cream dark:hover:bg-slate-700"
                }`}
              >
                {m === "system" ? "Системная" : m === "light" ? "Светлая" : "Тёмная"}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onOpenWallpaper}
          className="w-full bg-cream-alt dark:bg-slate-800 dark:text-white hover:bg-cream-border dark:hover:bg-slate-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
        >
          <ImageIcon size={18} className="text-brand-dark" /> Обои по умолчанию
        </button>

        <button
          onClick={onOpenBlockList}
          className="w-full bg-cream-alt dark:bg-slate-800 dark:text-white hover:bg-cream-border dark:hover:bg-slate-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
        >
          <Ban size={18} className="text-brand-dark" /> Заблокированные
        </button>

        <button
          onClick={() => setTwoFaOpen(true)}
          className="w-full bg-cream-alt dark:bg-slate-800 dark:text-white hover:bg-cream-border dark:hover:bg-slate-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
        >
          <ShieldCheck size={18} className="text-brand-dark" />
          {user?.totpEnabled ? "2FA: включена" : "Включить 2FA"}
        </button>

        <TwoFactorModal open={twoFaOpen} onClose={() => setTwoFaOpen(false)} />

        <button
          onClick={onLogout}
          className="w-full bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
        >
          <LogOut size={18} /> Выйти
        </button>
      </div>
    </Modal>
  );
}
