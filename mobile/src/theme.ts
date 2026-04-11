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
  bg: '#fff5f9',
  surface: '#ffffff',
  surfaceAlt: '#ffe8f0',
  border: '#ffd4e1',
  text: '#3d1a28',
  textMuted: '#8c6471',
  primary: '#ff7a99',
  primaryText: '#ffffff',
  bubbleMine: '#ff7a99',
  bubbleMineText: '#ffffff',
  bubbleOther: '#ffe8f0',
  bubbleOtherText: '#3d1a28',
  danger: '#d63a60',
  shadow: '#ff7a9922',
};

export const darkColors: Colors = {
  bg: '#1a0b12',
  surface: '#2a141f',
  surfaceAlt: '#3a1c2b',
  border: '#4a2637',
  text: '#ffe8f0',
  textMuted: '#b59aa4',
  primary: '#ff8fa8',
  primaryText: '#ffffff',
  bubbleMine: '#ff7a99',
  bubbleMineText: '#ffffff',
  bubbleOther: '#3a1c2b',
  bubbleOtherText: '#ffe8f0',
  danger: '#ff5c7c',
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
