"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  kind: "premium_choice" | "payment_required";
  tierLabel: string;
  daysLeft: number;
  expired: boolean;
};

function windowText(daysLeft: number, expired: boolean): string {
  if (expired) return "Your free trial has ended.";
  if (daysLeft <= 1) return "Your free trial ends today.";
  return `Your free trial ends in ${daysLeft} days.`;
}

/**
 * End-of-trial prompt.
 *
 * Premium Pro can decline and keep a working Match Fit Pro account — declining is a real,
 * equally prominent choice here, not a link buried under a payment button.
 */
export function TrainerTrialEndBanner({ kind, tierLabel, daysLeft, expired }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  async function declinePremium() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trainer/dashboard/decline-premium", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not update your account type.");
        return;
      }
      setDismissed(true);
      window.location.reload();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (dismissed) return null;

  return (
    <div className="rounded-xl border border-[#FFD34E]/30 bg-[#FFD34E]/10 px-4 py-3 text-sm text-[#FFF4D0]">
      <p className="font-semibold text-white">
        {windowText(daysLeft, expired)} {tierLabel}
      </p>
      {kind === "premium_choice" ? (
        <>
          <p className="mt-1 text-[#FFF4D0]/85">
            Keep your premium perks by starting a subscription, or continue on a free Match Fit Pro account. Your
            clients, bookings and profile stay exactly as they are either way.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/trainer/dashboard/account-tier"
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-5 text-xs font-black uppercase tracking-[0.1em] text-[#0B0C0F]"
            >
              Keep Premium Perks
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => void declinePremium()}
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-white/35 disabled:opacity-45"
            >
              {busy ? "Saving…" : "No Thanks"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-[#FFF4D0]/85">
            {tierLabel} needs an active subscription to continue. Set up payment to keep your account features
            available.
          </p>
          <Link
            href="/trainer/dashboard/account-tier"
            className="mt-3 inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-5 text-xs font-black uppercase tracking-[0.1em] text-[#0B0C0F]"
          >
            Set Up Payment
          </Link>
        </>
      )}
      {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
