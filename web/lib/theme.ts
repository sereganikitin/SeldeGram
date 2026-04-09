"use client";

import { create } from "zustand";

export type ThemeMode = "system" | "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  systemDark: boolean;
  hydrated: boolean;
  hydrate: () => void;
  setMode: (mode: ThemeMode) => void;
}

function applyTheme(mode: ThemeMode, systemDark: boolean) {
  if (typeof document === "undefined") return;
  const isDark = mode === "dark" || (mode === "system" && systemDark);
  document.documentElement.classList.toggle("dark", isDark);
}

export const useTheme = create<ThemeState>()((set, get) => ({
  mode: "system",
  systemDark: false,
  hydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") {
      set({ hydrated: true });
      return;
    }
    const stored = (localStorage.getItem("themeMode") as ThemeMode | null) ?? "system";
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const systemDark = mq.matches;
    set({ mode: stored, systemDark, hydrated: true });
    applyTheme(stored, systemDark);

    mq.addEventListener("change", (e) => {
      set({ systemDark: e.matches });
      applyTheme(get().mode, e.matches);
    });
  },

  setMode: (mode) => {
    if (typeof window !== "undefined") localStorage.setItem("themeMode", mode);
    set({ mode });
    applyTheme(mode, get().systemDark);
  },
}));
