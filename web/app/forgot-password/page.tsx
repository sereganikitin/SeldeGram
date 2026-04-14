"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";

type Step = "request" | "reset";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const setTokens = useAuth((s) => s.setTokens);
  const fetchMe = useAuth((s) => s.fetchMe);

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setInfo("Если такой email зарегистрирован, мы отправили на него 6-значный код. Проверьте почту.");
      setStep("reset");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string | string[] } }; message?: string };
      const msg = err.response?.data?.message ?? err.message ?? "Ошибка";
      setError(Array.isArray(msg) ? msg.join("\n") : String(msg));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/reset-password", { email, code, newPassword });
      setTokens(data.accessToken, data.refreshToken);
      await fetchMe();
      router.replace("/chats");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string | string[] } }; message?: string };
      const msg = err.response?.data?.message ?? err.message ?? "Ошибка";
      setError(Array.isArray(msg) ? msg.join("\n") : String(msg));
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
          <h1 className="text-2xl font-bold">Восстановление пароля</h1>
        </div>

        {step === "request" ? (
          <form onSubmit={requestCode} className="space-y-4">
            <p className="text-sm text-ink-muted">
              Укажите email вашего аккаунта — мы пришлём 6-значный код для сброса пароля.
            </p>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 border border-cream-border rounded-lg focus:outline-none focus:border-brand"
              />
            </div>
            {error && <div className="text-red-600 text-sm whitespace-pre-line">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
            >
              {loading ? "Отправляем..." : "Отправить код"}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="space-y-4">
            {info && <div className="text-sm text-ink-muted bg-cream-border/30 rounded-lg p-3">{info}</div>}
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
              <label className="block text-sm font-medium text-ink mb-1">Код из письма</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                minLength={6}
                maxLength={6}
                inputMode="numeric"
                autoFocus
                className="w-full px-4 py-3 border border-cream-border rounded-lg focus:outline-none focus:border-brand tracking-widest text-center"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Новый пароль (от 8 символов)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 border border-cream-border rounded-lg focus:outline-none focus:border-brand"
              />
            </div>
            {error && <div className="text-red-600 text-sm whitespace-pre-line">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
            >
              {loading ? "Сохраняем..." : "Сменить пароль"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("request");
                setError(null);
                setInfo(null);
              }}
              className="w-full text-sm text-ink-muted hover:text-ink"
            >
              Отправить код ещё раз
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-ink-muted">
          Вспомнили пароль?{" "}
          <Link href="/login" className="text-brand-dark font-medium hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
