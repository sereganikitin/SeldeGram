// Общие типы клиента и сервера. Расширяем по мере роста проекта.

export type UUID = string;

export interface User {
  id: UUID;
  email: string;
  username: string;
  displayName: string;
  createdAt: string;
}

export type ChatType = 'direct' | 'group' | 'channel';

export interface Chat {
  id: UUID;
  type: ChatType;
  title?: string;
  createdAt: string;
}

// Сервер хранит сообщения как непрозрачные blob'ы — он их не расшифровывает.
export interface EncryptedMessage {
  id: UUID;
  chatId: UUID;
  senderId: UUID;
  ciphertext: string; // base64
  contentType: 'text' | 'media' | 'sticker' | 'system';
  createdAt: string;
}

// WebSocket события
export type WsEvent =
  | { type: 'message:new'; payload: EncryptedMessage }
  | { type: 'message:ack'; payload: { id: UUID } }
  | { type: 'presence'; payload: { userId: UUID; online: boolean } };
