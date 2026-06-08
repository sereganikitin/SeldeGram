"use client";

import { useEffect, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { tauri } from "@/lib/tauri";

// Кастомный титлбар рисуется только когда мы запущены внутри Tauri-окна
// (decorations:false убирает системный). В обычном браузере компонент
// возвращает null — никакого влияния на веб-версию.
export function DesktopTitleBar() {
  const [available, setAvailable] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    setAvailable(tauri.isAvailable());
  }, []);

  useEffect(() => {
    if (!available) return;
    const sync = async () => {
      const m = await tauri.isMaximized();
      setMaximized(!!m);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [available]);

  if (!available) return null;

  const onMinimize = () => tauri.minimize();
  const onToggleMax = async () => {
    await tauri.toggleMaximize();
    const m = await tauri.isMaximized();
    setMaximized(!!m);
  };
  const onClose = () => tauri.hideToTray();

  return (
    <div
      data-tauri-drag-region
      className="h-9 flex items-center justify-between select-none bg-gradient-to-r from-brand to-brand-dark text-white shadow-sm flex-shrink-0 relative z-50"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 pl-3 pointer-events-none"
      >
        <div className="w-5 h-5 rounded-md bg-white/25 backdrop-blur flex items-center justify-center text-[11px] font-extrabold shadow-inner">
          C
        </div>
        <span className="text-[13px] font-semibold tracking-tight">CraboGram</span>
      </div>

      <div
        className="flex items-center"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={onMinimize}
          className="w-11 h-9 flex items-center justify-center hover:bg-white/15 transition"
          title="Свернуть"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          onClick={onToggleMax}
          className="w-11 h-9 flex items-center justify-center hover:bg-white/15 transition"
          title={maximized ? "Восстановить" : "Развернуть"}
        >
          {maximized ? <Copy size={14} /> : <Square size={13} />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-9 flex items-center justify-center hover:bg-red-500/80 transition"
          title="Свернуть в трей"
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
