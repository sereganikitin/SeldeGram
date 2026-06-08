"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  children: React.ReactNode;
}

const STORAGE_KEY = "sidebarWidth";
const MIN = 240;
const MAX = 560;
const DEFAULT = 340;

function readStoredWidth(): number {
  if (typeof window === "undefined") return DEFAULT;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= MIN && n <= MAX) return n;
  return DEFAULT;
}

// На мобильных (< md ≈ 768) sidebar занимает всю ширину; resize отключён.
// На больших — фиксированная ширина с draggable handle справа.
export function ResizableSidebar({ children }: Props) {
  const [width, setWidth] = useState(DEFAULT);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, w: DEFAULT });

  useEffect(() => {
    setWidth(readStoredWidth());
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, w: width };
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [width]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startRef.current.x;
    const next = Math.min(MAX, Math.max(MIN, startRef.current.w + dx));
    setWidth(next);
  }, [dragging]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    try { window.localStorage.setItem(STORAGE_KEY, String(width)); } catch {}
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }, [dragging, width]);

  return (
    <div
      className="relative flex flex-shrink-0 w-full md:w-[var(--sw)]"
      style={{ ["--sw" as never]: `${width}px` }}
    >
      <div className="flex flex-1 min-w-0">{children}</div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`hidden md:block absolute top-0 right-0 h-full w-1.5 -mr-0.5 cursor-col-resize group z-20 ${dragging ? "" : ""}`}
        title="Перетащить, чтобы изменить ширину"
      >
        <div className={`h-full w-px mx-auto transition-colors ${dragging ? "bg-brand" : "bg-transparent group-hover:bg-brand/60"}`} />
      </div>
    </div>
  );
}
