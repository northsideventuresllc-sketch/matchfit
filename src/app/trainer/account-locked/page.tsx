"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MATCH_FIT_SUPPORT_MAILTO } from "@/lib/match-fit-support-contact";

export default function TrainerAccountLockedPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/trainer/logout", { method: "POST" });
      router.replace("/trainer/dashboard/login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#07080C] px-5 py-16 text-white sm:px-8">
      <div className="mx-auto max-w-lg space-y-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400/90">Account status</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em]">Locked for security</h1>
        <p className="text-sm leading-relaxed text-white/55">
          A password change on this account was reported as not made by you. Access is paused so nobody — including
          whoever made the change — can use the account while we sort this out with you.
        </p>
        <p className="text-sm leading-relaxed text-white/55">Contact support to get it unlocked and secured.</p>
        <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-center">
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
