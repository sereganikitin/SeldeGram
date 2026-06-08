"use client";

import { useEffect, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { tauri } from "@/lib/tauri";

// Кастомный титлбар внутри Tauri-окна (decorations:false).
// Drag реализован ВРУЧНУЮ через mousedown → start_dragging_window вместо
// data-tauri-drag-region — у атрибутного варианта на разных билд-окнах
// были конфликты с обработкой кликов. Атрибуты остаются как fallback на
// случай, если runtime их подхватит.
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

  const onDragDown = (e: React.MouseEvent) => {
    // Только основная кнопка, без модификаторов, не на самих кнопках.
    if (e.button !== 0) return;
    const tgt = e.target as HTMLElement;
    if (tgt.closest("[data-no-drag]")) return;
    tauri.startDragging().catch((err) => console.error("startDragging", err));
  };

  const onDragDoubleClick = async (e: React.MouseEvent) => {
    const tgt = e.target as HTMLElement;
    if (tgt.closest("[data-no-drag]")) return;
    try {
      const v = await tauri.toggleMaximize();
      setMaximized(!!v);
    } catch (err) {
      console.error("toggleMaximize (dblclick)", err);
    }
  };

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

  const onContextMenu = (e: React.MouseEvent) => {
    // Заблокировать кастомный веб-context-menu в зоне титлбара —
    // там ему делать нечего.
    e.preventDefault();
  };

  return (
    <div
      className="h-9 flex items-center bg-gradient-to-r from-brand to-brand-dark text-white shadow-sm flex-shrink-0 relative z-50 select-none"
      onMouseDown={onDragDown}
      onDoubleClick={onDragDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div
        className="flex-1 flex items-center gap-2 pl-3 h-full"
      >
        <div
          className="w-5 h-5 rounded-md bg-white/25 backdrop-blur flex items-center justify-center text-[11px] font-extrabold shadow-inner pointer-events-none"
        >
          C
        </div>
        <span className="text-[13px] font-semibold tracking-tight pointer-events-none">
          CraboGram
        </span>
      </div>

      {/* Контролы — data-no-drag отключает наш мануальный drag, плюс эти
         элементы не попадают в data-tauri-drag-region-цепочку благодаря
         тому, что они в отдельном flex-контейнере без атрибута. */}
      <div className="flex items-center" data-no-drag>
        <button
          type="button"
          onClick={onMinimize}
          className="w-11 h-9 flex items-center justify-center hover:bg-white/15 transition cursor-pointer"
          title="Свернуть"
          data-no-drag
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          onClick={onToggleMax}
          className="w-11 h-9 flex items-center justify-center hover:bg-white/15 transition cursor-pointer"
          title={maximized ? "Восстановить" : "Развернуть"}
          data-no-drag
        >
          {maximized ? <Copy size={14} /> : <Square size={13} />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-9 flex items-center justify-center hover:bg-red-500/80 transition cursor-pointer"
          title="Свернуть в трей"
          data-no-drag
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
