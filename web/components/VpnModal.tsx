"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Plus, Trash2, ShieldCheck, ShieldOff, Link2, FileJson, Globe } from "lucide-react";
import { tauri, type VpnProfile, type VpnStatus } from "@/lib/tauri";

interface Props {
  open: boolean;
  onClose: () => void;
}

type ImportMode = "link" | "json";

export function VpnModal({ open, onClose }: Props) {
  const [profiles, setProfiles] = useState<VpnProfile[]>([]);
  const [status, setStatus] = useState<VpnStatus | null>(null);
  const [mode, setMode] = useState<ImportMode | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [jsonName, setJsonName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const r = await tauri.vpnList();
    if (r) setProfiles(r.profiles);
    const s = await tauri.vpnStatus();
    if (s) setStatus(s);
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  if (!open) return null;

  const showError = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    setError(msg);
  };

  const pasteFromClipboard = async (target: "link" | "json") => {
    try {
      const text = await navigator.clipboard.readText();
      if (target === "link") setLinkInput(text.trim());
      else setJsonInput(text);
    } catch {
      showError("Не удалось прочитать буфер обмена");
    }
  };

  const importLink = async () => {
    setError(null);
    setBusy(true);
    try {
      const profile = await tauri.vpnImportLink(linkInput.trim());
      if (!profile) throw new Error("not in tauri");
      setLinkInput("");
      setMode(null);
      await refresh();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const importJson = async () => {
    setError(null);
    setBusy(true);
    try {
      const profile = await tauri.vpnImportJson(jsonInput, jsonName.trim() || "JSON profile");
      if (!profile) throw new Error("not in tauri");
      setJsonInput("");
      setJsonName("");
      setMode(null);
      await refresh();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const importFile = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      setBusy(true);
      try {
        await tauri.vpnImportJson(text, file.name.replace(/\.json$/i, ""));
        await refresh();
      } catch (e) {
        showError(e);
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };

  const connect = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      const s = await tauri.vpnConnect(id);
      if (s) setStatus(s);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setError(null);
    setBusy(true);
    try {
      const s = await tauri.vpnDisconnect();
      if (s) setStatus(s);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить профиль?")) return;
    setBusy(true);
    try {
      await tauri.vpnDelete(id);
      await refresh();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const connected = !!status?.connected;
  const activeId = status?.active_id ?? null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-cream-border dark:border-slate-700 flex items-center gap-3">
          {connected ? (
            <ShieldCheck size={22} className="text-green-500" />
          ) : (
            <ShieldOff size={22} className="text-ink-muted" />
          )}
          <div className="flex-1">
            <div className="font-semibold dark:text-white">VPN</div>
            <div className="text-xs text-ink-muted">
              {connected
                ? `Подключено · 127.0.0.1:${status?.socks_port}`
                : "Отключено"}
            </div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink dark:hover:text-white" title="Закрыть">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="px-5 py-2 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 text-sm border-b border-red-100 dark:border-red-900">
            {error}
          </div>
        )}

        <div className="overflow-y-auto flex-1 scrollbar-pink">
          {profiles.length === 0 && mode === null && (
            <div className="p-6 text-center text-ink-muted text-sm">
              Профилей пока нет. Импортируй из буфера обмена, JSON или файла.
            </div>
          )}

          {profiles.length > 0 && (
            <div className="p-3 space-y-2">
              {profiles.map((p) => {
                const isActive = activeId === p.id && connected;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      isActive
                        ? "border-brand bg-brand/5"
                        : "border-cream-border dark:border-slate-700 bg-cream/40 dark:bg-slate-800/40"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white flex items-center justify-center text-xs font-bold uppercase">
                      {p.kind.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm dark:text-white truncate">{p.name}</div>
                      <div className="text-xs text-ink-muted truncate">
                        {p.kind}{p.server ? ` · ${p.server}` : ""}
                      </div>
                    </div>
                    {isActive ? (
                      <button
                        onClick={disconnect}
                        disabled={busy}
                        className="px-3 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        Отключить
                      </button>
                    ) : (
                      <button
                        onClick={() => connect(p.id)}
                        disabled={busy}
                        className="px-3 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white text-xs font-semibold disabled:opacity-50"
                      >
                        Подключить
                      </button>
                    )}
                    <button
                      onClick={() => remove(p.id)}
                      disabled={busy}
                      className="p-1.5 text-ink-muted hover:text-red-500"
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {mode === "link" && (
            <div className="p-4 border-t border-cream-border dark:border-slate-700 space-y-3">
              <div className="text-xs text-ink-muted">
                Поддерживаются: vless://, hy2://, hysteria2://, ss://, socks5://
              </div>
              <textarea
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="vless://uuid@host:port?security=tls&..."
                rows={3}
                className="w-full p-2 rounded-lg border border-cream-border dark:border-slate-700 bg-cream-alt dark:bg-slate-800 dark:text-white text-sm font-mono"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => pasteFromClipboard("link")}
                  className="px-3 h-9 rounded-lg bg-cream-alt dark:bg-slate-800 text-ink dark:text-white text-sm border border-cream-border dark:border-slate-700"
                >
                  Из буфера
                </button>
                <button
                  onClick={importLink}
                  disabled={!linkInput.trim() || busy}
                  className="flex-1 h-9 rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white text-sm font-semibold disabled:opacity-50"
                >
                  Добавить
                </button>
                <button onClick={() => setMode(null)} className="px-3 h-9 text-ink-muted text-sm">
                  Отмена
                </button>
              </div>
            </div>
          )}

          {mode === "json" && (
            <div className="p-4 border-t border-cream-border dark:border-slate-700 space-y-3">
              <input
                value={jsonName}
                onChange={(e) => setJsonName(e.target.value)}
                placeholder="Название профиля"
                className="w-full px-3 h-9 rounded-lg border border-cream-border dark:border-slate-700 bg-cream-alt dark:bg-slate-800 dark:text-white text-sm"
              />
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='{"type":"vless","server":"...","server_port":443,...}'
                rows={8}
                className="w-full p-2 rounded-lg border border-cream-border dark:border-slate-700 bg-cream-alt dark:bg-slate-800 dark:text-white text-xs font-mono"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => pasteFromClipboard("json")}
                  className="px-3 h-9 rounded-lg bg-cream-alt dark:bg-slate-800 text-ink dark:text-white text-sm border border-cream-border dark:border-slate-700"
                >
                  Из буфера
                </button>
                <button
                  onClick={importJson}
                  disabled={!jsonInput.trim() || busy}
                  className="flex-1 h-9 rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white text-sm font-semibold disabled:opacity-50"
                >
                  Добавить
                </button>
                <button onClick={() => setMode(null)} className="px-3 h-9 text-ink-muted text-sm">
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>

        {mode === null && (
          <div className="p-3 border-t border-cream-border dark:border-slate-700 grid grid-cols-3 gap-2">
            <button
              onClick={() => setMode("link")}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-cream-alt dark:bg-slate-800 hover:bg-cream-border dark:hover:bg-slate-700 text-ink dark:text-white"
            >
              <Link2 size={20} className="text-brand-dark dark:text-brand" />
              <span className="text-xs font-semibold">Ссылка</span>
            </button>
            <button
              onClick={() => setMode("json")}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-cream-alt dark:bg-slate-800 hover:bg-cream-border dark:hover:bg-slate-700 text-ink dark:text-white"
            >
              <FileJson size={20} className="text-brand-dark dark:text-brand" />
              <span className="text-xs font-semibold">JSON</span>
            </button>
            <button
              onClick={importFile}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-cream-alt dark:bg-slate-800 hover:bg-cream-border dark:hover:bg-slate-700 text-ink dark:text-white"
            >
              <Globe size={20} className="text-brand-dark dark:text-brand" />
              <span className="text-xs font-semibold">.json файл</span>
            </button>
          </div>
        )}

        <div className="px-5 py-2 text-[11px] text-ink-muted border-t border-cream-border dark:border-slate-700">
          ⚠️ MVP: VPN-туннель поднимается, но WebView пока не маршрутизирует через него
          автоматически — нужен ручной флаг или перезапуск приложения. Полная интеграция
          в следующей итерации.
        </div>
      </div>
    </div>
  );
}
