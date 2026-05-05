"use client";

import { useEffect, useRef, useState } from "react";
import { Message } from "@/lib/types";
import { formatTime, messagePreview, getMediaUrl, groupReactions } from "@/lib/helpers";
import { AudioPlayer } from "./AudioPlayer";
import { PollBubble } from "./PollBubble";
import { Reply, Pin, MessageSquare, Copy, Pencil, Trash2, FileText, MoreHorizontal, Share2, Check, CheckCheck, Languages, Timer, Bookmark } from "lucide-react";

interface Props {
  message: Message;
  mine: boolean;
  showSenderName: boolean;
  senderName?: string;
  isRead: boolean;
  onAction: (action: "reply" | "edit" | "delete" | "copy" | "pin" | "thread" | "translate" | "save") => void;
  onReact?: (emoji: string) => void;
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
      <FileText size={26} className="flex-shrink-0" />
      <div>
        <div className="text-sm font-semibold">{message.mediaName ?? "Файл"}</div>
        {message.mediaSize != null && (
          <div className="text-xs opacity-70">{Math.round(message.mediaSize / 1024)} KB</div>
        )}
      </div>
    </a>
  );
}

export function MessageBubble({ message, mine, showSenderName, senderName, isRead, onAction, onReact, canComment }: Props) {
  const isDeleted = !!message.deletedAt;
  const isSticker = !!message.isSticker && !isDeleted;
  const [menuOpen, setMenuOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el || isDeleted) return;

    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let startX = 0;
    let startY = 0;
    let fired = false;

    const open = () => {
      setMenuOpen(true);
    };

    const handleContextMenu = (e: Event) => {
      e.preventDefault();
      open();
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 2) {
        e.preventDefault();
        open();
        return;
      }
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      startX = e.clientX;
      startY = e.clientY;
      fired = false;
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        fired = true;
        open();
      }, 500);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!pressTimer) return;
      if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    const cancel = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    const handleClickCapture = (e: MouseEvent) => {
      if (fired) {
        e.preventDefault();
        e.stopPropagation();
        fired = false;
      }
    };

    el.addEventListener("contextmenu", handleContextMenu);
    el.addEventListener("pointerdown", handlePointerDown);
    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerup", cancel);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("pointerleave", cancel);
    el.addEventListener("click", handleClickCapture, { capture: true });

    return () => {
      el.removeEventListener("contextmenu", handleContextMenu);
      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerup", cancel);
      el.removeEventListener("pointercancel", cancel);
      el.removeEventListener("pointerleave", cancel);
      el.removeEventListener("click", handleClickCapture, { capture: true });
      cancel();
    };
  }, [isDeleted]);

  const noSelectStyle = {
    WebkitTouchCallout: "none" as const,
    WebkitUserSelect: "none" as const,
    userSelect: "none" as const,
  };

  if (isSticker) {
    return (
      <div
        ref={rowRef}
        className={`my-1 flex flex-col ${mine ? "items-end" : "items-start"} relative group`}
        style={noSelectStyle}
      >
        {showSenderName && !mine && <div className="text-xs font-bold text-brand-dark mb-1 ml-1">{senderName}</div>}
        <MediaContent message={message} mine={mine} />
        <div className="flex items-center gap-1 mt-1 text-[11px] text-ink-muted">
          <span>{formatTime(message.createdAt)}</span>
          {mine && (isRead ? <CheckCheck size={12} /> : <Check size={12} />)}
          <button onClick={() => setMenuOpen((v) => !v)} className="opacity-0 group-hover:opacity-100 ml-1 text-ink-muted hover:text-ink transition-opacity" title="Ещё">
            <MoreHorizontal size={14} />
          </button>
        </div>
        {menuOpen && <ActionMenu mine={mine} hasContent={false} canComment={canComment} onAction={(a) => { setMenuOpen(false); onAction(a); }} onClose={() => setMenuOpen(false)} />}
      </div>
    );
  }

  return (
    <div ref={rowRef} className={`relative flex my-1 ${mine ? "justify-end" : "justify-start"} group`}>
      <div
        className={`relative max-w-[78%] px-3 py-2 rounded-2xl overflow-hidden ${
          mine ? "bg-brand text-white" : "bg-white dark:bg-slate-800 text-ink dark:text-white shadow-sm"
        }`}
        style={noSelectStyle}
      >
        {showSenderName && !mine && !isDeleted && (
          <div className="text-xs font-bold text-brand-dark mb-1">{senderName}</div>
        )}

        {message.forwardedFromId && !isDeleted && (
          <div className={`text-xs italic mb-1 flex items-center gap-1 ${mine ? "text-white/70" : "text-ink-muted"}`}>
            <Share2 size={12} /> Переслано
          </div>
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
              <div className="text-base whitespace-pre-wrap break-all mt-1">{message.content}</div>
            ) : null}
          </>
        )}

        {message.reactions && message.reactions.length > 0 && !isDeleted && (
          <div className="flex flex-wrap gap-1 mt-1">
            {groupReactions(message.reactions).map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact?.(r.emoji)}
                className={`text-xs px-1.5 py-0.5 rounded-full ${mine ? "bg-white/20 hover:bg-white/30" : "bg-brand/10 hover:bg-brand/20"}`}
              >
                {r.emoji}{r.count > 1 ? ` ${r.count}` : ""}
              </button>
            ))}
          </div>
        )}
        <div className={`flex items-center gap-1 justify-end text-[11px] mt-1 ${mine ? "text-white/70" : "text-ink-muted"}`}>
          {message.expiresAt && !isDeleted && (
            <span title={`Удалится ${new Date(message.expiresAt).toLocaleString()}`} className="flex items-center">
              <Timer size={11} />
            </span>
          )}
          {message.editedAt && !isDeleted && <span className="italic">изм.</span>}
          <span>{formatTime(message.createdAt)}</span>
          {mine && !isDeleted && (isRead ? <CheckCheck size={12} /> : <Check size={12} />)}
          {!isDeleted && (
            <span className="opacity-0 group-hover:opacity-100 ml-1 flex items-center gap-0.5 transition-opacity">
              {["❤️", "👍", "😂"].map((e) => (
                <button key={e} onClick={() => onReact?.(e)} className="hover:scale-125 transition-transform">{e}</button>
              ))}
              <button onClick={() => setMenuOpen((v) => !v)} className="hover:opacity-80" title="Ещё">
                <MoreHorizontal size={14} />
              </button>
            </span>
          )}
        </div>

      </div>
      {menuOpen && (
        <ActionMenu mine={mine} hasContent={!!message.content && !isDeleted} canComment={canComment} onAction={(a) => { setMenuOpen(false); onAction(a); }} onClose={() => setMenuOpen(false)} />
      )}
    </div>
  );
}

