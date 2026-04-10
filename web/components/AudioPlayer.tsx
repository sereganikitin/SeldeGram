"use client";

import { useEffect, useRef, useState } from "react";
import { getMediaUrl } from "@/lib/helpers";

interface Props {
  mediaKey: string;
  duration?: number;
  mine: boolean;
}

export function AudioPlayer({ mediaKey, duration, mine }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [totalMs, setTotalMs] = useState(duration ?? 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMediaUrl(mediaKey).then((u) => !cancelled && setUrl(u)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mediaKey]);

  useEffect(() => {
    if (!url) return;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.addEventListener("loadedmetadata", () => {
      if (audio.duration && isFinite(audio.duration)) setTotalMs(audio.duration * 1000);
    });
    audio.addEventListener("timeupdate", () => setPosition(audio.currentTime * 1000));
    audio.addEventListener("ended", () => {
      setPlaying(false);
      setPosition(0);
    });
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [url]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = totalMs > 0 ? position / totalMs : 0;

  return (
    <div className="flex items-center gap-3 min-w-[180px]">
      <button
        onClick={toggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
          mine ? "bg-white/20 text-white" : "bg-brand/10 text-brand-dark"
        }`}
      >
        {playing ? "⏸" : "▶"}
      </button>
      <div className="flex-1">
        <div className="h-1 bg-black/10 dark:bg-white/10 rounded overflow-hidden">
          <div
            className={`h-full rounded ${mine ? "bg-white" : "bg-brand"}`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className={`text-xs mt-1 ${mine ? "text-white/70" : "text-slate-500"}`}>
          {playing ? fmt(position) : fmt(totalMs)}
        </div>
      </div>
    </div>
  );
}
