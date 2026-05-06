"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SafetyBlockMode } from "@/lib/safety-block-modes";

export function TrainerProfileClientPrivacyMenu(props: { trainerUsername: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const runBlock = useCallback(
    async (blockMode: SafetyBlockMode) => {
      setBusy(true);
      setMsg(null);
      try {
        const res = await fetch("/api/safety/block", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUsername: props.trainerUsername,
            targetIsTrainer: true,
            blockMode,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setMsg(data.error ?? "Could not update.");
          return;
        }
        setMsg("Preference saved.");
        setOpen(false);
      } catch {
        setMsg("Network error.");
      } finally {
        setBusy(false);
      }
    },
    [props.trainerUsername],
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-white/[0.08] px-2 py-1 text-sm font-semibold leading-none text-white/40 transition hover:border-white/15 hover:text-white/70 disabled:opacity-40"
        aria-expanded={open}
        aria-haspopup="true"
        title="Privacy"
      >
        ···
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-56 rounded-xl border border-white/10 bg-[#12151C] py-1 text-left shadow-xl">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Feed & chat</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runBlock("fithub_only")}
            className="block w-full px-3 py-2 text-left text-xs text-white/75 hover:bg-white/[0.05] disabled:opacity-40"
          >
            Hide in FitHub
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runBlock("match_feed_only")}
            className="block w-full px-3 py-2 text-left text-xs text-white/75 hover:bg-white/[0.05] disabled:opacity-40"
          >
            Hide in match browse
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runBlock("chat_only")}
            className="block w-full px-3 py-2 text-left text-xs text-white/75 hover:bg-white/[0.05] disabled:opacity-40"
          >
            Block messages
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runBlock("full")}
            className="block w-full px-3 py-2 text-left text-xs text-white/75 hover:bg-white/[0.05] disabled:opacity-40"
          >
            All of the above
          </button>
          <p className="border-t border-white/[0.06] px-3 py-2 text-[10px] leading-relaxed text-white/35">
            Manage or undo anytime in Settings → Privacy.
          </p>
        </div>
      ) : null}
      {msg ? <p className="absolute right-0 top-full z-20 mt-1 max-w-[14rem] text-[10px] text-white/50">{msg}</p> : null}
    </div>
  );
}
