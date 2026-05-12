"use client";

import { useEffect, useRef, useState } from "react";
import { Square, X } from "lucide-react";

interface Props {
  onRecorded: (blob: Blob, durationMs: number, mimeType: string) => void;
  onCancel: () => void;
}

const MAX_SECONDS = 30;

function pickMime(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export function VideoNoteRecorder({ onRecorded, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        setError("Не удалось получить доступ к камере и микрофону");
      }
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch {}
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const mime = pickMime();
    let rec: MediaRecorder;
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      setError("Браузер не поддерживает запись видео");
      return;
    }
    recorderRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const durationMs = Date.now() - startTimeRef.current;
      const finalMime = rec.mimeType || mime || "video/webm";
      const blob = new Blob(chunksRef.current, { type: finalMime });
      cleanup();
      onRecorded(blob, durationMs, finalMime);
    };
    startTimeRef.current = Date.now();
    rec.start(200);
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        if (next >= MAX_SECONDS) {
          stop();
        }
        return next;
      });
    }, 1000);
  };

  const stop = () => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    rec.stop();
  };

  const cancel = () => {
    if (recorderRef.current) {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
    }
    cleanup();
    onCancel();
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 w-[320px] max-w-[90vw] flex flex-col items-center gap-4">
        <div className="self-stretch flex items-center justify-between">
          <div className="font-semibold dark:text-white">Видеосообщение</div>
          <button onClick={cancel} className="text-ink-muted hover:text-slate-800 dark:hover:text-white" title="Закрыть">
            <X size={20} />
          </button>
        </div>

        <div className="w-60 h-60 rounded-full overflow-hidden bg-black relative">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center text-white text-center px-4 text-sm">
              {error}
            </div>
          ) : (
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
          )}
          {recording && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/55 px-3 py-1 rounded-full">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white font-mono text-sm">{fmt(seconds)}</span>
            </div>
          )}
        </div>

        <div className="text-xs text-ink-muted">
          {recording ? `Запись — макс. ${MAX_SECONDS}с` : "До 30 секунд"}
        </div>

        {!recording ? (
          <button
            onClick={start}
            disabled={!ready || !!error}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-brand to-brand-dark text-white flex items-center justify-center shadow-md disabled:opacity-40"
            title="Записать"
          >
            <div className="w-5 h-5 rounded-full bg-white" />
          </button>
        ) : (
          <button
            onClick={stop}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-brand to-brand-dark text-white flex items-center justify-center shadow-md"
            title="Остановить и отправить"
          >
            <Square size={22} fill="currentColor" />
          </button>
        )}
      </div>
    </div>
  );
}
