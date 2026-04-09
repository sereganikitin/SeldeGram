"use client";

import { api } from "./api";

interface PresignResp {
  uploadUrl: string;
  key: string;
}

// Сжимает картинку через canvas до max 1280px по длинной стороне, JPEG quality 0.8.
// Возвращает Blob + размер + contentType.
export async function compressImage(file: File): Promise<{ blob: Blob; size: number; contentType: string; name: string }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = URL.createObjectURL(file);
  });

  const MAX = 1280;
  let { width, height } = img;
  if (width > MAX || height > MAX) {
    const ratio = Math.min(MAX / width, MAX / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.8,
    );
  });

  URL.revokeObjectURL(img.src);
  return { blob, size: blob.size, contentType: "image/jpeg", name: file.name.replace(/\.(png|webp|heic|gif)$/i, ".jpg") };
}

export async function uploadBlob(blob: Blob, contentType: string, size: number): Promise<string> {
  const { data } = await api.post<PresignResp>("/media/presign", { contentType, size });
  const putResp = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!putResp.ok) throw new Error(`Upload failed: ${putResp.status}`);
  return data.key;
}

export async function uploadFile(file: File): Promise<{ key: string; contentType: string; name: string; size: number }> {
  if (file.type.startsWith("image/")) {
    const compressed = await compressImage(file);
    const key = await uploadBlob(compressed.blob, compressed.contentType, compressed.size);
    return { key, contentType: compressed.contentType, name: compressed.name, size: compressed.size };
  }
  const key = await uploadBlob(file, file.type || "application/octet-stream", file.size);
  return { key, contentType: file.type || "application/octet-stream", name: file.name, size: file.size };
}

// Для стикеров — без сжатия (PNG с прозрачностью).
export async function uploadStickerFile(file: File): Promise<string> {
  const ct = file.type.startsWith("image/") ? file.type : "image/png";
  return uploadBlob(file, ct, file.size);
}
