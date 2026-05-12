"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";
import { getMediaUrl } from "@/lib/helpers";

interface Props {
  mediaKey: string;
}

export function VideoNoteBubble({ mediaKey }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMediaUrl(mediaKey).then((u) => !cancelled && setUrl(u)).catch(() => undefined);
    return () => { cancelled = true; };
  }, [mediaKey]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.currentTime = 0;
      setMuted(false);
      v.muted = false;
      v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMuted((m) => {
      const next = !m;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  };

  return (
    <div className="relative w-56 h-56 rounded-full overflow-hidden bg-black select-none">
      {url ? (
        <video
          ref={videoRef}
          src={url}
          muted={muted}
          playsInline
          loop={false}
          preload="metadata"
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="w-full h-full object-cover cursor-pointer"
        />
      ) : (
        <div className="absolute inset-0 bg-black/30 animate-pulse" />
      )}

      {!playing && url && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30"
          aria-label="Воспроизвести"
        >
          <div className="w-14 h-14 rounded-full bg-white/85 flex items-center justify-center">
            <Play size={26} className="text-brand-dark ml-1" fill="currentColor" />
          </div>
        </button>
      )}

      {playing && (
        <button
          onClick={toggleMute}
          className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-black/55 hover:bg-black/70 text-white flex items-center justify-center"
          aria-label={muted ? "Включить звук" : "Выключить звук"}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      )}
    </div>
  );
}
