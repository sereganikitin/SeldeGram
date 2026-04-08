import { create } from 'zustand';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Colors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  bubbleMine: string;
  bubbleMineText: string;
  bubbleOther: string;
  bubbleOtherText: string;
  danger: string;
  shadow: string;
}

export const lightColors: Colors = {
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f5f5f5',
  border: '#e5e5e5',
  text: '#000000',
  textMuted: '#777777',
  primary: '#0a84ff',
  primaryText: '#ffffff',
  bubbleMine: '#0a84ff',
  bubbleMineText: '#ffffff',
  bubbleOther: '#eef0f3',
  bubbleOtherText: '#000000',
  danger: '#d33',
  shadow: '#0001',
};

export const darkColors: Colors = {
  bg: '#0d0d0f',
  surface: '#1a1a1d',
  surfaceAlt: '#222226',
  border: '#2c2c30',
  text: '#f5f5f5',
  textMuted: '#9a9a9f',
  primary: '#0a84ff',
  primaryText: '#ffffff',
  bubbleMine: '#0a84ff',
  bubbleMineText: '#ffffff',
  bubbleOther: '#26272b',
  bubbleOtherText: '#f5f5f5',
  danger: '#ff5c5c',
  shadow: '#0008',
};

interface ThemeState {
  mode: ThemeMode;
  systemScheme: 'light' | 'dark';
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
}

export const useTheme = create<ThemeState>((set) => ({
  mode: 'system',
  systemScheme: (Appearance.getColorScheme() as 'light' | 'dark') ?? 'light',
  hydrated: false,
  hydrate: async () => {
    const stored = (await AsyncStorage.getItem('themeMode')) as ThemeMode | null;
    set({ mode: stored ?? 'system', hydrated: true });
    Appearance.addChangeListener(({ colorScheme }) =>
      set({ systemScheme: (colorScheme as 'light' | 'dark') ?? 'light' }),
    );
  },
  setMode: async (mode) => {
    await AsyncStorage.setItem('themeMode', mode);
    set({ mode });
  },
}));

export function useColors(): Colors {
  const mode = useTheme((s) => s.mode);
  const sys = useTheme((s) => s.systemScheme);
  const effective = mode === 'system' ? sys : mode;
  return effective === 'dark' ? darkColors : lightColors;
}

export function useIsDark(): boolean {
  const mode = useTheme((s) => s.mode);
  const sys = useTheme((s) => s.systemScheme);
  return (mode === 'system' ? sys : mode) === 'dark';
}
