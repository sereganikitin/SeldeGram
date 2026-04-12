"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { useWs, type WsState } from "@/lib/ws";
import { Chat } from "@/lib/types";
import { ChatList } from "@/components/ChatList";
import { ChatView } from "@/components/ChatView";
import { NewChatModal } from "@/components/NewChatModal";
import { StickerPacksModal } from "@/components/StickerPacksModal";
import { ProfileModal } from "@/components/ProfileModal";
import { WallpaperPickerModal } from "@/components/WallpaperPickerModal";
import { BlockListModal } from "@/components/BlockListModal";

export default function ChatsPage() {
  const router = useRouter();
  const hydrate = useAuth((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const themeHydrate = useTheme((s) => s.hydrate);
  const wsConnect = useWs((s: WsState) => s.connect);
  const wsDisconnect = useWs((s: WsState) => s.disconnect);
  const [selected, setSelected] = useState<Chat | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [blockListOpen, setBlockListOpen] = useState(false);

  useEffect(() => {
    hydrate();
    themeHydrate();
  }, [hydrate, themeHydrate]);

  useEffect(() => {
    if (hydrated && !user) router.replace("/login");
  }, [hydrated, user, router]);

  useEffect(() => {
    if (user) wsConnect();
    return () => wsDisconnect();
  }, [user, wsConnect, wsDisconnect]);

  const handleLogout = () => {
    logout();
    wsDisconnect();
    setProfileOpen(false);
    router.replace("/login");
  };

  const handleChatCreated = (chat: Chat) => {
    setNewChatOpen(false);
    setSelected(chat);
  };

  if (!hydrated || !user) {
    return <div className="flex-1 flex items-center justify-center text-ink-muted">Загрузка...</div>;
  }

  return (
    <>
      <div className="flex-1 flex min-h-0 overflow-hidden w-full max-w-full">
        <div className={`${selected ? "hidden md:flex" : "flex"} w-full md:w-auto`}>
          <ChatList
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            onLogout={() => setProfileOpen(true)}
            onNewChat={() => setNewChatOpen(true)}
            onOpenStickers={() => setStickersOpen(true)}
          />
        </div>
        <div className={`${selected ? "flex" : "hidden md:flex"} flex-1`}>
          {selected ? (
            <ChatView
              chat={selected}
              onBack={() => setSelected(null)}
              onChatGone={() => setSelected(null)}
              onOpenStickers={() => setStickersOpen(true)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-ink-muted bg-cream dark:bg-slate-900">
              Выберите чат
            </div>
          )}
        </div>
      </div>

      <NewChatModal open={newChatOpen} onClose={() => setNewChatOpen(false)} onCreated={handleChatCreated} />
      <StickerPacksModal open={stickersOpen} onClose={() => setStickersOpen(false)} />
      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={handleLogout}
        onOpenWallpaper={() => {
          setProfileOpen(false);
          setWallpaperOpen(true);
        }}
        onOpenBlockList={() => {
          setProfileOpen(false);
          setBlockListOpen(true);
        }}
      />
      <WallpaperPickerModal open={wallpaperOpen} onClose={() => setWallpaperOpen(false)} />
      <BlockListModal open={blockListOpen} onClose={() => setBlockListOpen(false)} />
    </>
  );
}
