"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onRecorded: (blob: Blob, durationMs: number) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onRecorded, onCancel }: Props) {
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const durationMs = Date.now() - startTimeRef.current;
          onRecorded(blob, durationMs);
        };
        recorder.start(100);
        startTimeRef.current = Date.now();
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      } catch {
        onCancel();
      }
    })();
    return () => {
      cancelled = true;
      timerRef.current && clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [onRecorded, onCancel]);

  const stop = () => {
    timerRef.current && clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const cancel = () => {
    timerRef.current && clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    onCancel();
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-950 border-t border-cream-border dark:border-slate-800">
      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
      <div className="font-mono text-lg font-semibold dark:text-white">{fmt(seconds)}</div>
      <div className="flex-1" />
      <button onClick={cancel} className="text-ink-muted hover:text-slate-800 dark:hover:text-white px-3 py-2">
        Отмена
      </button>
      <button
        onClick={stop}
        className="w-11 h-11 rounded-full bg-brand hover:bg-brand-dark text-white flex items-center justify-center text-xl"
      >
        ⏹
      </button>
    </div>
  );
}
