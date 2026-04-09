"use client";

import { useEffect, useState } from "react";
import { avatarColor, initials, getMediaUrl } from "@/lib/helpers";

interface Props {
  id: string;
  name: string;
  avatarKey?: string | null;
  size?: number;
}

export function Avatar({ id, name, avatarKey, size = 44 }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarKey) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    getMediaUrl(avatarKey).then((u) => !cancelled && setUrl(u)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [avatarKey]);

  const style = { width: size, height: size, borderRadius: size / 2 };

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} style={style} className="object-cover bg-slate-200" />;
  }

  return (
    <div
      style={{ ...style, backgroundColor: avatarColor(id) }}
      className="flex items-center justify-center text-white font-bold flex-shrink-0"
    >
      <span style={{ fontSize: size * 0.4 }}>{initials(name)}</span>
    </div>
  );
}
