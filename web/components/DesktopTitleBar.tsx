"use client";

import { useEffect, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { tauri } from "@/lib/tauri";

// Кастомный титлбар внутри Tauri-окна (decorations:false). В браузере
// компонент возвращает null. Важная деталь: data-tauri-drag-region
// поглощает mousedown на всех потомках элемента с этим атрибутом —
// поэтому drag-region лежит ТОЛЬКО на логотипе/названии слева, а
// кнопки управления окном живут в собственном flex-контейнере без
// атрибута. Иначе кликами по min/max/close управляет не React-onClick,
// а Tauri start_dragging.
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

  const onMinimize = async () => {
    try { await tauri.minimize(); } catch (e) { console.error("minimize", e); }
  };
  const onToggleMax = async () => {
    try {
      const v = await tauri.toggleMaximize();
      setMaximized(!!v);
    } catch (e) { console.error("toggleMaximize", e); }
  };
  const onClose = async () => {
    try { await tauri.hideToTray(); } catch (e) { console.error("hideToTray", e); }
  };

  return (
    <div className="h-9 flex items-center select-none bg-gradient-to-r from-brand to-brand-dark text-white shadow-sm flex-shrink-0 relative z-50">
      {/* Drag-зона: только эта область двигает окно. */}
      <div
        data-tauri-drag-region
        className="flex-1 flex items-center gap-2 pl-3 h-full"
      >
        <div
          data-tauri-drag-region
          className="w-5 h-5 rounded-md bg-white/25 backdrop-blur flex items-center justify-center text-[11px] font-extrabold shadow-inner"
        >
          C
        </div>
        <span data-tauri-drag-region className="text-[13px] font-semibold tracking-tight">
          CraboGram
        </span>
      </div>

      {/* Контролы окна — вне drag-региона, поэтому клики попадают в onClick. */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={onMinimize}
          className="w-11 h-9 flex items-center justify-center hover:bg-white/15 transition cursor-pointer"
          title="Свернуть"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          onClick={onToggleMax}
          className="w-11 h-9 flex items-center justify-center hover:bg-white/15 transition cursor-pointer"
          title={maximized ? "Восстановить" : "Развернуть"}
        >
          {maximized ? <Copy size={14} /> : <Square size={13} />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-9 flex items-center justify-center hover:bg-red-500/80 transition cursor-pointer"
          title="Свернуть в трей"
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
