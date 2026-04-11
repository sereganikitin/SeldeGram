"use client";

import { useEffect, useState } from "react";
import { parseWallpaper } from "@/lib/wallpapers";
import { getMediaUrl } from "@/lib/helpers";

interface Props {
  wallpaper?: string | null;
  children: React.ReactNode;
}

export function ChatBackground({ wallpaper, children }: Props) {
  const parsed = parseWallpaper(wallpaper);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    if (parsed?.kind === "media") {
      getMediaUrl(parsed.key).then(setImgUrl).catch(() => {});
    } else {
      setImgUrl(null);
    }
  }, [parsed?.kind === "media" ? parsed.key : null]);

  if (parsed?.kind === "media" && imgUrl) {
    return (
      <div
        className="flex-1 flex flex-col min-h-0 relative"
        style={{ backgroundImage: `url(${imgUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        {children}
      </div>
    );
  }

  if (parsed?.kind === "preset") {
    const bg = parsed.preset.color2 ?? parsed.preset.color1;
    if (parsed.preset.patternSvg) {
      return (
        <div className="flex-1 flex flex-col min-h-0 relative" style={{ backgroundColor: bg }}>
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            dangerouslySetInnerHTML={{ __html: parsed.preset.patternSvg }}
          />
          <div className="relative flex-1 flex flex-col min-h-0">{children}</div>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col min-h-0" style={{ backgroundColor: bg }}>
        {children}
      </div>
    );
  }

  return <div className="flex-1 flex flex-col min-h-0 bg-cream dark:bg-slate-900">{children}</div>;
}
