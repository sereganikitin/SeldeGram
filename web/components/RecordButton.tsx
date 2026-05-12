"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Camera } from "lucide-react";
import { IconButton } from "./IconButton";

interface Props {
  disabled?: boolean;
  onVoice: () => void;
  onVideoNote: () => void;
}

type Mode = "voice" | "video";

const STORAGE_KEY = "recordMode";
const LONG_PRESS_MS = 450;

function readMode(): Mode {
  if (typeof window === "undefined") return "voice";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "video" ? "video" : "voice";
}

export function RecordButton({ disabled, onVoice, onVideoNote }: Props) {
  const [mode, setMode] = useState<Mode>("voice");
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);

  useEffect(() => {
    setMode(readMode());
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [menuOpen]);

  const trigger = () => {
    if (disabled) return;
    if (mode === "video") onVideoNote();
    else onVoice();
  };

  const choose = (next: Mode) => {
    setMode(next);
    setMenuOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    if (next === "video") onVideoNote();
    else onVoice();
  };

  const onPointerDown = () => {
    longPressedRef.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressedRef.current = true;
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  };

  const onPointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!longPressedRef.current) trigger();
  };

  const onPointerLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(true);
  };

  const Icon = mode === "video" ? Camera : Mic;
  const title = mode === "video" ? "Видеосообщение (удерж. для выбора)" : "Голосовое (удерж. для выбора)";

  return (
    <div ref={wrapRef} className="relative flex-shrink-0">
      <IconButton
        icon={Icon}
        size="md"
        disabled={disabled}
        title={title}
        className="disabled:opacity-40"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onContextMenu={onContextMenu}
      />

      {menuOpen && (
        <div className="absolute bottom-full mb-2 right-0 z-40 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-cream-border dark:border-slate-700 py-1 w-52">
          <button
            type="button"
            onClick={() => choose("voice")}
            className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-cream-alt dark:hover:bg-slate-700 dark:text-white"
          >
            <Mic size={18} className="text-brand-dark dark:text-brand" />
            <span>Голосовое</span>
            {mode === "voice" && <span className="ml-auto text-xs text-brand-dark dark:text-brand">●</span>}
          </button>
          <button
            type="button"
            onClick={() => choose("video")}
            className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-cream-alt dark:hover:bg-slate-700 dark:text-white"
          >
            <Camera size={18} className="text-brand-dark dark:text-brand" />
            <span>Видеосообщение</span>
            {mode === "video" && <span className="ml-auto text-xs text-brand-dark dark:text-brand">●</span>}
          </button>
        </div>
      )}
    </div>
  );
}
