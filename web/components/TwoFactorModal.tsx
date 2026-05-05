"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { ShieldCheck, ShieldOff } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function TwoFactorModal({ open, onClose }: Props) {
  const me = useAuth((s) => s.user);
  const fetchMe = useAuth((s) => s.fetchMe);
  const enabled = !!me?.totpEnabled;
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSecret(null);
      setOtpauth(null);
      setCode("");
      setError(null);
    }
  }, [open]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<{ secret: string; otpauth: string }>("/auth/2fa/start");
      setSecret(data.secret);
      setOtpauth(data.otpauth);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/2fa/confirm", { code });
      await fetchMe();
      onClose();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? "Неверный код");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/2fa/disable", { code });
      await fetchMe();
      onClose();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? "Неверный код");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Двухфакторная аутентификация" width="max-w-md">
      <div className="p-5 space-y-4">
        {!enabled && !secret && (
          <>
            <p className="text-sm text-ink-muted">
              Включите 2FA, и при входе будет нужен 6-значный код из приложения вроде Google Authenticator, Authy или 1Password.
            </p>
            <button
              onClick={start}
              disabled={busy}
              className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <ShieldCheck size={18} /> Начать настройку
            </button>
          </>
        )}

        {!enabled && secret && otpauth && (
          <>
            <p className="text-sm text-ink-muted">
              Откройте приложение-аутентификатор и отсканируйте QR-код или введите секрет вручную.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauth)}`}
              alt="QR"
              className="mx-auto rounded-lg border border-cream-border"
            />
            <div className="bg-cream-alt rounded-lg px-3 py-2 text-center font-mono text-sm break-all">
              {secret}
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s+/g, ""))}
              placeholder="Код из приложения"
              maxLength={8}
              className="w-full px-4 py-3 border border-cream-border rounded-lg focus:outline-none focus:border-brand text-center tracking-widest font-mono text-lg"
            />
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button
              onClick={confirm}
              disabled={busy || code.length < 6}
              className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold py-3 rounded-lg"
            >
              Подтвердить и включить
            </button>
          </>
        )}

        {enabled && (
          <>
            <p className="text-sm text-ink-muted">
              2FA включена. Чтобы отключить, введите текущий код из приложения.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s+/g, ""))}
              placeholder="Код из приложения"
              maxLength={8}
              className="w-full px-4 py-3 border border-cream-border rounded-lg focus:outline-none focus:border-brand text-center tracking-widest font-mono text-lg"
            />
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button
              onClick={disable}
              disabled={busy || code.length < 6}
              className="w-full bg-red-50 text-red-600 hover:bg-red-100 font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <ShieldOff size={18} /> Отключить 2FA
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
