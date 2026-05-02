"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FitHubStudioActivityKind } from "@/lib/trainer-fithub-studio-activity";

type Item = {
  id: string;
  kind: FitHubStudioActivityKind;
  createdAt: string;
  postId: string;
  postPreview: string | null;
  actorLabel: string;
  body?: string;
  read: boolean;
};

const FILTER_OPTIONS: { value: "ALL" | FitHubStudioActivityKind; label: string }[] = [
  { value: "ALL", label: "All Activity" },
  { value: "LIKE", label: "Likes Only" },
  { value: "COMMENT", label: "Comments Only" },
  { value: "REPOST", label: "Reposts Only" },
  { value: "SHARE", label: "Shares Only" },
];

function kindLabel(k: FitHubStudioActivityKind): string {
  switch (k) {
    case "LIKE":
      return "LIKE";
    case "COMMENT":
      return "COMMENT";
    case "REPOST":
      return "REPOST";
    case "SHARE":
      return "SHARE";
    default:
      return k;
  }
}

export function TrainerFitHubStudioNotifications() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"ALL" | FitHubStudioActivityKind>("ALL");
  const [items, setItems] = useState<Item[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [markBusy, setMarkBusy] = useState(false);
  const [markItemBusyId, setMarkItemBusyId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (f: "ALL" | FitHubStudioActivityKind) => {
    setLoading(true);
    setErr(null);
    try {
      const q = f === "ALL" ? "" : `?filter=${encodeURIComponent(f)}`;
      const res = await fetch(`/api/trainer/fithub/studio-activity${q}`, { cache: "no-store" });
      const j = (await res.json()) as { items?: Item[]; unseenCount?: number; error?: string };
      // Backward compat if API omits `read`
      const rawItems = j.items ?? [];
      const normalized = rawItems.map((x) => ({ ...x, read: Boolean((x as Item).read) }));
      if (!res.ok) {
        setErr(j.error ?? "Could not load.");
        return;
      }
      setItems(normalized);
      setUnseenCount(typeof j.unseenCount === "number" ? j.unseenCount : 0);
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load(filter);
  }, [open, filter, load]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function markCaughtUp() {
    setMarkBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/trainer/fithub/studio-activity/mark-seen", { method: "POST" });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setErr(j.error ?? "Could not update.");
        return;
      }
      setUnseenCount(0);
      await load(filter);
    } catch {
      setErr("Network error.");
    } finally {
      setMarkBusy(false);
    }
  }

  async function markItemsRead(ids: string[]) {
    if (!ids.length) return;
    const snapshot = items;
    setItems((prev) => prev.map((x) => (ids.includes(x.id) ? { ...x, read: true } : x)));
    setMarkItemBusyId(ids[0] ?? null);
    setErr(null);
    try {
      const res = await fetch("/api/trainer/fithub/studio-activity/mark-items-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: ids }),
      });
      const j = (await res.json()) as { unseenCount?: number; error?: string };
      if (!res.ok) {
        setItems(snapshot);
        setErr(j.error ?? "Could not update.");
        return;
      }
      if (typeof j.unseenCount === "number") setUnseenCount(j.unseenCount);
    } catch {
      setItems(snapshot);
      setErr("Network error.");
    } finally {
      setMarkItemBusyId(null);
    }
  }

  const badge =
    unseenCount > 0 ? (
      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E32B2B] px-1 text-[10px] font-black text-white">
        {unseenCount > 99 ? "99+" : unseenCount}
      </span>
    ) : null;

  return (
    <div ref={wrapRef} className="relative mx-auto w-full max-w-xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex w-full items-center justify-between gap-3 rounded-2xl border border-[#FF7E00]/35 bg-[#FF7E00]/[0.08] px-4 py-3 text-left transition hover:border-[#FF7E00]/50"
        aria-expanded={open}
      >
        <span>
          <span className="block text-xs font-black uppercase tracking-[0.18em] text-[#FF7E00]/95">FitHub notifications</span>
          <span className="mt-0.5 block text-[11px] text-white/45">Likes, comments, reposts, and shares on your posts</span>
        </span>
        <span className="text-xs font-black uppercase tracking-wide text-white/50">{open ? "Close" : "Open"}</span>
        {badge}
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-[60] mt-2 max-h-[min(70vh,28rem)] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0E1016] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-3 py-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-white/40">
              Filter
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as "ALL" | FitHubStudioActivityKind)}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#12151C] px-2 py-1.5 text-xs font-semibold text-white"
              >
                {FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={markBusy}
              onClick={() => void markCaughtUp()}
              className="shrink-0 rounded-lg border border-white/15 px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-white/80 transition hover:bg-white/[0.06] disabled:opacity-40"
            >
              Mark caught up
            </button>
          </div>

          <div className="max-h-[min(60vh,22rem)] overflow-y-auto px-3 py-2">
            {err ? <p className="py-4 text-center text-sm text-[#FFB4B4]">{err}</p> : null}
            {loading && !items.length ? <p className="py-8 text-center text-sm text-white/45">Loading…</p> : null}
            {!loading && !items.length && !err ? (
              <p className="py-8 text-center text-sm text-white/45">No activity yet for this filter.</p>
            ) : null}
            <ul className="space-y-2 pb-2">
              {items.map((it) => (
                <li
                  key={it.id}
                  className={`rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 ${it.read ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <label
                      className="mt-0.5 flex cursor-pointer select-none items-center"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={it.read}
                        disabled={it.read || markItemBusyId === it.id}
                        onChange={() => {
                          if (it.read) return;
                          void markItemsRead([it.id]);
                        }}
                        className="h-4 w-4 shrink-0 rounded border-white/25 bg-[#12151C] text-[#FF7E00] focus:ring-[#FF7E00]/40"
                        aria-label={it.read ? "Read" : "Mark as read"}
                      />
                    </label>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wide text-[#FF7E00]/90">{kindLabel(it.kind)}</span>
                        <span className="text-[10px] text-white/35">{new Date(it.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-white/85">{it.actorLabel}</p>
                      {it.body ? <p className="mt-1 text-xs text-white/60 line-clamp-3">{it.body}</p> : null}
                      <p className="mt-1 text-[10px] text-white/40 line-clamp-2">
                        Post: {it.postPreview?.trim() ? it.postPreview : "(no caption)"}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
