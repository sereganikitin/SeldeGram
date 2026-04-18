// Цвета для аватаров — подбираются детерминированно по id
const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFD93D', '#6BCB77', '#4D96FF',
  '#9D4EDD', '#FF9F1C', '#2EC4B6', '#E71D36', '#7B2CBF',
];

export function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(d, today)) return 'Сегодня';
  if (sameDay(d, yesterday)) return 'Вчера';

  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);
  if (d >= weekAgo) return WEEKDAYS[d.getDay()];

  if (d.getFullYear() === today.getFullYear()) {
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Возвращает короткое превью сообщения (для списка чатов и для reply quote)
export function messagePreview(msg: {
  content: string;
  mediaType?: string | null;
  mediaKey?: string | null;
  isSticker?: boolean;
  deletedAt?: string | null;
}): string {
  if (msg.deletedAt) return 'удалено';
  if (msg.isSticker) return `${msg.content || ''} Стикер`.trim();
  if (msg.mediaType?.startsWith('audio/')) return 'Голосовое';
  if (msg.content) return msg.content;
  if (msg.mediaType?.startsWith('image/')) return 'Фото';
  if (msg.mediaType?.startsWith('video/')) return 'Видео';
  if (msg.mediaKey) return 'Файл';
  return '';
}

export function groupReactions(reactions: Array<{ emoji: string; userId: string }>): Array<{ emoji: string; count: number; userIds: string[] }> {
  const map = new Map<string, string[]>();
  for (const r of reactions) {
    const arr = map.get(r.emoji) || [];
    arr.push(r.userId);
    map.set(r.emoji, arr);
  }
  return Array.from(map.entries()).map(([emoji, userIds]) => ({ emoji, count: userIds.length, userIds }));
}

export function lastSeenText(lastSeenAt: string | null | undefined, isOnline?: boolean): string {
  if (isOnline) return 'в сети';
  if (!lastSeenAt) return 'был давно';
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `был ${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `был ${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `был ${days} дн назад`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
