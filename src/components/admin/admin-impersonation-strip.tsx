"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";

export type AdminImpersonationStripProps = {
  portalRole: "client" | "trainer";
  username: string;
  testMode: boolean;
};

export function AdminImpersonationStrip(props: AdminImpersonationStripProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function exit() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/stop-impersonate", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as { next?: string } | null;
      if (!res.ok) {
        setBusy(false);
        return;
      }
      navigateWithFullLoad(data?.next ?? "/admin");
    } catch {
      setBusy(false);
    }
  }

  const roleLabel = props.portalRole === "client" ? "client" : "trainer";

  return (
    <div className="mb-6 rounded-2xl border border-cyan-400/35 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50 shadow-[0_12px_40px_-24px_rgba(34,211,238,0.5)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200/90">Match Fit administrator</p>
          <p className="mt-1 font-semibold text-white">
            Viewing as {roleLabel}{" "}
            <span className="font-mono text-cyan-100">@{props.username}</span>
            {props.testMode ? (
              <span className="ml-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-100">
                Test mode
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/55">
            Federal Tax ID / SSN values are hidden during impersonation. Exit before using your personal Match Fit session.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void exit()}
            className="rounded-xl border border-white/20 bg-white/[0.06] px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.1] disabled:opacity-50"
          >
            {busy ? "…" : "Exit to admin"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => router.refresh()}
            className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-cyan-50 transition hover:bg-cyan-500/15 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
