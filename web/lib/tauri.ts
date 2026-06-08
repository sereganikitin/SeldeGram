"use client";

// Лёгкий мост к Tauri runtime без зависимости от @tauri-apps/api.
// В Tauri 2 IPC доступен через глобальный объект __TAURI_INTERNALS__.
// В обычном браузере функции — no-op (возвращают null).

interface TauriInternals {
  invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

interface TauriWindow extends Window {
  __TAURI_INTERNALS__?: TauriInternals;
}

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as TauriWindow).__TAURI_INTERNALS__;
}

export async function tauriInvoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  if (!isTauri()) return null;
  const w = window as TauriWindow;
  return (await w.__TAURI_INTERNALS__!.invoke<T>(cmd, args ?? {})) ?? null;
}

// Хелперы для управления окном через встроенный плагин window Tauri 2.
export const tauri = {
  isAvailable: isTauri,

  minimize: () => tauriInvoke("plugin:window|minimize"),
  toggleMaximize: () => tauriInvoke("plugin:window|toggle_maximize"),
  isMaximized: () => tauriInvoke<boolean>("plugin:window|is_maximized"),
  startDragging: () => tauriInvoke("plugin:window|start_dragging"),

  // Кастомные команды на Rust-стороне:
  hideToTray: () => tauriInvoke("hide_window"),
  setUnreadCount: (count: number) =>
    tauriInvoke("set_unread_count", { count: Math.max(0, Math.floor(count)) }),
};
