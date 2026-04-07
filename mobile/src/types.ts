export interface ChatMember {
  id: string;
  username: string;
  displayName: string;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group' | 'channel';
  title: string | null;
  createdAt: string;
  members: ChatMember[];
  lastMessage?: Message | null;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
}
