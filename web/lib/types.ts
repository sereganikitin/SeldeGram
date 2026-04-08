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
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
}

export interface Chat {
  id: string;
  type: "direct" | "group" | "channel";
  title: string | null;
  slug?: string | null;
  createdAt: string;
  viewerRole?: "admin" | "member";
  viewerWallpaper?: string | null;
  memberCount?: number;
  members: ChatMember[];
  lastMessage?: Message | null;
  unreadCount?: number;
}
