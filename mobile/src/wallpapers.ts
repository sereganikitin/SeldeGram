import { WALLPAPER_SVGS } from './wallpapersSvg';

// Готовые обои чатов. Формат значения: "preset:name" или "media:key" или null (по умолчанию).
export interface WallpaperPreset {
  id: string;
  name: string;
  // Простой однотонный или градиент через два цвета
  color1: string;
  color2?: string;
  // Сырая SVG-строка. Если задана — рендерится через react-native-svg SvgXml поверх color.
  patternSvg?: string;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { id: 'default', name: 'По умолчанию', color1: '#ffffff' },
  { id: 'pink_fish', name: 'Рыбки', color1: '#ffd4e1', patternSvg: WALLPAPER_SVGS.pink_fish },
  { id: 'coral_crab', name: 'Крабики', color1: '#ffc4cc', patternSvg: WALLPAPER_SVGS.coral_crab },
  { id: 'pink_sea', name: 'Розовое море', color1: '#ffdbe8', patternSvg: WALLPAPER_SVGS.pink_sea },
  { id: 'mint', name: 'Мята', color1: '#e0f7f1', color2: '#a8e6cf' },
  { id: 'sky', name: 'Небо', color1: '#dbeeff', color2: '#a8d4ff' },
  { id: 'rose', name: 'Розовый', color1: '#ffe8ec', color2: '#ffc1cc' },
  { id: 'sand', name: 'Песок', color1: '#fff5e0', color2: '#ffd8a8' },
  { id: 'lavender', name: 'Лаванда', color1: '#efe6ff', color2: '#c8b6ff' },
  { id: 'forest', name: 'Лес', color1: '#1a3a2e', color2: '#0d1f17' },
  { id: 'ocean', name: 'Океан', color1: '#0a2540', color2: '#082030' },
  { id: 'sunset', name: 'Закат', color1: '#ff7e5f', color2: '#feb47b' },
  { id: 'graphite', name: 'Графит', color1: '#2c2c30', color2: '#16161a' },
];

export function parseWallpaper(value: string | null | undefined): { kind: 'preset'; preset: WallpaperPreset } | { kind: 'media'; key: string } | null {
  if (!value) return null;
  if (value.startsWith('preset:')) {
    const id = value.substring(7);
    const preset = WALLPAPER_PRESETS.find((p) => p.id === id);
    if (preset) return { kind: 'preset', preset };
    return null;
  }
  if (value.startsWith('media:')) {
    return { kind: 'media', key: value.substring(6) };
  }
  return null;
}
