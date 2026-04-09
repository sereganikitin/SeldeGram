"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";
import { useWs } from "@/lib/ws";
import { Chat } from "@/lib/types";
import { ChatList } from "@/components/ChatList";
import { ChatView } from "@/components/ChatView";

export default function ChatsPage() {
  const router = useRouter();
  const hydrate = useAuth((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const wsConnect = useWs((s) => s.connect);
  const wsDisconnect = useWs((s) => s.disconnect);
  const [selected, setSelected] = useState<Chat | null>(null);

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

  if (!hydrated || !user) {
    return <div className="flex-1 flex items-center justify-center text-slate-400">Загрузка...</div>;
  }

  return (
    <div className="flex-1 flex h-screen overflow-hidden">
      <div className={`${selected ? "hidden md:flex" : "flex"} w-full md:w-auto`}>
        <ChatList selectedId={selected?.id ?? null} onSelect={setSelected} onLogout={handleLogout} />
      </div>
      <div className={`${selected ? "flex" : "hidden md:flex"} flex-1`}>
        {selected ? (
          <ChatView chat={selected} onBack={() => setSelected(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 bg-slate-50">Выберите чат</div>
        )}
      </div>
    </div>
  );
}
