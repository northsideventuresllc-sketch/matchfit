"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminPortalBackgroundLayers, adminPortalMainClass } from "@/components/admin/admin-portal-styles";
import { MATCH_FIT_SUPPORT_MAILTO } from "@/lib/match-fit-support-contact";

export default function AdminAccountLockedPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.replace("/admin/login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={adminPortalMainClass}>
      <div aria-hidden className={adminPortalBackgroundLayers.warmGlow} />
      <div aria-hidden className={adminPortalBackgroundLayers.vignette} />
      <div className="relative z-10 mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center px-5 py-16 text-center sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400/90">Account status</p>
        <h1 className="mt-3 text-3xl font-black uppercase tracking-[0.06em] text-white">Locked for security</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/55">
          A password change on this administrator account was reported as not made by you. Access is paused until
          another administrator clears the lock.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href={MATCH_FIT_SUPPORT_MAILTO.accountAccess}
            className="inline-flex min-h-[3rem] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-6 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F]"
          >
            Contact Support
          </a>
          <button
            type="button"
            disabled={busy}
            onClick={() => void logout()}
            className="inline-flex min-h-[3rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-6 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 disabled:opacity-50"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </main>
  );
}
