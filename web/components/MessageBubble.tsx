"use client";

import { useEffect, useState } from "react";
import { Message } from "@/lib/types";
import { formatTime, messagePreview, getMediaUrl } from "@/lib/helpers";
import { AudioPlayer } from "./AudioPlayer";
import { PollBubble } from "./PollBubble";

interface Props {
  message: Message;
  mine: boolean;
  showSenderName: boolean;
  senderName?: string;
  isRead: boolean;
  onAction: (action: "reply" | "edit" | "delete" | "copy" | "pin" | "thread") => void;
  canComment?: boolean;
}

function MediaContent({ message, mine }: { message: Message; mine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!message.mediaKey) return;
    let cancelled = false;
    getMediaUrl(message.mediaKey).then((u) => !cancelled && setUrl(u)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [message.mediaKey]);

  if (!message.mediaKey || !message.mediaType) return null;

  if (message.isSticker && url) {
    if (message.mediaType?.startsWith("video/")) {
      return <video src={url} className="w-36 h-36 object-contain" autoPlay loop muted playsInline />;
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="w-36 h-36 object-contain" />;
  }

  if (message.mediaType.startsWith("audio/")) {
    return <AudioPlayer mediaKey={message.mediaKey} duration={message.mediaSize ?? undefined} mine={mine} />;
  }

  if (message.mediaType.startsWith("image/")) {
    if (!url) return <div className="w-56 h-56 bg-black/10 rounded-xl animate-pulse" />;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="w-56 max-h-72 object-cover rounded-xl" />;
  }

  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 text-current hover:opacity-80"
    >
      <span className="text-2xl">📄</span>
      <div>
        <div className="text-sm font-semibold">{message.mediaName ?? "Файл"}</div>
        {message.mediaSize != null && (
          <div className="text-xs opacity-70">{Math.round(message.mediaSize / 1024)} KB</div>
        )}
      </div>
    </a>
  );
}

export function MessageBubble({ message, mine, showSenderName, senderName, isRead, onAction, canComment }: Props) {
  const isDeleted = !!message.deletedAt;
  const isSticker = !!message.isSticker && !isDeleted;
  const [menuOpen, setMenuOpen] = useState(false);

  const handleContext = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen((v) => !v);
  };

  if (isSticker) {
    return (
      <div
        onContextMenu={handleContext}
        className={`my-1 flex flex-col ${mine ? "items-end" : "items-start"} relative`}
      >
        {showSenderName && !mine && <div className="text-xs font-bold text-brand-dark mb-1 ml-1">{senderName}</div>}
        <MediaContent message={message} mine={mine} />
        <div className="flex items-center gap-1 mt-1 text-[11px] text-ink-muted">
          <span>{formatTime(message.createdAt)}</span>
          {mine && <span>{isRead ? "✓✓" : "✓"}</span>}
        </div>
        {menuOpen && <ActionMenu mine={mine} hasContent={false} onAction={onAction} onClose={() => setMenuOpen(false)} />}
      </div>
    );
  }

  return (
    <div className={`flex my-1 ${mine ? "justify-end" : "justify-start"}`}>
      <div
        onContextMenu={handleContext}
        className={`relative max-w-[78%] px-3 py-2 rounded-2xl ${
          mine ? "bg-brand text-white" : "bg-white dark:bg-slate-800 text-ink dark:text-white shadow-sm"
        }`}
      >
        {showSenderName && !mine && !isDeleted && (
          <div className="text-xs font-bold text-brand-dark mb-1">{senderName}</div>
        )}

        {message.forwardedFromId && !isDeleted && (
          <div className={`text-xs italic mb-1 ${mine ? "text-white/70" : "text-ink-muted"}`}>↪ Переслано</div>
        )}

        {message.replyTo && !isDeleted && (
          <div
            className={`border-l-2 pl-2 py-1 mb-1 text-xs rounded ${
              mine ? "border-white/70 bg-white/10 text-white/90" : "border-brand bg-brand/10 text-ink"
            }`}
          >
            {messagePreview(message.replyTo)}
          </div>
        )}

        {isDeleted ? (
          <span className={`italic text-sm ${mine ? "text-white/70" : "text-ink-muted"}`}>удалено</span>
        ) : (
          <>
            <MediaContent message={message} mine={mine} />
            {message.content?.startsWith("📊 ") ? (
              <PollBubble messageId={message.id} mine={mine} />
            ) : message.content ? (
              <div className="text-base whitespace-pre-wrap break-words mt-1">{message.content}</div>
            ) : null}
          </>
        )}

        <div className={`flex items-center gap-1 justify-end text-[11px] mt-1 ${mine ? "text-white/70" : "text-ink-muted"}`}>
          {message.editedAt && !isDeleted && <span className="italic">изм.</span>}
          <span>{formatTime(message.createdAt)}</span>
          {mine && !isDeleted && <span>{isRead ? "✓✓" : "✓"}</span>}
        </div>

        {menuOpen && (
          <ActionMenu mine={mine} hasContent={!!message.content && !isDeleted} onAction={(a) => { setMenuOpen(false); onAction(a); }} onClose={() => setMenuOpen(false)} />
        )}
      </div>
    </div>
  );
}

function ActionMenu({
  mine,
  hasContent,
  onAction,
  onClose,
}: {
  mine: boolean;
  hasContent: boolean;
  onAction: (a: "reply" | "edit" | "delete" | "copy") => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute z-50 bottom-full mb-1 right-0 bg-white dark:bg-slate-800 dark:text-white shadow-xl rounded-lg border border-cream-border dark:border-slate-700 py-1 min-w-[160px]">
        <button onClick={() => onAction("reply")} className="w-full text-left px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700">
          ↩ Ответить
        </button>
        <button onClick={() => onAction("pin")} className="w-full text-left px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700">
          📌 Закрепить
        </button>
        {canComment && (
          <button onClick={() => onAction("thread")} className="w-full text-left px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700">
            💬 Комментарии
          </button>
        )}
        {hasContent && (
          <button onClick={() => onAction("copy")} className="w-full text-left px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700">
            📋 Копировать
          </button>
        )}
        {mine && hasContent && (
          <button onClick={() => onAction("edit")} className="w-full text-left px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700">
            ✏ Изменить
          </button>
        )}
        {mine && (
          <button
            onClick={() => onAction("delete")}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            🗑 Удалить
          </button>
        )}
      </div>
    </>
  );
}
