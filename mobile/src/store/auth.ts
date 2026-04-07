import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  isVerified: boolean;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  hydrated: false,

  hydrate: async () => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      try {
        const { data } = await api.get<User>('/me');
        set({ user: data });
      } catch {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
      }
    }
    set({ hydrated: true });
  },

  setTokens: async (accessToken, refreshToken) => {
    await AsyncStorage.setItem('accessToken', accessToken);
    await AsyncStorage.setItem('refreshToken', refreshToken);
  },

  fetchMe: async () => {
    const { data } = await api.get<User>('/me');
    set({ user: data });
  },

  logout: async () => {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
    set({ user: null });
  },
}));
