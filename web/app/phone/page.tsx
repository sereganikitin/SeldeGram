"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";

type Step = "phone" | "code" | "register";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("8") && digits.length === 11) return "+7" + digits.slice(1);
  if (digits.startsWith("7") && digits.length === 11) return "+" + digits;
  if (digits.length === 10) return "+7" + digits;
  return digits ? `+${digits}` : "";
}

export default function PhonePage() {
  const router = useRouter();
  const setTokens = useAuth((s) => s.setTokens);
  const fetchMe = useAuth((s) => s.fetchMe);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const requestCode = async () => {
    setError(null);
    setLoading(true);
    try {
      const normalized = normalizePhone(phone);
      if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
        throw new Error("Введите номер в формате +7XXXXXXXXXX");
      }
      const { data } = await api.post<{
        ok: boolean;
        needsRegistration: boolean;
        resendAfterSec: number;
      }>("/auth/phone/request-code", { phone: normalized });
      setPhone(normalized);
      setNeedsRegistration(data.needsRegistration);
      setResendIn(data.resendAfterSec);
      setStep("code");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message ?? err.message ?? "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setError(null);
    if (needsRegistration && step !== "register") {
      setStep("register");
      return;
    }
    setLoading(true);
    try {
      const payload: {
        phone: string;
        code: string;
        username?: string;
        displayName?: string;
      } = { phone, code };
      if (needsRegistration) {
        payload.username = username;
        payload.displayName = displayName;
      }
      const { data } = await api.post("/auth/phone/verify", payload);
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-bold text-lg">
            C
          </div>
          <h1 className="text-2xl font-bold">CraboGram</h1>
        </div>

        {step === "phone" && (
          <>
            <p className="text-sm text-ink-muted mb-4">
              Введи номер телефона — пришлём код для входа.
            </p>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && requestCode()}
              placeholder="+7 999 123 45 67"
              autoFocus
              className="w-full px-4 py-3 border border-cream-border rounded-lg focus:outline-none focus:border-brand text-lg"
            />
            {error && <div className="text-red-600 text-sm mt-3">{error}</div>}
            <button
              onClick={requestCode}
              disabled={loading || !phone.trim()}
              className="mt-4 w-full bg-gradient-to-br from-brand to-brand-dark hover:from-brand-dark hover:to-brand-dark disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
            >
              {loading ? "Отправляем..." : "Прислать код"}
            </button>
          </>
        )}

        {step === "code" && (
          <>
            <p className="text-sm text-ink-muted mb-4">
              Код отправлен на <strong>{phone}</strong>.{" "}
              <button onClick={() => setStep("phone")} className="text-brand-dark hover:underline">
                изменить
              </button>
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && verify()}
              placeholder="••••••"
              autoFocus
              maxLength={6}
              className="w-full px-4 py-3 border border-cream-border rounded-lg focus:outline-none focus:border-brand text-center tracking-[0.5em] font-mono text-2xl"
            />
            {error && <div className="text-red-600 text-sm mt-3">{error}</div>}
            <button
              onClick={verify}
              disabled={loading || code.length !== 6}
              className="mt-4 w-full bg-gradient-to-br from-brand to-brand-dark hover:from-brand-dark hover:to-brand-dark disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
            >
              {loading ? "Проверяем..." : needsRegistration ? "Дальше" : "Войти"}
            </button>
            <button
              onClick={requestCode}
              disabled={resendIn > 0 || loading}
              className="mt-3 w-full text-sm text-ink-muted hover:text-brand-dark disabled:opacity-50"
            >
              {resendIn > 0 ? `Прислать заново через ${resendIn}с` : "Прислать заново"}
            </button>
          </>
        )}

        {step === "register" && (
          <>
            <p className="text-sm text-ink-muted mb-4">
              Этот номер ещё не зарегистрирован. Заполни профиль:
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Как тебя зовут"
                autoFocus
                className="w-full px-4 py-3 border border-cream-border rounded-lg focus:outline-none focus:border-brand"
              />
              <input
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())
                }
                placeholder="username (латиница)"
                className="w-full px-4 py-3 border border-cream-border rounded-lg focus:outline-none focus:border-brand"
              />
            </div>
            {error && <div className="text-red-600 text-sm mt-3">{error}</div>}
            <button
              onClick={verify}
              disabled={loading || !username.trim() || !displayName.trim() || username.length < 3}
              className="mt-4 w-full bg-gradient-to-br from-brand to-brand-dark hover:from-brand-dark hover:to-brand-dark disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
            >
              {loading ? "Создаём аккаунт..." : "Создать аккаунт"}
            </button>
          </>
        )}

        <p className="mt-6 text-center text-sm text-ink-muted">
          Или{" "}
          <Link href="/login" className="text-brand-dark font-medium hover:underline">
            войти по email
          </Link>
        </p>
      </div>
    </div>
  );
}
