"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Trash2, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { getMediaUrl } from "@/lib/helpers";
import { useAuth } from "@/lib/store";
import { Avatar } from "./Avatar";
import type { StoryGroup } from "./StoriesBar";

interface Props {
  groups: StoryGroup[];
  startIdx: number;
  onClose: () => void;
  onDeleted?: () => void;
}

const PHOTO_DURATION_MS = 5_000;

interface Viewer {
  user: { id: string; username: string; displayName: string; avatarKey: string | null };
  viewedAt: string;
}

export function StoryViewer({ groups, startIdx, onClose, onDeleted }: Props) {
  const meId = useAuth((s) => s.user?.id);
  const [gIdx, setGIdx] = useState(startIdx);
  const [sIdx, setSIdx] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [showViewers, setShowViewers] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const group = groups[gIdx];
  const story = group?.stories[sIdx];
  const isMine = group?.author.id === meId;
  const isVideo = !!story?.mediaType.startsWith("video/");
  const durationMs = isVideo && videoDuration ? videoDuration * 1000 : PHOTO_DURATION_MS;

  useEffect(() => {
    setSIdx(0);
  }, [gIdx]);

  useEffect(() => {
    if (!story) return;
    let cancelled = false;
    setMediaUrl(null);
    setVideoDuration(null);
    setViewers(null);
    setShowViewers(false);
    getMediaUrl(story.mediaKey).then((u) => {
      if (!cancelled) setMediaUrl(u);
    }).catch(() => undefined);
    // отметим просмотр (для чужих)
    if (!isMine) {
      api.post(`/stories/${story.id}/view`).catch(() => undefined);
    }
    return () => { cancelled = true; };
  }, [story?.id, isMine]);

  const next = useCallback(() => {
    if (!group) return;
    if (sIdx + 1 < group.stories.length) {
      setSIdx(sIdx + 1);
    } else if (gIdx + 1 < groups.length) {
      setGIdx(gIdx + 1);
    } else {
      onClose();
    }
  }, [group, sIdx, gIdx, groups.length, onClose]);

  const prev = useCallback(() => {
    if (sIdx > 0) {
      setSIdx(sIdx - 1);
    } else if (gIdx > 0) {
      setGIdx(gIdx - 1);
      // перейдём в конец предыдущей группы после effect с gIdx
      setTimeout(() => setSIdx(Math.max(0, (groups[gIdx - 1]?.stories.length ?? 1) - 1)), 0);
    }
  }, [sIdx, gIdx, groups]);

  // Прогресс + автопереход
  useEffect(() => {
    if (!story || !mediaUrl || paused) return;
    if (isVideo && !videoDuration) return; // ждём пока определится длина видео
    startRef.current = performance.now() - progress * durationMs;
    const tick = (t: number) => {
      const p = Math.min(1, (t - startRef.current) / durationMs);
      setProgress(p);
      if (p >= 1) {
        setProgress(0);
        next();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [story?.id, mediaUrl, paused, next, isVideo, videoDuration, durationMs]);

  // Управление видео при паузе
  useEffect(() => {
    if (!videoRef.current) return;
    if (paused) videoRef.current.pause();
    else videoRef.current.play().catch(() => undefined);
  }, [paused]);

  const openViewers = async () => {
    if (!story) return;
    if (showViewers) {
      setShowViewers(false);
      return;
    }
    setShowViewers(true);
    setPaused(true);
    try {
      const { data } = await api.get<Viewer[]>(`/stories/${story.id}/viewers`);
      setViewers(data);
    } catch {}
  };

  useEffect(() => {
    setProgress(0);
  }, [story?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  const deleteStory = async () => {
    if (!story) return;
    if (!confirm("Удалить эту историю?")) return;
    try {
      await api.delete(`/stories/${story.id}`);
      onDeleted?.();
      // если была единственная — закрыть; иначе перейти на следующую
      if (group!.stories.length <= 1) {
        onClose();
      } else {
        next();
      }
    } catch {
      alert("Не получилось");
    }
  };

  if (!group || !story) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Прогресс-бары */}
      <div className="absolute top-3 left-3 right-3 flex gap-1">
        {group.stories.map((s, i) => (
          <div key={s.id} className="flex-1 h-0.5 bg-white/30 rounded overflow-hidden">
            <div
              className="h-full bg-white"
              style={{
                width: i < sIdx ? "100%" : i === sIdx ? `${progress * 100}%` : "0%",
                transition: i === sIdx ? "none" : "width 0.2s",
              }}
            />
          </div>
        ))}
      </div>

      {/* Шапка */}
      <div className="absolute top-6 left-3 right-3 flex items-center gap-2 mt-3 z-10">
        <Avatar
          id={group.author.id}
          name={group.author.displayName}
          avatarKey={group.author.avatarKey}
          size={36}
        />
        <div className="text-white font-semibold text-sm flex-1 truncate">
          {group.author.displayName}
        </div>
        {isMine && (
          <>
            <button
              onClick={openViewers}
              className="px-3 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 text-sm"
              title="Кто посмотрел"
            >
              <Eye size={16} /> {story.viewsCount ?? 0}
            </button>
            <button
              onClick={deleteStory}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              title="Удалить"
            >
              <Trash2 size={18} />
            </button>
          </>
        )}
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          title="Закрыть"
        >
          <X size={20} />
        </button>
      </div>

      {/* Медиа */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {mediaUrl && isVideo ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={videoRef}
            src={mediaUrl}
            autoPlay
            playsInline
            onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration || null)}
            className="max-h-full max-w-full object-contain"
          />
        ) : mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="text-white/60">Загрузка...</div>
        )}
      </div>

      {/* Тап-зоны */}
      <button
        onClick={prev}
        aria-label="Назад"
        className="absolute top-0 bottom-0 left-0 w-1/3 z-[5]"
      />
      <button
        onClick={next}
        aria-label="Дальше"
        className="absolute top-0 bottom-0 right-0 w-1/3 z-[5]"
      />

      {/* Модалка зрителей (для своих историй) */}
      {showViewers && (
        <div
          className="absolute inset-x-0 bottom-0 max-h-[60vh] bg-white dark:bg-slate-900 rounded-t-2xl z-30 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 p-4 border-b border-cream-border dark:border-slate-700">
            <Eye size={18} className="text-brand-dark" />
            <div className="font-semibold dark:text-white">
              Просмотры {viewers ? `· ${viewers.length}` : ""}
            </div>
            <button
              onClick={() => { setShowViewers(false); setPaused(false); }}
              className="ml-auto text-ink-muted hover:text-ink dark:hover:text-white"
              title="Закрыть"
            >
              <X size={20} />
            </button>
          </div>
          <div className="overflow-y-auto p-2">
            {viewers === null ? (
              <div className="text-center text-ink-muted py-6">Загрузка...</div>
            ) : viewers.length === 0 ? (
              <div className="text-center text-ink-muted py-6">Пока никто не посмотрел</div>
            ) : (
              viewers.map((v) => (
                <div key={v.user.id} className="flex items-center gap-3 px-3 py-2">
                  <Avatar id={v.user.id} name={v.user.displayName} avatarKey={v.user.avatarKey} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm dark:text-white truncate">{v.user.displayName}</div>
                    <div className="text-xs text-ink-muted">@{v.user.username}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
