"use client";

import { generateKeyPair } from "./crypto";
import { api } from "./api";

const SECRET_KEY_STORE = "e2ee_secret_key";
const PUBLIC_KEY_STORE = "e2ee_public_key";

let cachedSecretKey: string | null = null;
let cachedPublicKey: string | null = null;

export async function initKeys(): Promise<void> {
  if (typeof window === "undefined") return;

  cachedSecretKey = localStorage.getItem(SECRET_KEY_STORE);
  cachedPublicKey = localStorage.getItem(PUBLIC_KEY_STORE);

  if (cachedSecretKey && cachedPublicKey) {
    // Ключи уже есть — загружаем publicKey на сервер (идемпотентно)
    try {
      await api.patch("/me", { publicKey: cachedPublicKey });
    } catch {}
    return;
  }

  // Ключей нет локально. Проверяем, есть ли publicKey на сервере.
  // Если есть — значит ключи генерировались на другом устройстве, НЕ перезаписываем.
  // Если нет — первая генерация, создаём keypair.
  try {
    const { data } = await api.get<{ publicKey: string | null }>("/me");
    if (data.publicKey) {
      // На сервере уже есть ключ, но у нас нет secretKey → не можем расшифровывать.
      // Работаем без E2EE на этом устройстве.
      return;
    }
  } catch {
    return;
  }

  // Первая генерация ключей
  const kp = generateKeyPair();
  localStorage.setItem(SECRET_KEY_STORE, kp.secretKey);
  localStorage.setItem(PUBLIC_KEY_STORE, kp.publicKey);
  cachedSecretKey = kp.secretKey;
  cachedPublicKey = kp.publicKey;

  try {
    await api.patch("/me", { publicKey: kp.publicKey });
  } catch {}
}

export function getSecretKey(): string | null {
  return cachedSecretKey;
}

export function getPublicKey(): string | null {
  return cachedPublicKey;
}

// Без кэша — всегда свежий ключ с сервера (надёжнее при смене ключей)
export async function getPeerPublicKey(userId: string): Promise<string | null> {
  try {
    const { data } = await api.get<{ id: string; publicKey: string | null }>(`/users/${userId}/keys`);
    return data.publicKey;
  } catch {
    return null;
  }
}

export function clearKeys() {
  cachedSecretKey = null;
  cachedPublicKey = null;
  peerKeyCache.clear();
  if (typeof window !== "undefined") {
    localStorage.removeItem(SECRET_KEY_STORE);
    localStorage.removeItem(PUBLIC_KEY_STORE);
  }
}