function ActionMenu({
  mine,
  hasContent,
  canComment,
  onAction,
  onClose,
}: {
  mine: boolean;
  hasContent: boolean;
  canComment?: boolean;
  onAction: (a: "reply" | "edit" | "delete" | "copy" | "pin" | "thread" | "translate" | "save") => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", handler);
      document.addEventListener("touchstart", handler);
      document.addEventListener("keydown", handleEsc);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className={`absolute z-50 bottom-full mb-1 ${mine ? "right-2" : "left-2"} bg-white dark:bg-slate-800 dark:text-white shadow-xl rounded-lg border border-cream-border dark:border-slate-700 py-1 min-w-[160px]`}
      onContextMenu={(e) => e.preventDefault()}
    >
        <button onClick={() => onAction("reply")} className="w-full text-left px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700 flex items-center gap-2">
          <Reply size={16} className="text-brand-dark" /> Ответить
        </button>
        <button onClick={() => onAction("pin")} className="w-full text-left px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700 flex items-center gap-2">
          <Pin size={16} className="text-brand-dark" /> Закрепить
        </button>
        {canComment && (
          <button onClick={() => onAction("thread")} className="w-full text-left px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700 flex items-center gap-2">
            <MessageSquare size={16} className="text-brand-dark" /> Комментарии
          </button>
        )}
        {hasContent && (
          <button onClick={() => onAction("copy")} className="w-full text-left px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700 flex items-center gap-2">
            <Copy size={16} className="text-brand-dark" /> Копировать
          </button>
        )}
        {hasContent && (
          <button onClick={() => onAction("translate")} className="w-full text-left px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700 flex items-center gap-2">
            <Languages size={16} className="text-brand-dark" /> Перевести
          </button>
        )}
        <button onClick={() => onAction("save")} className="w-full text-left px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700 flex items-center gap-2">
          <Bookmark size={16} className="text-brand-dark" /> В избранное
        </button>
        {mine && hasContent && (
          <button onClick={() => onAction("edit")} className="w-full text-left px-3 py-2 text-sm hover:bg-cream dark:hover:bg-slate-700 flex items-center gap-2">
            <Pencil size={16} className="text-brand-dark" /> Изменить
          </button>
        )}
        {mine && (
          <button
            onClick={() => onAction("delete")}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
          >
            <Trash2 size={16} /> Удалить
          </button>
        )}
    </div>
  );
}
