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

  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  localStream.getTracks().forEach((track) => {
    pc!.addTrack(track, localStream!);
  });

  // @ts-expect-error react-native-webrtc event shape
  pc.addEventListener('track', () => {
    // Ремоут поток обрабатывается в CallOverlay через pc.getRemoteStreams()
  });

  // @ts-expect-error
  pc.addEventListener('icecandidate', (ev: any) => {
    if (ev.candidate) {
      useWs.getState().send('call:signal', {
        to: peerId,
        callId,
        kind: 'ice',
        data: ev.candidate.toJSON(),
      });
    }
  });

  // @ts-expect-error
  pc.addEventListener('connectionstatechange', () => {
    if (!pc) return;
    const s = pc.connectionState;
    if (s === 'connected') {
      useCall.setState({ state: 'active', acceptedAt: Date.now() });
    } else if (s === 'failed') {
      if (useCall.getState().state !== 'idle') {
        useCall.getState().hangup().catch(() => undefined);
      }
    }
  });

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
    if (!callId || !peer) return;
    set({ state: 'connecting' });
    try {
      await setupPeer(callId, peer.id, kind);
      await api.post(`/calls/${callId}/accept`);
      if (pendingOffer && pc) {
        const offer = pendingOffer;
        pendingOffer = null;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        for (const c of pendingIce) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
        pendingIce = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        useWs.getState().send('call:signal', {
          to: peer.id,
          callId,
          kind: 'answer',
          data: answer,
        });
      }
    } catch (e: any) {
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
    if (cur.callId !== callId || !cur.isCaller || !cur.peer) return;
    set({ state: 'connecting' });
    try {
      const conn = await setupPeer(cur.callId, cur.peer.id, cur.kind);
      const offer = await conn.createOffer({});
      await conn.setLocalDescription(offer);
      useWs.getState().send('call:signal', {
        to: cur.peer.id,
        callId,
        kind: 'offer',
        data: offer,
      });
    } catch (e: any) {
      set({ error: e.message });
      get().hangup();
    }
  },

  _onRejected: () => {
    cleanupPeer();
    set({
      state: 'idle',
      callId: null,
      peer: null,
      isCaller: false,
      error: 'Звонок отклонён',
    });
  },

  _onEnded: () => {
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
    if (cur.callId !== callId) return;
    try {
      if (kind === 'offer') {
        const offer = data as RTCSessionDescriptionInit;
        if (!pc) {
          pendingOffer = offer;
          return;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        for (const c of pendingIce) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
        pendingIce = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (cur.peer) {
          useWs.getState().send('call:signal', {
            to: cur.peer.id,
            callId,
            kind: 'answer',
            data: answer,
          });
        }
      } else if (kind === 'answer') {
        if (!pc) return;
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
      console.error('call signal error', e);
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
