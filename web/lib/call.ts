"use client";

import { create } from "zustand";
import { api } from "./api";
import { useWs, CallPeer, CallSignalKind } from "./ws";

export type CallState =
  | "idle"
  | "outgoing-ringing"
  | "incoming-ringing"
  | "connecting"
  | "active"
  | "ended";

export type CallKind = "audio" | "video";

interface CallStore {
  state: CallState;
  callId: string | null;
  peer: CallPeer | null;
  kind: CallKind;
  isCaller: boolean;
  muted: boolean;
  startedAt: number | null;
  acceptedAt: number | null;
  error: string | null;

  initiate: (peer: CallPeer, kind?: CallKind) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  rejectIncoming: () => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => void;

  _onIncoming: (p: { callId: string; kind: CallKind; from: CallPeer; startedAt: string }) => void;
  _onAccepted: (p: { callId: string }) => Promise<void>;
  _onRejected: (p: { callId: string }) => void;
  _onEnded: (p: { callId: string; status: string; durationSec: number | null }) => void;
  _onSignal: (p: { from: string; callId: string; kind: CallSignalKind; data: unknown }) => Promise<void>;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

let pc: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
let pendingIce: RTCIceCandidateInit[] = [];
let pendingOffer: RTCSessionDescriptionInit | null = null;
const remoteAudioId = "__seldegram_call_audio__";

function getRemoteAudio(): HTMLAudioElement {
  let el = document.getElementById(remoteAudioId) as HTMLAudioElement | null;
  if (!el) {
    el = document.createElement("audio");
    el.id = remoteAudioId;
    el.autoplay = true;
    el.setAttribute("playsinline", "true");
    document.body.appendChild(el);
  }
  return el;
}

function cleanupPeer() {
  if (pc) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    try { pc.close(); } catch {}
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  remoteStream = null;
  pendingIce = [];
  pendingOffer = null;
  const el = document.getElementById(remoteAudioId) as HTMLAudioElement | null;
  if (el) el.srcObject = null;
}

async function setupPeer(callId: string, peerId: string, kind: CallKind): Promise<RTCPeerConnection> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Микрофон недоступен в этом браузере. Проверьте, что сайт открыт по HTTPS.");
  }
  const constraints: MediaStreamConstraints = {
    audio: true,
    video: kind === "video",
  };
  try {
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    const err = e as DOMException;
    if (err.name === "NotAllowedError" || err.name === "SecurityError") {
      throw new Error(
        "Нет доступа к микрофону. Разрешите доступ в настройках браузера и попробуйте снова.",
      );
    }
    if (err.name === "NotFoundError") {
      throw new Error("Микрофон не найден на устройстве.");
    }
    throw e;
  }

  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }

  pc.ontrack = (ev) => {
    if (!remoteStream) {
      remoteStream = new MediaStream();
      getRemoteAudio().srcObject = remoteStream;
    }
    remoteStream.addTrack(ev.track);
  };

  pc.onicecandidate = (ev) => {
    if (ev.candidate) {
      useWs.getState().send("call:signal", {
        to: peerId,
        callId,
        kind: "ice",
        data: ev.candidate.toJSON(),
      });
    }
  };

  pc.onconnectionstatechange = () => {
    if (!pc) return;
    const s = pc.connectionState;
    console.log("[call] connectionState:", s);
    if (s === "connected") {
      useCall.setState({ state: "active", acceptedAt: Date.now() });
    } else if (s === "failed") {
      const cur = useCall.getState();
      if (cur.state !== "idle") {
        useCall.getState().hangup().catch(() => undefined);
      }
    }
  };

  return pc;
}

