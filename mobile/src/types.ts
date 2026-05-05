export interface ChatMember {
  id: string;
  username: string;
  displayName: string;
  avatarKey?: string | null;
  isOnline?: boolean;
  lastSeenAt?: string | null;
  role?: 'admin' | 'member';
}

export interface ReplyPreviewData {
  id: string;
  senderId: string;
  content: string;
  mediaType?: string | null;
  mediaKey?: string | null;
  deletedAt?: string | null;
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
  replyTo?: ReplyPreviewData | null;
  forwardedFromId?: string | null;
  threadOfId?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  expiresAt?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  locationLiveUntil?: string | null;
  reactions?: Array<{ emoji: string; userId: string }>;
  createdAt: string;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
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

export interface Chat {
  id: string;
  type: 'direct' | 'group' | 'channel' | 'saved';
  title: string | null;
  slug?: string | null;
  pinnedMessageId?: string | null;
  createdAt: string;
  viewerRole?: 'admin' | 'member';
  viewerWallpaper?: string | null;
  memberCount?: number;
  members: ChatMember[];
  lastMessage?: Message | null;
  unreadCount?: number;
  pinned?: boolean;
  muted?: boolean;
  archived?: boolean;
}

export interface ChannelSearchResult {
  id: string;
  title: string | null;
  slug: string | null;
  memberCount: number;
}

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  avatarKey?: string | null;
}

export interface ChatRead {
  userId: string;
  lastReadAt: string;
}
