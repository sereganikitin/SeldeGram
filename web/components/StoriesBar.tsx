"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { Avatar } from "./Avatar";
import { uploadFile } from "@/lib/media";
import { StoryViewer } from "./StoryViewer";

export interface StoryAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
}

export interface Story {
  id: string;
  mediaKey: string;
  mediaType: string;
  createdAt: string;
  expiresAt: string;
}

export interface StoryGroup {
  author: StoryAuthor;
  stories: Story[];
}

export function StoriesBar() {
  const me = useAuth((s) => s.user);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<StoryGroup[]>("/stories");
      setGroups(data);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000); // обновляем каждую минуту
    return () => clearInterval(id);
  }, [load]);

  const myGroup = groups.find((g) => g.author.id === me?.id);
  const others = groups.filter((g) => g.author.id !== me?.id);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !me) return;
    setUploading(true);
    try {
      const { key, contentType } = await uploadFile(file);
      await api.post("/stories", { mediaKey: key, mediaType: contentType });
      await load();
    } catch (err: unknown) {
      const e2 = err as { message?: string };
      alert(e2.message ?? "Не получилось");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 overflow-x-auto px-3 py-2 border-b border-cream-border dark:border-slate-800 bg-white dark:bg-slate-950">
        <input type="file" ref={fileRef} accept="image/*" hidden onChange={onPickFile} />

        {/* «Моя история» */}
        <button
          onClick={() => {
            if (myGroup) {
              const idx = groups.findIndex((g) => g.author.id === me?.id);
              setViewerIdx(idx);
            } else {
              fileRef.current?.click();
            }
          }}
          className="flex-shrink-0 flex flex-col items-center gap-1 w-16"
          disabled={uploading}
        >
          <div className="relative">
            <div className={`rounded-full ${myGroup ? "p-0.5 bg-gradient-to-tr from-brand to-brand-dark" : ""}`}>
              <div className="bg-white dark:bg-slate-950 p-0.5 rounded-full">
                <Avatar id={me?.id ?? ""} name={me?.displayName ?? "?"} avatarKey={me?.avatarKey} size={52} />
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-gradient-to-br from-brand to-brand-dark border-2 border-white dark:border-slate-950 flex items-center justify-center">
              <Plus size={12} color="#fff" strokeWidth={3} />
            </div>
          </div>
          <span className="text-[11px] truncate w-full text-center dark:text-white">
            {uploading ? "..." : "Вы"}
          </span>
        </button>

        {others.map((g) => {
          const idx = groups.findIndex((x) => x.author.id === g.author.id);
          return (
            <button
              key={g.author.id}
              onClick={() => setViewerIdx(idx)}
              className="flex-shrink-0 flex flex-col items-center gap-1 w-16"
            >
              <div className="rounded-full p-0.5 bg-gradient-to-tr from-brand to-brand-dark">
                <div className="bg-white dark:bg-slate-950 p-0.5 rounded-full">
                  <Avatar
                    id={g.author.id}
                    name={g.author.displayName}
                    avatarKey={g.author.avatarKey}
                    size={52}
                  />
                </div>
              </div>
              <span className="text-[11px] truncate w-full text-center dark:text-white">
                {g.author.displayName.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {viewerIdx !== null && (
        <StoryViewer
          groups={groups}
          startIdx={viewerIdx}
          onClose={() => setViewerIdx(null)}
          onDeleted={load}
        />
      )}
    </>
  );
}
