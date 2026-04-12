/**
 * Управление E2EE-ключами на мобильном устройстве.
 * Приватный ключ хранится в expo-secure-store (зашифрован ОС).
 * Публичный ключ загружается на сервер при первом логине.
 */
import * as SecureStore from 'expo-secure-store';
import { generateKeyPair } from './crypto';
import { api } from './api';

const SECRET_KEY_STORE = 'e2ee_secret_key';
const PUBLIC_KEY_STORE = 'e2ee_public_key';

let cachedSecretKey: string | null = null;
let cachedPublicKey: string | null = null;

export async function initKeys(): Promise<void> {
  cachedSecretKey = await SecureStore.getItemAsync(SECRET_KEY_STORE);
  cachedPublicKey = await SecureStore.getItemAsync(PUBLIC_KEY_STORE);

  if (cachedSecretKey && cachedPublicKey) {
    try {
      await api.patch('/me', { publicKey: cachedPublicKey });
    } catch {}
    return;
  }

  // Ключей нет локально. Проверяем, есть ли на сервере.
  // Если есть — другое устройство уже сгенерировало, НЕ перезаписываем.
  try {
    const { data } = await api.get<{ publicKey: string | null }>('/me');
    if (data.publicKey) return; // Ключи на другом устройстве, работаем без E2EE
  } catch {
    return;
  }

  // Первая генерация
  const kp = generateKeyPair();
  await SecureStore.setItemAsync(SECRET_KEY_STORE, kp.secretKey);
  await SecureStore.setItemAsync(PUBLIC_KEY_STORE, kp.publicKey);
  cachedSecretKey = kp.secretKey;
  cachedPublicKey = kp.publicKey;

  try {
    await api.patch('/me', { publicKey: kp.publicKey });
  } catch {}
}

export function getSecretKey(): string | null {
  return cachedSecretKey;
}

export function getPublicKey(): string | null {
  return cachedPublicKey;
}

// Кэш публичных ключей других пользователей (не кэшируем null)
const peerKeyCache = new Map<string, string>();

export async function getPeerPublicKey(userId: string): Promise<string | null> {
  const cached = peerKeyCache.get(userId);
  if (cached) return cached;
  try {
    const { data } = await api.get<{ id: string; publicKey: string | null }>(`/users/${userId}/keys`);
    if (data.publicKey) peerKeyCache.set(userId, data.publicKey);
    return data.publicKey;
  } catch {
    return null;
  }
}

export function clearKeys() {
  cachedSecretKey = null;
  cachedPublicKey = null;
  peerKeyCache.clear();
  SecureStore.deleteItemAsync(SECRET_KEY_STORE).catch(() => undefined);
  SecureStore.deleteItemAsync(PUBLIC_KEY_STORE).catch(() => undefined);
}
