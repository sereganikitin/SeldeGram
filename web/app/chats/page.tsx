"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useWs, type WsState } from "@/lib/ws";
import { Chat } from "@/lib/types";
import { ChatList } from "@/components/ChatList";
import { ChatView } from "@/components/ChatView";
import { NewChatModal } from "@/components/NewChatModal";
import { StickerPacksModal } from "@/components/StickerPacksModal";

export default function ChatsPage() {
  const router = useRouter();
  const hydrate = useAuth((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const wsConnect = useWs((s: WsState) => s.connect);
  const wsDisconnect = useWs((s: WsState) => s.disconnect);
  const [selected, setSelected] = useState<Chat | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
    router.replace("/login");
  };

  const handleChatCreated = (chat: Chat) => {
    setNewChatOpen(false);
    setSelected(chat);
  };

  if (!hydrated || !user) {
    return <div className="flex-1 flex items-center justify-center text-slate-400">Загрузка...</div>;
  }

  return (
    <>
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className={`${selected ? "hidden md:flex" : "flex"} w-full md:w-auto`}>
          <ChatList
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            onLogout={handleLogout}
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
            <div className="flex-1 flex items-center justify-center text-slate-400 bg-slate-50">Выберите чат</div>
          )}
        </div>
      </div>

      <NewChatModal open={newChatOpen} onClose={() => setNewChatOpen(false)} onCreated={handleChatCreated} />
      <StickerPacksModal open={stickersOpen} onClose={() => setStickersOpen(false)} />
    </>
  );
}
