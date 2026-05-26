"use client";

import Link from "next/link";
import { useState } from "react";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/account-deletion-grace-constants";

type Props = {
  role: "client" | "trainer";
  finalizeAtIso: string;
};

export function AccountDeletionScheduledPanel({ role, finalizeAtIso }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const finalizeAt = new Date(finalizeAtIso);
  const cancelPath =
    role === "client"
      ? "/api/client/settings/account/cancel-deletion"
      : "/api/trainer/settings/account/cancel-deletion";
  const homeHref = role === "client" ? "/client/dashboard" : "/trainer/dashboard";

  async function cancelDeletion() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(cancelPath, { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not cancel scheduled deletion.");
        return;
      }
      window.location.href = homeHref;
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-6 sm:p-8">
        <h1 className="text-xl font-black tracking-tight">Account deletion scheduled</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/65">
          You asked to delete your Match Fit account. Your profile is hidden from discovery and dashboard access is
          paused until permanent removal on{" "}
          <span className="font-semibold text-white/85">{finalizeAt.toLocaleString()}</span> (about{" "}
          {ACCOUNT_DELETION_GRACE_DAYS} days from your request).
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          Sign in during this window and tap <span className="font-semibold text-white/75">Keep my account</span> below to
          cancel deletion and restore full access. If you do nothing, we permanently remove personal data after the date
          above.
        </p>
        {err ? (
          <p className="mt-4 rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-2 text-sm text-[#FFB4B4]" role="alert">
            {err}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => void cancelDeletion()}
            className="rounded-xl bg-[#FF7E00] px-5 py-3 text-sm font-bold text-[#0B0C0F] transition hover:bg-[#FFD34E] disabled:opacity-50"
          >
            {busy ? "Restoring…" : "Keep my account"}
          </button>
          <Link
            href={role === "client" ? "/client" : "/trainer/dashboard/login"}
            className="rounded-xl border border-white/15 px-5 py-3 text-center text-sm font-semibold text-white/80 hover:bg-white/5"
          >
            Sign out
          </Link>
        </div>
        <p className="mt-6 text-xs text-white/40">
          See our{" "}
          <Link href="/privacy" className="text-[#FF7E00] underline-offset-2 hover:underline">
            Privacy Policy
          </Link>{" "}
          for how deletion and retention work.
        </p>
      </div>
    </main>
  );
}
