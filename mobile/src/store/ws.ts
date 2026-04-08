import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { Message } from '../types';

type Listener = (msg: Message) => void;
type ChatUpdatedListener = (chatId: string) => void;

interface WsState {
  socket: WebSocket | null;
  connected: boolean;
  listeners: Set<Listener>;
  chatListeners: Set<ChatUpdatedListener>;
  connect: () => Promise<void>;
  disconnect: () => void;
  onMessage: (l: Listener) => () => void;
  onChatUpdated: (l: ChatUpdatedListener) => () => void;
}

export const useWs = create<WsState>((set, get) => ({
  socket: null,
  connected: false,
  listeners: new Set(),
  chatListeners: new Set(),

  connect: async () => {
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) return;
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(token);
    const sock = new WebSocket(wsUrl);

    sock.onopen = () => set({ connected: true });
    sock.onclose = () => {
      set({ connected: false, socket: null });
      // авто-переподключение через 3с
      setTimeout(() => get().connect(), 3000);
    };
    sock.onerror = () => {
      // onclose сработает следом
    };
    sock.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message:new') {
          for (const l of get().listeners) l(data.payload);
        } else if (data.type === 'chat:updated') {
          for (const l of get().chatListeners) l(data.payload.chatId);
        }
      } catch {}
    };

    set({ socket: sock });
  },

  disconnect: () => {
    const s = get().socket;
    if (s) {
      s.onclose = null as any;
      s.close();
    }
    set({ socket: null, connected: false });
  },

  onMessage: (l) => {
    get().listeners.add(l);
    return () => {
      get().listeners.delete(l);
    };
  },

  onChatUpdated: (l) => {
    get().chatListeners.add(l);
    return () => {
      get().chatListeners.delete(l);
    };
  },
}));
