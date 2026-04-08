"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";

export default function Home() {
  const router = useRouter();
  const hydrate = useAuth((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(user ? "/chats" : "/login");
  }, [hydrated, user, router]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-slate-400">Загрузка...</div>
    </div>
  );
}
