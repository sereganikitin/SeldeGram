export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  isVerified: boolean;
  avatarKey?: string | null;
  defaultWallpaper?: string | null;
  createdAt: string;
}

export interface ChatMember {
  id: string;
  username: string;
  displayName: string;
  avatarKey?: string | null;
  isOnline?: boolean;
  lastSeenAt?: string | null;
  role?: "admin" | "member";
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  mediaKey?: string | null;
  mediaType?: string | null;
  mediaName?: string | null;
  mediaSize?: number | null;
  isSticker?: boolean;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    senderId: string;
    content: string;
    mediaType?: string | null;
    mediaKey?: string | null;
    deletedAt?: string | null;
  } | null;
  forwardedFromId?: string | null;
  threadOfId?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
}

export interface Sticker {
  id: string;
  packId: string;
  mediaKey: string;
  mediaType?: string;
  emoji: string;
  order: number;
}

export interface StickerPack {
  id: string;
  authorId: string;
  name: string;
  slug: string;
  coverKey: string | null;
  stickers: Sticker[];
}

export interface StickerPackSearchResult {
  id: string;
  name: string;
  slug: string;
  coverKey: string | null;
  _count: { stickers: number };
}

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  avatarKey?: string | null;
}

export interface ChannelSearchResult {
  id: string;
  title: string | null;
  slug: string | null;
  memberCount: number;
}

export interface Chat {
  id: string;
  type: "direct" | "group" | "channel";
  title: string | null;
  slug?: string | null;
  pinnedMessageId?: string | null;
  createdAt: string;
  viewerRole?: "admin" | "member";
  viewerWallpaper?: string | null;
  memberCount?: number;
  members: ChatMember[];
  lastMessage?: Message | null;
  unreadCount?: number;
}