export const useCall = create<CallStore>()((set, get) => ({
  state: "idle",
  callId: null,
  peer: null,
  kind: "audio",
  isCaller: false,
  muted: false,
  startedAt: null,
  acceptedAt: null,
  error: null,

  initiate: async (peer, kind = "audio") => {
    if (get().state !== "idle") return;
    set({
      state: "outgoing-ringing",
      peer,
      kind,
      isCaller: true,
      startedAt: Date.now(),
      error: null,
    });
    try {
      const { data } = await api.post("/calls", { calleeId: peer.id, kind });
      set({ callId: data.id });
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      set({
        state: "idle",
        peer: null,
        callId: null,
        error: err.response?.data?.message ?? err.message ?? "Ошибка",
      });
    }
  },

  acceptIncoming: async () => {
    const { callId, peer, kind } = get();
    if (!callId || !peer) return;
    set({ state: "connecting" });
    try {
      // Сначала готовим pc и микрофон — иначе caller успеет прислать offer в пустоту
      await setupPeer(callId, peer.id, kind);
      await api.post(`/calls/${callId}/accept`);
      // Если offer уже успел прийти до setupPeer — обработаем его сейчас
      if (pendingOffer && pc) {
        const offer = pendingOffer;
        pendingOffer = null;
        await pc.setRemoteDescription(offer);
        for (const c of pendingIce) {
          try { await pc.addIceCandidate(c); } catch {}
        }
        pendingIce = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        useWs.getState().send("call:signal", {
          to: peer.id,
          callId,
          kind: "answer",
          data: answer,
        });
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      console.error("acceptIncoming error", e);
      set({ error: err.response?.data?.message ?? err.message ?? "Ошибка" });
      cleanupPeer();
      set({ state: "idle", callId: null, peer: null });
    }
  },

  rejectIncoming: async () => {
    const { callId } = get();
    if (!callId) return;
    try {
      await api.post(`/calls/${callId}/reject`);
    } catch {}
    set({ state: "idle", callId: null, peer: null, kind: "audio", isCaller: false });
  },

  hangup: async () => {
    const { callId, state } = get();
    if (state === "idle") return;
    cleanupPeer();
    if (callId) {
      try {
        await api.post(`/calls/${callId}/end`);
      } catch {}
    }
    set({
      state: "idle",
      callId: null,
      peer: null,
      isCaller: false,
      muted: false,
      startedAt: null,
      acceptedAt: null,
    });
  },

  toggleMute: () => {
    if (!localStream) return;
    const next = !get().muted;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !next));
    set({ muted: next });
  },

  _onIncoming: ({ callId, kind, from }) => {
    const cur = get();
    if (cur.state !== "idle") {
      // Уже в звонке — отклонить
      api.post(`/calls/${callId}/reject`).catch(() => undefined);
      return;
    }
    set({
      state: "incoming-ringing",
      callId,
      peer: from,
      kind,
      isCaller: false,
      startedAt: Date.now(),
      error: null,
    });
  },

  _onAccepted: async ({ callId }) => {
    const cur = get();
    if (cur.callId !== callId || !cur.isCaller || !cur.peer) return;
    set({ state: "connecting" });
    try {
      const conn = await setupPeer(cur.callId, cur.peer.id, cur.kind);
      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      useWs.getState().send("call:signal", {
        to: cur.peer.id,
        callId,
        kind: "offer",
        data: offer,
      });
    } catch (e) {
      const err = e as Error;
      set({ error: err.message });
      get().hangup();
    }
  },

  _onRejected: () => {
    cleanupPeer();
    set({
      state: "idle",
      callId: null,
      peer: null,
      isCaller: false,
      error: "Звонок отклонён",
    });
  },

  _onEnded: () => {
    cleanupPeer();
    set({
      state: "idle",
      callId: null,
      peer: null,
      isCaller: false,
      muted: false,
      startedAt: null,
      acceptedAt: null,
    });
  },

  _onSignal: async ({ callId, kind, data }) => {
    const cur = get();
    if (cur.callId !== callId) return;
    try {
      if (kind === "offer") {
        const offer = data as RTCSessionDescriptionInit;
        if (!pc) {
          // pc ещё не создан — запомним, обработаем в acceptIncoming
          pendingOffer = offer;
          return;
        }
        await pc.setRemoteDescription(offer);
        for (const c of pendingIce) {
          try { await pc.addIceCandidate(c); } catch {}
        }
        pendingIce = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (cur.peer) {
          useWs.getState().send("call:signal", {
            to: cur.peer.id,
            callId,
            kind: "answer",
            data: answer,
          });
        }
      } else if (kind === "answer") {
        if (!pc) return;
        await pc.setRemoteDescription(data as RTCSessionDescriptionInit);
        for (const c of pendingIce) {
          try { await pc.addIceCandidate(c); } catch {}
        }
        pendingIce = [];
      } else if (kind === "ice") {
        const c = data as RTCIceCandidateInit;
        if (pc && pc.remoteDescription) {
          try { await pc.addIceCandidate(c); } catch {}
        } else {
          pendingIce.push(c);
        }
      }
    } catch (e) {
      console.error("call signal error", e);
    }
  },
}));

let wired = false;
export function initCallBridge() {
  if (wired) return;
  wired = true;
  const ws = useWs.getState();
  ws.onCallIncoming((p) => useCall.getState()._onIncoming(p));
  ws.onCallAccepted((p) => useCall.getState()._onAccepted(p));
  ws.onCallRejected((p) => useCall.getState()._onRejected(p));
  ws.onCallEnded((p) => useCall.getState()._onEnded(p));
  ws.onCallSignal((p) => useCall.getState()._onSignal(p));
}
