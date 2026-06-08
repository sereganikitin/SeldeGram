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
  try {
    return (await w.__TAURI_INTERNALS__!.invoke<T>(cmd, args ?? {})) ?? null;
  } catch (e) {
    console.error("[tauri.invoke]", cmd, e);
    throw e;
  }
}

// Хелперы для управления окном — все через собственные Rust-команды,
// чтобы обойти permission-юниты Tauri 2 (которые могут меняться от
// версии к версии). Тонкая ярлычная обёртка над invoke().
export const tauri = {
  isAvailable: isTauri,

  minimize: () => tauriInvoke("minimize_window"),
  toggleMaximize: () => tauriInvoke<boolean>("toggle_maximize_window"),
  isMaximized: () => tauriInvoke<boolean>("is_maximized_window"),
  startDragging: () => tauriInvoke("start_dragging_window"),

  hideToTray: () => tauriInvoke("hide_window"),
  setUnreadCount: (count: number) =>
    tauriInvoke("set_unread_count", { count: Math.max(0, Math.floor(count)) }),

  // VPN
  vpnList: () => tauriInvoke<{ profiles: VpnProfile[]; active_id: string | null }>("vpn_list_profiles"),
  vpnImportLink: (link: string) => tauriInvoke<VpnProfile>("vpn_import_link", { link }),
  vpnImportJson: (json: string, name: string) =>
    tauriInvoke<VpnProfile>("vpn_import_json", { json, name }),
  vpnDelete: (id: string) => tauriInvoke<void>("vpn_delete_profile", { id }),
  vpnConnect: (id: string) => tauriInvoke<VpnStatus>("vpn_connect", { id }),
  vpnDisconnect: () => tauriInvoke<VpnStatus>("vpn_disconnect"),
  vpnStatus: () => tauriInvoke<VpnStatus>("vpn_status"),
};

export interface VpnProfile {
  id: string;
  name: string;
  kind: string;
  server: string | null;
  outbound: unknown;
  created_at: string;
}

export interface VpnStatus {
  connected: boolean;
  active_id: string | null;
  socks_port: number;
}
