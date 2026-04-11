"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const setTokens = useAuth((s) => s.setTokens);
  const fetchMe = useAuth((s) => s.fetchMe);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setTokens(data.accessToken, data.refreshToken);
      await fetchMe();
      router.replace("/chats");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message ?? err.message ?? "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white font-bold text-lg">
            S
          </div>
          <h1 className="text-2xl font-bold">Вход в CraboGram</h1>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-cream-border rounded-lg focus:outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 border border-cream-border rounded-lg focus:outline-none focus:border-brand"
            />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
          >
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-brand-dark font-medium hover:underline">
            Создать
          </Link>
        </p>
      </div>
    </div>
  );
}
