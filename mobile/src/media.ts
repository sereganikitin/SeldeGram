import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from './api';

interface PresignResp {
  uploadUrl: string;
  key: string;
}

// Загружает локальный файл в S3 через presigned URL.
// fileUri — локальный путь (file://...), contentType — MIME, size — в байтах.
export async function uploadMedia(fileUri: string, contentType: string, size: number): Promise<string> {
  const { data } = await api.post<PresignResp>('/media/presign', { contentType, size });

  // Читаем файл как blob и шлём PUT
  const fileResp = await fetch(fileUri);
  const blob = await fileResp.blob();

  const putResp = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!putResp.ok) {
    throw new Error(`Upload failed: ${putResp.status} ${putResp.statusText}`);
  }
  return data.key;
}

// Получает временный URL для скачивания/просмотра.
const urlCache = new Map<string, { url: string; expires: number }>();

// Сжимает изображение до max 1280px по длинной стороне, jpeg quality 0.8.
// Возвращает { uri, size, contentType }.
export async function compressImage(uri: string): Promise<{ uri: string; size: number; contentType: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  let size = 0;
  try {
    const info = await FileSystem.getInfoAsync(result.uri);
    size = (info as any).size ?? 0;
  } catch {}
  return { uri: result.uri, size, contentType: 'image/jpeg' };
}

export async function getMediaUrl(key: string): Promise<string> {
  const cached = urlCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.url;

  const { data } = await api.get<{ url: string }>(`/media/${encodeURIComponent(key)}`);
  urlCache.set(key, { url: data.url, expires: Date.now() + 50 * 60 * 1000 }); // ~50 min
  return data.url;
}
