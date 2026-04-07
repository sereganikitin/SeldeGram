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

export async function getMediaUrl(key: string): Promise<string> {
  const cached = urlCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.url;

  const { data } = await api.get<{ url: string }>(`/media/${encodeURIComponent(key)}`);
  urlCache.set(key, { url: data.url, expires: Date.now() + 50 * 60 * 1000 }); // ~50 min
  return data.url;
}
