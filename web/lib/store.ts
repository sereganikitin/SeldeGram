"use client";

import { create } from "zustand";
import { api } from "./api";
import { User } from "./types";

interface AuthState {
  user: User | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  fetchMe: () => Promise<void>;
  patchMe: (changes: Partial<User>) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()((set) => ({
  user: null,
  hydrated: false,

  hydrate: async () => {
    if (typeof window === "undefined") {
      set({ hydrated: true });
      return;
    }
    const token = localStorage.getItem("accessToken");
    if (token) {
      try {
        const { data } = await api.get<User>("/me");
        set({ user: data });
      } catch {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
      }
    }
    set({ hydrated: true });
  },

  setTokens: (accessToken, refreshToken) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
    }
  },

  fetchMe: async () => {
    const { data } = await api.get<User>("/me");
    set({ user: data });
  },

  patchMe: (changes) => {
    set((s) => (s.user ? { user: { ...s.user, ...changes } } : s));
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
    set({ user: null });
  },
}));
