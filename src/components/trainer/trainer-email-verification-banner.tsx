"use client";

import { useState } from "react";

type Props = {
  /** Shown so they can spot a typo without digging through settings. */
  email: string;
};

/**
 * Dashboard prompt to confirm an unproven email address.
 *
 * Sign-up sends people straight to the Fitness Pro agreement rather than a check-your-inbox
 * screen (JB, 2026-08-04), so this is where confirmation happens. Rendered only while the
 * address is still unconfirmed.
 */
export function TrainerEmailVerificationBanner({ email }: Props) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function sendEmail() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/trainer/dashboard/verify-email/resend", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; alreadyVerified?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Could not send the confirmation email.");
        return;
      }
      if (data.alreadyVerified) {
        setDone(true);
        setNotice("Your email is already confirmed. Refreshing…");
        window.location.reload();
        return;
      }
      setNotice("Confirmation email sent. Check your inbox and spam folder.");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return null;

  return (
    <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
      <p className="font-semibold text-amber-50">Confirm your email address</p>
      <p className="mt-1 text-amber-100/85">
        We sent a confirmation link to <span className="font-semibold text-amber-50">{email}</span>. Confirming keeps
        your account secure and makes sure booking and payout emails reach you.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void sendEmail()}
        className="mt-3 inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-white/35 disabled:opacity-45"
      >
        {busy ? "Sending…" : "Send Confirmation Email"}
      </button>
      {notice ? <p className="mt-2 text-sm text-emerald-200/90">{notice}</p> : null}
      {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
