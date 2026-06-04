"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  adminAccentButtonClass,
  adminImpersonationBannerClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
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
    <div className={adminImpersonationBannerClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#FF7E00]/90">Match Fit administrator</p>
          <p className="mt-1 font-semibold text-white">
            Viewing as {roleLabel}{" "}
            <span className="font-mono text-[#FFD34E]">@{props.username}</span>
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
          <button type="button" disabled={busy} onClick={() => void exit()} className={adminSecondaryButtonClass}>
            {busy ? "…" : "Exit to admin"}
          </button>
          <button type="button" disabled={busy} onClick={() => router.refresh()} className={adminAccentButtonClass}>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
