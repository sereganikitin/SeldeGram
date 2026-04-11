"use client";

import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

export function Modal({ open, onClose, title, children, width = "max-w-md" }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 dark:text-white rounded-2xl shadow-2xl w-full ${width} max-h-[90dvh] flex flex-col overflow-hidden`}
      >
        {title && (
          <div className="px-5 py-4 border-b border-cream-border dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-lg">{title}</h2>
            <button onClick={onClose} className="text-ink-muted hover:text-ink dark:hover:text-white text-2xl leading-none">
              ×
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
