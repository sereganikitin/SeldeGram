"use client";

import { useEffect, useState } from "react";
import { getMediaUrl } from "@/lib/helpers";

interface Props {
  mediaKey: string;
  mediaType?: string;
  size?: number;
}

export function StickerImage({ mediaKey, mediaType, size = 80 }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getMediaUrl(mediaKey).then((u) => !cancelled && setUrl(u)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mediaKey]);

  const style = { width: size, height: size };
  if (!url) return <div style={style} className="bg-slate-200/40 rounded animate-pulse" />;

  if (mediaType?.startsWith("video/")) {
    return (
      <video
        src={url}
        style={style}
        className="object-contain"
        autoPlay
        loop
        muted
        playsInline
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" style={style} className="object-contain" />;
}
