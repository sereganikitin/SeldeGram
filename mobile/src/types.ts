export interface ChatMember {
  id: string;
  username: string;
  displayName: string;
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
  replyToId?: string | null;
  replyTo?: ReplyPreviewData | null;
  forwardedFromId?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group' | 'channel';
  title: string | null;
  slug?: string | null;
  createdAt: string;
  viewerRole?: 'admin' | 'member';
  memberCount?: number;
  members: ChatMember[];
  lastMessage?: Message | null;
  unreadCount?: number;
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
}

export interface ChatRead {
  userId: string;
  lastReadAt: string;
}
