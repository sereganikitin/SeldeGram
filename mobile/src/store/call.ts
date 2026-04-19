import { create } from 'zustand';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import { api } from '../api';
import { useWs, CallPeer, CallSignalKind } from './ws';

export type CallState =
  | 'idle'
  | 'outgoing-ringing'
  | 'incoming-ringing'
  | 'connecting'
  | 'active'
  | 'ended';

export type CallKind = 'audio' | 'video';

interface CallStore {
  state: CallState;
  callId: string | null;
  peer: CallPeer | null;
  kind: CallKind;
  isCaller: boolean;
  muted: boolean;
  speakerOn: boolean;
  startedAt: number | null;
  acceptedAt: number | null;
  error: string | null;

  initiate: (peer: CallPeer, kind?: CallKind) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  rejectIncoming: () => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;

  _onIncoming: (p: { callId: string; kind: CallKind; from: CallPeer; startedAt: string }) => void;
  _onAccepted: (p: { callId: string }) => Promise<void>;
  _onRejected: (p: { callId: string }) => void;
  _onEnded: (p: { callId: string; status: string; durationSec: number | null }) => void;
  _onSignal: (p: { from: string; callId: string; kind: CallSignalKind; data: unknown }) => Promise<void>;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

let pc: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let pendingIce: RTCIceCandidateInit[] = [];
let pendingOffer: RTCSessionDescriptionInit | null = null;
let connectTimer: ReturnType<typeof setTimeout> | null = null;

function armConnectTimeout(ms: number) {
  if (connectTimer) clearTimeout(connectTimer);
  connectTimer = setTimeout(() => {
    const s = useCall.getState().state;
    if (s !== 'active' && s !== 'idle') {
      console.log('[call] connect timeout, hanging up');
      useCall.getState().hangup().catch(() => undefined);
    }
  }, ms);
}

function clearConnectTimeout() {
  if (connectTimer) {
    clearTimeout(connectTimer);
    connectTimer = null;
  }
}

async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Доступ к микрофону',
        message: 'Нужен для голосовых звонков.',
        buttonPositive: 'Разрешить',
        buttonNegative: 'Отмена',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function cleanupPeer() {
  clearConnectTimeout();
  if (pc) {
    try { pc.close(); } catch {}
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream.release?.();
    localStream = null;
  }
  pendingIce = [];
  pendingOffer = null;
  try { InCallManager.stop(); } catch {}
}

async function setupPeer(callId: string, peerId: string, kind: CallKind): Promise<RTCPeerConnection> {
  console.log('[call] setupPeer start', { callId, peerId, kind });
  const ok = await requestMicPermission();
  if (!ok) throw new Error('Нет доступа к микрофону');

  try {
    InCallManager.start({ media: kind === 'video' ? 'video' : 'audio' });
    InCallManager.setForceSpeakerphoneOn(false);
  } catch {}

  localStream = await mediaDevices.getUserMedia({
    audio: true,
    video: kind === 'video',
  });
  console.log('[call] got local stream, tracks:', localStream.getTracks().map((t) => t.kind));

  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  localStream.getTracks().forEach((track) => {
    pc!.addTrack(track, localStream!);
  });

  // Property-style handlers — в react-native-webrtc этот стиль надёжнее
  // addEventListener работает не всегда.
  // @ts-expect-error handler shape
  pc.onicecandidate = (ev: any) => {
    if (ev?.candidate) {
      console.log('[call] local ICE → peer');
      useWs.getState().send('call:signal', {
        to: peerId,
        callId,
        kind: 'ice',
        data: ev.candidate.toJSON(),
      });
    }
  };

  // @ts-expect-error
  pc.ontrack = (ev: any) => {
    console.log('[call] ontrack', ev?.track?.kind);
    // Для аудио в react-native-webrtc достаточно получить трек —
    // InCallManager маршрутизирует звук через системный аудиовыход.
  };

  // @ts-expect-error
  pc.oniceconnectionstatechange = () => {
    const s = (pc as any)?.iceConnectionState;
    console.log('[call] iceConnectionState:', s);
    // На некоторых RN-сборках `connectionstatechange` не стреляет —
    // подстраховываемся через ICE state.
    if ((s === 'connected' || s === 'completed') && useCall.getState().state !== 'active') {
      useCall.setState({ state: 'active', acceptedAt: Date.now() });
    }
    if (s === 'failed' && useCall.getState().state !== 'idle') {
      useCall.getState().hangup().catch(() => undefined);
    }
  };

  // @ts-expect-error
  pc.onconnectionstatechange = () => {
    if (!pc) return;
    const s = (pc as any).connectionState;
    console.log('[call] connectionState:', s);
    if (s === 'connected') {
      clearConnectTimeout();
      useCall.setState({ state: 'active', acceptedAt: Date.now() });
    } else if (s === 'failed') {
      if (useCall.getState().state !== 'idle') {
        useCall.getState().hangup().catch(() => undefined);
      }
    }
  };

  // ICE-connect тоже может не состояться — страхуемся 30-секундным таймером
  armConnectTimeout(30_000);

  return pc;
}

export const useCall = create<CallStore>((set, get) => ({
  state: 'idle',
  callId: null,
  peer: null,
  kind: 'audio',
  isCaller: false,
  muted: false,
  speakerOn: false,
  startedAt: null,
  acceptedAt: null,
  error: null,

  initiate: async (peer, kind = 'audio') => {
    if (get().state !== 'idle') return;
    set({
      state: 'outgoing-ringing',
      peer,
      kind,
      isCaller: true,
      startedAt: Date.now(),
      error: null,
    });
    try {
      const { data } = await api.post('/calls', { calleeId: peer.id, kind });
      set({ callId: data.id });
      // Callee не принял за 45 сек — автоматически отменяем
      armConnectTimeout(45_000);
    } catch (e: any) {
      set({
        state: 'idle',
        peer: null,
        callId: null,
        error: e.response?.data?.message ?? e.message ?? 'Ошибка',
      });
    }
  },

  acceptIncoming: async () => {
    const { callId, peer, kind } = get();
    console.log('[call] acceptIncoming', { callId, peerId: peer?.id });
    if (!callId || !peer) return;
    set({ state: 'connecting' });
    try {
      await setupPeer(callId, peer.id, kind);
      console.log('[call] POST /accept');
      await api.post(`/calls/${callId}/accept`);
      if (pendingOffer && pc) {
        console.log('[call] processing buffered offer');
        const offer = pendingOffer;
        pendingOffer = null;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        for (const c of pendingIce) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
        pendingIce = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[call] sending buffered answer');
        useWs.getState().send('call:signal', {
          to: peer.id,
          callId,
          kind: 'answer',
          data: answer,
        });
      } else {
        console.log('[call] waiting for offer');
      }
    } catch (e: any) {
      console.error('[call] acceptIncoming error', e);
      set({ error: e.message ?? 'Ошибка' });
      cleanupPeer();
      set({ state: 'idle', callId: null, peer: null });
    }
  },

  rejectIncoming: async () => {
    const { callId } = get();
    if (!callId) return;
    try {
      await api.post(`/calls/${callId}/reject`);
    } catch {}
    set({ state: 'idle', callId: null, peer: null, kind: 'audio', isCaller: false });
  },

  hangup: async () => {
    const { callId, state } = get();
    if (state === 'idle') return;
    cleanupPeer();
    if (callId) {
      try {
        await api.post(`/calls/${callId}/end`);
      } catch {}
    }
    set({
      state: 'idle',
      callId: null,
      peer: null,
      isCaller: false,
      muted: false,
      speakerOn: false,
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

  toggleSpeaker: () => {
    const next = !get().speakerOn;
    try { InCallManager.setForceSpeakerphoneOn(next); } catch {}
    set({ speakerOn: next });
  },

  _onIncoming: ({ callId, kind, from }) => {
    const cur = get();
    if (cur.state !== 'idle') {
      api.post(`/calls/${callId}/reject`).catch(() => undefined);
      return;
    }
    set({
      state: 'incoming-ringing',
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
    console.log('[call] _onAccepted', { callId, isCaller: cur.isCaller });
    if (cur.callId !== callId || !cur.isCaller || !cur.peer) return;
    set({ state: 'connecting' });
    try {
      const conn = await setupPeer(cur.callId, cur.peer.id, cur.kind);
      console.log('[call] creating offer');
      const offer = await conn.createOffer({});
      await conn.setLocalDescription(offer);
      console.log('[call] sending offer');
      useWs.getState().send('call:signal', {
        to: cur.peer.id,
        callId,
        kind: 'offer',
        data: offer,
      });
    } catch (e: any) {
      console.error('[call] _onAccepted error', e);
      set({ error: e.message });
      get().hangup();
    }
  },

  _onRejected: ({ callId }) => {
    const cur = get();
    if (cur.callId && cur.callId !== callId) return;
    console.log('[call] _onRejected', callId);
    cleanupPeer();
    set({
      state: 'idle',
      callId: null,
      peer: null,
      isCaller: false,
      error: 'Звонок отклонён',
    });
  },

  _onEnded: ({ callId }) => {
    const cur = get();
    if (cur.callId && cur.callId !== callId) return;
    console.log('[call] _onEnded', callId);
    cleanupPeer();
    set({
      state: 'idle',
      callId: null,
      peer: null,
      isCaller: false,
      muted: false,
      speakerOn: false,
      startedAt: null,
      acceptedAt: null,
    });
  },

  _onSignal: async ({ callId, kind, data }) => {
    const cur = get();
    console.log('[call] _onSignal', kind, { callId, hasPc: !!pc });
    if (cur.callId !== callId) {
      console.log('[call] signal ignored: callId mismatch', { cur: cur.callId, got: callId });
      return;
    }
    try {
      if (kind === 'offer') {
        const offer = data as RTCSessionDescriptionInit;
        if (!pc) {
          console.log('[call] offer buffered (pc not ready)');
          pendingOffer = offer;
          return;
        }
        console.log('[call] applying offer → creating answer');
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        for (const c of pendingIce) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
        pendingIce = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (cur.peer) {
          console.log('[call] sending answer');
          useWs.getState().send('call:signal', {
            to: cur.peer.id,
            callId,
            kind: 'answer',
            data: answer,
          });
        }
      } else if (kind === 'answer') {
        if (!pc) {
          console.log('[call] answer ignored: no pc');
          return;
        }
        console.log('[call] applying answer');
        await pc.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit));
        for (const c of pendingIce) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
        pendingIce = [];
      } else if (kind === 'ice') {
        const c = data as RTCIceCandidateInit;
        if (pc && pc.remoteDescription) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        } else {
          pendingIce.push(c);
        }
      }
    } catch (e) {
      console.error('[call] signal error', e);
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
