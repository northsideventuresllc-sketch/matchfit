"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type NotifRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  linkHref: string | null;
  read: boolean;
  createdAt: string;
  archivedAt: string | null;
};

type Box = "inbox" | "archive";

export function ClientNotificationsCenterClient() {
  const router = useRouter();
  const [box, setBox] = useState<Box>("inbox");
  const [items, setItems] = useState<NotifRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = useCallback(async (b: Box) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/notifications?box=${encodeURIComponent(b)}`);
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
    queueMicrotask(() => {
      void load("inbox");
    });
  }, [load]);

  function switchBox(next: Box) {
    if (next === box) return;
    setBox(next);
    setItems(null);
    setSelectedIds([]);
    void load(next);
  }

  const selectedInList = useMemo(() => {
    if (!items?.length || box !== "archive") return [];
    const idSet = new Set(items.map((i) => i.id));
    return selectedIds.filter((id) => idSet.has(id));
  }, [box, items, selectedIds]);

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

  async function archiveOne(n: NotifRow) {
    const res = await fetch(`/api/client/notifications/${encodeURIComponent(n.id)}/archive`, {
      method: "POST",
    });
    if (!res.ok) return;
    setItems((list) => list?.filter((x) => x.id !== n.id) ?? null);
    router.refresh();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllArchived() {
    if (!items?.length) return;
    setSelectedIds(items.map((i) => i.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function deleteArchivedOne(n: NotifRow) {
    if (!window.confirm("Permanently delete this notification?")) return;
    const res = await fetch(`/api/client/notifications/${encodeURIComponent(n.id)}`, { method: "DELETE" });
    if (!res.ok) return;
    setItems((list) => list?.filter((x) => x.id !== n.id) ?? null);
    setSelectedIds((prev) => prev.filter((id) => id !== n.id));
    router.refresh();
  }

  async function deleteSelectedArchived() {
    if (!selectedInList.length) return;
    if (
      !window.confirm(
        `Permanently delete ${selectedInList.length} notification${selectedInList.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    const res = await fetch("/api/client/notifications/archive/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedInList }),
    });
    if (!res.ok) return;
    setSelectedIds([]);
    await load("archive");
    router.refresh();
  }

  async function deleteAllArchived() {
    if (!items?.length) return;
    if (!window.confirm("Permanently delete all archived notifications? This cannot be undone.")) return;
    const res = await fetch("/api/client/notifications/archive", { method: "DELETE" });
    if (!res.ok) return;
    setSelectedIds([]);
    await load("archive");
    router.refresh();
  }

  const allSelected = Boolean(
    box === "archive" && items?.length && selectedInList.length === items.length,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-[#0E1016]/50 p-1.5">
        <button
          type="button"
          onClick={() => switchBox("inbox")}
          className={`rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] transition ${
            box === "inbox"
              ? "bg-[linear-gradient(135deg,rgba(255,211,78,0.2),rgba(255,126,0,0.18))] text-white"
              : "text-white/45 hover:text-white/75"
          }`}
        >
          Inbox
        </button>
        <button
          type="button"
          onClick={() => switchBox("archive")}
          className={`rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] transition ${
            box === "archive"
              ? "bg-[linear-gradient(135deg,rgba(255,211,78,0.2),rgba(255,126,0,0.18))] text-white"
              : "text-white/45 hover:text-white/75"
          }`}
        >
          Archive
        </button>
      </div>

      {box === "archive" && items && items.length > 0 ? (
        <div className="flex flex-col flex-wrap items-stretch justify-center gap-2 sm:flex-row sm:items-center sm:justify-center">
          <button
            type="button"
            onClick={() => (allSelected ? clearSelection() : selectAllArchived())}
            className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-white/80 transition hover:border-white/25"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <button
            type="button"
            disabled={!selectedInList.length}
            onClick={() => void deleteSelectedArchived()}
            className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-white/80 transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete selected{selectedInList.length ? ` (${selectedInList.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => void deleteAllArchived()}
            className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#FFB4B4] transition hover:border-[#E32B2B]/55"
          >
            Delete all
          </button>
        </div>
      ) : null}

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
              {box === "archive" ? (
                <label className="mt-0.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-white/[0.04]">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(n.id)}
                    onChange={() => toggleSelect(n.id)}
                    className="h-4 w-4 accent-[#FF7E00]"
                    aria-label={`Select ${n.title}`}
                  />
                </label>
              ) : null}
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
                      {n.archivedAt ? (
                        <>
                          {" · "}
                          Archived {new Date(n.archivedAt).toLocaleDateString()}
                        </>
                      ) : null}
                    </p>
                  </Link>
                ) : (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/90">{n.title}</p>
                    <p className="mt-1 text-sm leading-snug text-white/55">{n.body}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wide text-white/30">
                      {new Date(n.createdAt).toLocaleString()}
                      {n.archivedAt ? (
                        <>
                          {" · "}
                          Archived {new Date(n.archivedAt).toLocaleDateString()}
                        </>
                      ) : null}
                    </p>
                  </div>
                )}
              </div>
              {box === "inbox" ? (
                <button
                  type="button"
                  title="Archive"
                  onClick={() => void archiveOne(n)}
                  className="mt-0.5 shrink-0 self-start rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/60 transition hover:border-white/25 hover:text-white/85"
                >
                  Archive
                </button>
              ) : (
                <button
                  type="button"
                  title="Delete permanently"
                  onClick={() => void deleteArchivedOne(n)}
                  className="mt-0.5 shrink-0 self-start rounded-xl border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#FFB4B4] transition hover:border-[#E32B2B]/50"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/40 px-4 py-10 text-center text-sm text-white/45">
          {box === "archive" ? "No archived notifications." : "No notifications yet."}
        </p>
      )}
    </div>
  );
}
