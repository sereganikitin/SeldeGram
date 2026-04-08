export interface ChatMember {
  id: string;
  username: string;
  displayName: string;
  role?: 'admin' | 'member';
}

export interface Chat {
  id: string;
  type: 'direct' | 'group' | 'channel';
  title: string | null;
  createdAt: string;
  viewerRole?: 'admin' | 'member';
  members: ChatMember[];
  lastMessage?: Message | null;
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
  createdAt: string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
}
