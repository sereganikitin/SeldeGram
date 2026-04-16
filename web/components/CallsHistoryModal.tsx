"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { useCall } from "@/lib/call";
import { formatTime } from "@/lib/helpers";

interface CallPeer {
  id: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
}

interface CallRecord {
  id: string;
  callerId: string;
  calleeId: string;
  kind: "audio" | "video";
  status: "ringing" | "accepted" | "rejected" | "missed" | "ended";
  startedAt: string;
  acceptedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  caller: CallPeer;
  callee: CallPeer;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function statusLabel(r: CallRecord, isIncoming: boolean): string {
  if (r.status === "ended" && r.durationSec != null) return formatDuration(r.durationSec);
  if (r.status === "missed") return isIncoming ? "Пропущенный" : "Нет ответа";
  if (r.status === "rejected") return isIncoming ? "Отклонён" : "Отклонён";
  if (r.status === "ringing") return "В процессе";
  return "Завершён";
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CallsHistoryModal({ open, onClose }: Props) {
  const meId = useAuth((s) => s.user?.id);
  const [items, setItems] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CallRecord[]>("/calls");
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const callBack = (peer: CallPeer) => {
    useCall.getState().initiate(peer, "audio");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="История звонков" width="max-w-md">
      <div className="p-3 max-h-[60vh] overflow-y-auto">
        {loading && <div className="text-center text-ink-muted py-10">Загрузка...</div>}
        {!loading && items.length === 0 && (
          <div className="text-center text-ink-muted py-10">Звонков ещё не было</div>
        )}
        {items.map((r) => {
          const isIncoming = r.calleeId === meId;
          const peer = isIncoming ? r.caller : r.callee;
          const isMissed = isIncoming && (r.status === "missed" || r.status === "rejected");
          return (
            <div
              key={r.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-cream dark:hover:bg-slate-800"
            >
              <Avatar id={peer.id} name={peer.displayName} avatarKey={peer.avatarKey} size={40} />
              <div className="flex-1 min-w-0">
                <div className={`font-semibold truncate ${isMissed ? "text-red-600" : "dark:text-white"}`}>
                  {peer.displayName}
                </div>
                <div className="text-xs text-ink-muted">
                  {isIncoming ? "↙ " : "↗ "}
                  {statusLabel(r, isIncoming)} · {formatTime(r.startedAt)}
                </div>
              </div>
              <button
                onClick={() => callBack(peer)}
                className="text-brand-dark text-xl px-2"
                title="Позвонить"
              >
                📞
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
