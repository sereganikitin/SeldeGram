"use client";

import { useEffect, useRef, useState } from "react";
import { useCall, getLocalCallStream, getRemoteCallStream } from "@/lib/call";
import { Avatar } from "./Avatar";
import { Phone, PhoneOff, Mic, MicOff, X, Check } from "lucide-react";

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

export function CallOverlay() {
  const state = useCall((s) => s.state);
  const peer = useCall((s) => s.peer);
  const kind = useCall((s) => s.kind);
  const muted = useCall((s) => s.muted);
  const isCaller = useCall((s) => s.isCaller);
  const acceptedAt = useCall((s) => s.acceptedAt);
  const error = useCall((s) => s.error);
  const accept = useCall((s) => s.acceptIncoming);
  const reject = useCall((s) => s.rejectIncoming);
  const hangup = useCall((s) => s.hangup);
  const toggleMute = useCall((s) => s.toggleMute);
  const remoteVer = useCall((s) => s.remoteStreamVersion);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const isVideo = kind === "video";

  useEffect(() => {
    if (!isVideo) return;
    if (localVideoRef.current) localVideoRef.current.srcObject = getLocalCallStream();
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = getRemoteCallStream();
  }, [isVideo, state, remoteVer]);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (state !== "active") return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [state]);

  // Рингтон для исходящего и входящего
  useEffect(() => {
    if (state !== "incoming-ringing" && state !== "outgoing-ringing") return;
    const audio = new Audio(
      state === "incoming-ringing" ? "/sounds/ringtone.mp3" : "/sounds/dialing.mp3"
    );
    audio.loop = true;
    audio.volume = 0.6;
    audio.play().catch(() => undefined);
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [state]);

  if (state === "idle" || state === "ended" || !peer) return null;

  const statusLabel =
    state === "outgoing-ringing"
      ? "Звоним..."
      : state === "incoming-ringing"
        ? "Входящий звонок"
        : state === "connecting"
          ? "Соединение..."
          : acceptedAt
            ? formatDuration(now - acceptedAt)
            : "В разговоре";

  // Видео-режим — фуллскрин с local превью в углу
  if (isVideo && (state === "active" || state === "connecting")) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
        />
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute top-4 right-4 w-32 h-44 object-cover rounded-xl border-2 border-white/40 shadow-lg"
        />
        <div className="absolute top-4 left-4 right-44 text-white">
          <div className="font-bold text-lg drop-shadow">{peer.displayName || peer.username}</div>
          <div className="text-sm opacity-90 drop-shadow">{statusLabel}</div>
        </div>
        <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6">
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
              muted ? "bg-white text-brand-dark" : "bg-white/20 hover:bg-white/30 text-white"
            }`}
            title={muted ? "Включить микрофон" : "Выключить микрофон"}
          >
            {muted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          <button
            onClick={hangup}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 flex items-center justify-center text-white transition shadow-lg"
            title="Завершить"
          >
            <PhoneOff size={28} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-brand to-brand-dark text-white rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center">
        <Avatar
          id={peer.id}
          name={peer.displayName || peer.username}
          avatarKey={peer.avatarKey}
          size={120}
        />
        <div className="mt-5 text-2xl font-bold text-center">
          {peer.displayName || peer.username}
        </div>
        <div className="mt-2 text-sm opacity-90">
          {kind === "video" ? "Видеозвонок" : "Аудиозвонок"} · {statusLabel}
        </div>
        {error && (
          <div className="mt-3 text-sm text-red-200 text-center">{error}</div>
        )}

        <div className="mt-8 w-full flex items-center justify-center gap-6">
          {state === "incoming-ringing" ? (
            <>
              <button
                onClick={reject}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 flex items-center justify-center text-white transition shadow-lg"
                title="Отклонить"
              >
                <PhoneOff size={28} />
              </button>
              <button
                onClick={accept}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 flex items-center justify-center text-white transition shadow-lg"
                title="Принять"
              >
                <Phone size={28} />
              </button>
            </>
          ) : (
            <>
              {(state === "active" || state === "connecting") && (
                <button
                  onClick={toggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
                    muted ? "bg-white text-brand-dark" : "bg-white/20 hover:bg-white/30 text-white"
                  }`}
                  title={muted ? "Включить микрофон" : "Выключить микрофон"}
                >
                  {muted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
              )}
              <button
                onClick={hangup}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 flex items-center justify-center text-white transition shadow-lg"
                title={isCaller && state === "outgoing-ringing" ? "Отменить" : "Завершить"}
              >
                <PhoneOff size={28} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
