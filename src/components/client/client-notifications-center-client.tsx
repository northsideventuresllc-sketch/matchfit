"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type NotifRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  linkHref: string | null;
  read: boolean;
  createdAt: string;
};

export function ClientNotificationsCenterClient() {
  const router = useRouter();
  const [items, setItems] = useState<NotifRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/client/notifications");
      const data = (await res.json()) as { notifications?: NotifRow[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load notifications.");
        return;
      }
      setItems(data.notifications ?? []);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function toggleRead(n: NotifRow) {
    const nextRead = !n.read;
    const res = await fetch(`/api/client/notifications/${encodeURIComponent(n.id)}/read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: nextRead }),
    });
    if (res.ok) {
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, read: nextRead } : x)) ?? null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}

      {busy && !items ? (
        <p className="py-10 text-center text-sm text-white/45">Loading…</p>
      ) : items && items.length ? (
        <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#0E1016]/50">
          {items.map((n) => (
            <li key={n.id} className="flex gap-3 px-4 py-4">
              <button
                type="button"
                title={n.read ? "Mark unread" : "Mark read"}
                onClick={() => void toggleRead(n)}
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-black transition ${
                  n.read
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                    : "border-white/15 bg-white/[0.04] text-white/35 hover:border-[#FF7E00]/35"
                }`}
              >
                {n.read ? "✓" : ""}
              </button>
              <div className="min-w-0 flex-1">
                {n.linkHref ? (
                  <Link href={n.linkHref} className="block text-left">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/90">{n.title}</p>
                    <p className="mt-1 text-sm leading-snug text-white/55">{n.body}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wide text-white/30">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </Link>
                ) : (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/90">{n.title}</p>
                    <p className="mt-1 text-sm leading-snug text-white/55">{n.body}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wide text-white/30">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/40 px-4 py-10 text-center text-sm text-white/45">
          No notifications yet.
        </p>
      )}
    </div>
  );
}
