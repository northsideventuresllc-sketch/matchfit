"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ClientAccountSuspendedPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/client/logout", { method: "POST" });
      router.replace("/client");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#07080C] px-5 py-16 text-white sm:px-8">
      <div className="mx-auto max-w-lg space-y-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Account status</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em]">Suspended</h1>
        <p className="text-sm leading-relaxed text-white/55">
          A safety report was filed against your client account. Access is paused until a Match Fit representative
          completes a manual review and lifts the suspension from our internal tools.
        </p>
        <p className="text-xs leading-relaxed text-white/40">
          Suspension events remain on file for five years after they are closed, then they are purged automatically for
          data retention.
        </p>
        <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-center">
          <button
            type="button"
            disabled={busy}
            onClick={() => void logout()}
            className="inline-flex min-h-[3rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-6 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 disabled:opacity-50"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
          <Link
            href="/"
            className="inline-flex min-h-[3rem] items-center justify-center rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/10 px-6 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/50"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
