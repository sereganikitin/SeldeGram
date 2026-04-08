"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store";

export default function ChatsPage() {
  const router = useRouter();
  const hydrate = useAuth((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !user) router.replace("/login");
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return <div className="flex-1 flex items-center justify-center text-slate-400">Загрузка...</div>;
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white font-bold">
            S
          </div>
          <h1 className="text-xl font-bold">SeldeGram</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{user.displayName}</span>
          <button
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="text-sm text-slate-500 hover:text-slate-900 transition"
          >
            Выйти
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center text-center px-6">
        <div>
          <div className="text-6xl mb-4">💬</div>
          <h2 className="text-2xl font-bold">Здравствуйте, {user.displayName}!</h2>
          <p className="mt-2 text-slate-600">Список чатов будет доступен в следующем обновлении</p>
          <p className="mt-1 text-sm text-slate-400">@{user.username} · {user.email}</p>
        </div>
      </main>
    </div>
  );
}
