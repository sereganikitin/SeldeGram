"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { api } from "@/lib/api";

interface BlockedUser {
  id: string;
  username: string;
  displayName: string;
  avatarKey?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function BlockListModal({ open, onClose }: Props) {
  const [users, setUsers] = useState<BlockedUser[]>([]);

  const load = useCallback(async () => {
    const { data } = await api.get<BlockedUser[]>("/me/blocks");
    setUsers(data);
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const unblock = async (id: string) => {
    try {
      await api.delete(`/me/blocks/${id}`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? "Не получилось");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Заблокированные" width="max-w-md">
      <div className="p-3">
        {users.length === 0 && (
          <div className="text-center text-ink-muted py-10">Никого не заблокировали</div>
        )}
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-cream dark:hover:bg-slate-800"
          >
            <Avatar id={u.id} name={u.displayName} avatarKey={u.avatarKey} size={40} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate dark:text-white">{u.displayName}</div>
              <div className="text-xs text-ink-muted">@{u.username}</div>
            </div>
            <button onClick={() => unblock(u.id)} className="text-brand-dark font-semibold text-sm">
              Разблок.
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
