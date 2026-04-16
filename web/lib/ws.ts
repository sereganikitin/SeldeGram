"use client";

import { create } from "zustand";
import { API_BASE_URL } from "./config";
import { Message } from "./types";

type MessageListener = (msg: Message) => void;
type EditedListener = (msg: Message) => void;
type DeletedListener = (chatId: string, messageId: string) => void;
type ChatUpdatedListener = (chatId: string) => void;
type ChatDeletedListener = (chatId: string) => void;
type ReadListener = (chatId: string, userId: string, lastReadAt: string) => void;
type TypingListener = (chatId: string, userId: string) => void;
type PinnedListener = (chatId: string, messageId: string | null) => void;
type PresenceListener = (userId: string, online: boolean, lastSeenAt: string) => void;

export interface CallPeer {
  id: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
}
export type CallSignalKind = "offer" | "answer" | "ice";
type CallIncomingListener = (p: { callId: string; kind: "audio" | "video"; from: CallPeer; startedAt: string }) => void;
type CallAcceptedListener = (p: { callId: string }) => void;
type CallRejectedListener = (p: { callId: string }) => void;
type CallEndedListener = (p: { callId: string; status: string; durationSec: number | null }) => void;
type CallSignalListener = (p: { from: string; callId: string; kind: CallSignalKind; data: unknown }) => void;

export interface WsState {
  socket: WebSocket | null;
  connected: boolean;
  msgListeners: Set<MessageListener>;
  editedListeners: Set<EditedListener>;
  deletedListeners: Set<DeletedListener>;
  chatListeners: Set<ChatUpdatedListener>;
  chatDeletedListeners: Set<ChatDeletedListener>;
  readListeners: Set<ReadListener>;
  typingListeners: Set<TypingListener>;
  pinnedListeners: Set<PinnedListener>;
  presenceListeners: Set<PresenceListener>;
  callIncomingListeners: Set<CallIncomingListener>;
  callAcceptedListeners: Set<CallAcceptedListener>;
  callRejectedListeners: Set<CallRejectedListener>;
  callEndedListeners: Set<CallEndedListener>;
  callSignalListeners: Set<CallSignalListener>;
  connect: () => void;
  disconnect: () => void;
  send: (event: string, data: unknown) => void;
  onMessage: (l: MessageListener) => () => void;
  onEdited: (l: EditedListener) => () => void;
  onDeleted: (l: DeletedListener) => () => void;
  onChatUpdated: (l: ChatUpdatedListener) => () => void;
  onChatDeleted: (l: ChatDeletedListener) => () => void;
  onRead: (l: ReadListener) => () => void;
  onTyping: (l: TypingListener) => () => void;
  onPinned: (l: PinnedListener) => () => void;
  onPresence: (l: PresenceListener) => () => void;
  onCallIncoming: (l: CallIncomingListener) => () => void;
  onCallAccepted: (l: CallAcceptedListener) => () => void;
  onCallRejected: (l: CallRejectedListener) => () => void;
  onCallEnded: (l: CallEndedListener) => () => void;
  onCallSignal: (l: CallSignalListener) => () => void;
}

function makeSubscriber<T>(getSet: () => Set<T>) {
  return (l: T) => {
    getSet().add(l);
    return () => {
      getSet().delete(l);
    };
  };
}

export const useWs = create<WsState>()((set, get) => ({
  socket: null,
  connected: false,
  msgListeners: new Set(),
  editedListeners: new Set(),
  deletedListeners: new Set(),
  chatListeners: new Set(),
  chatDeletedListeners: new Set(),
  readListeners: new Set(),
  typingListeners: new Set(),
  pinnedListeners: new Set(),
  presenceListeners: new Set(),
  callIncomingListeners: new Set(),
  callAcceptedListeners: new Set(),
  callRejectedListeners: new Set(),
  callEndedListeners: new Set(),
  callSignalListeners: new Set(),

  connect: () => {
    if (typeof window === "undefined") return;
    const existing = get().socket;
    if (existing && existing.readyState !== WebSocket.CLOSED) return;

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const wsUrl = API_BASE_URL.replace(/^http/, "ws") + "/ws?token=" + encodeURIComponent(token);
    const sock = new WebSocket(wsUrl);

    sock.onopen = () => set({ connected: true });
    sock.onclose = () => {
      set({ connected: false, socket: null });
      setTimeout(() => get().connect(), 3000);
    };
    sock.onerror = () => {};
    sock.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "message:new":
            for (const l of get().msgListeners) l(data.payload);
            break;
          case "message:edited":
            for (const l of get().editedListeners) l(data.payload);
            break;
          case "message:deleted":
            for (const l of get().deletedListeners) l(data.payload.chatId, data.payload.messageId);
            break;
          case "chat:updated":
            for (const l of get().chatListeners) l(data.payload.chatId);
            break;
          case "chat:deleted":
            for (const l of get().chatDeletedListeners) l(data.payload.chatId);
            break;
          case "chat:read":
            for (const l of get().readListeners) l(data.payload.chatId, data.payload.userId, data.payload.lastReadAt);
            break;
          case "chat:typing":
            for (const l of get().typingListeners) l(data.payload.chatId, data.payload.userId);
            break;
          case "chat:pinned":
            for (const l of get().pinnedListeners) l(data.payload.chatId, data.payload.messageId);
            break;
          case "presence":
            for (const l of get().presenceListeners) l(data.payload.userId, data.payload.online, data.payload.lastSeenAt);
            break;
          case "call:incoming":
            for (const l of get().callIncomingListeners) l(data.payload);
            break;
          case "call:accepted":
            for (const l of get().callAcceptedListeners) l(data.payload);
            break;
          case "call:rejected":
            for (const l of get().callRejectedListeners) l(data.payload);
            break;
          case "call:ended":
            for (const l of get().callEndedListeners) l(data.payload);
            break;
          case "call:signal":
            for (const l of get().callSignalListeners) l(data.payload);
            break;
        }
      } catch {}
    };

    set({ socket: sock });
  },

  disconnect: () => {
    const s = get().socket;
    if (s) {
      s.onclose = null;
      s.close();
    }
    set({ socket: null, connected: false });
  },

  send: (event, data) => {
    const s = get().socket;
    if (!s || s.readyState !== WebSocket.OPEN) return;
    s.send(JSON.stringify({ event, data }));
  },

  onMessage: makeSubscriber(() => useWs.getState().msgListeners),
  onEdited: makeSubscriber(() => useWs.getState().editedListeners),
  onDeleted: makeSubscriber(() => useWs.getState().deletedListeners),
  onChatUpdated: makeSubscriber(() => useWs.getState().chatListeners),
  onChatDeleted: makeSubscriber(() => useWs.getState().chatDeletedListeners),
  onRead: makeSubscriber(() => useWs.getState().readListeners),
  onTyping: makeSubscriber(() => useWs.getState().typingListeners),
  onPinned: makeSubscriber(() => useWs.getState().pinnedListeners),
  onPresence: makeSubscriber(() => useWs.getState().presenceListeners),
  onCallIncoming: makeSubscriber(() => useWs.getState().callIncomingListeners),
  onCallAccepted: makeSubscriber(() => useWs.getState().callAcceptedListeners),
  onCallRejected: makeSubscriber(() => useWs.getState().callRejectedListeners),
  onCallEnded: makeSubscriber(() => useWs.getState().callEndedListeners),
  onCallSignal: makeSubscriber(() => useWs.getState().callSignalListeners),
}));
