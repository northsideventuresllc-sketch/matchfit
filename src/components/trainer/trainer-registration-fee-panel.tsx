"use client";

import { useEffect, useState } from "react";
import {
  TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE,
  TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS,
  TRAINER_SIGNUP_PREMIUM_PROMO_DAYS,
  trainerStandardOnboardingAfterCapLabel,
} from "@/lib/trainer-signup-promo-copy";

type Summary = {
  hasPaidRegistrationFee: boolean;
  signupFeeOnHold?: boolean;
  registrationFeeHoldStatus?: string;
  foundingPricing: boolean;
  backgroundCheckPaidCents: number;
  canPay: boolean;
  dueCents: number;
  dueError: string | null;
  pricingMode: string;
};

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function TrainerRegistrationFeePanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trainer/billing/registration-summary", { credentials: "include" });
        const data = (await res.json()) as Summary & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load onboarding payment.");
          setSummary(null);
          return;
        }
        setSummary(data);
      } catch {
        if (!cancelled) setError("Network error loading onboarding payment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trainer/billing/registration-checkout", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error starting checkout.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-white/50">Loading onboarding payment…</p>;
  }

  if (!summary) {
    return error ? <p className="text-sm text-rose-200/90">{error}</p> : null;
  }

  if (summary.signupFeeOnHold && summary.registrationFeeHoldStatus === "HELD") {
    return (
      <p className="text-sm text-emerald-200/90">
        Your background check payment is on hold. Match Fit captures it when Checkr screening runs. During the founding
        coach promo you pay only your background check through our portal.
      </p>
    );
  }

  if (summary.hasPaidRegistrationFee) {
    return (
      <p className="text-sm text-emerald-200/90">
        Onboarding payment complete. Thank you — your compliance record is up to date for billing.
      </p>
    );
  }

  const bgLabel = formatUsd(summary.backgroundCheckPaidCents);

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-white/65">
        {summary.foundingPricing ? (
          <>
            Founding coach promo: pay your verified background check amount ({bgLabel} to Checkr) through our portal plus
            an estimated card processing fee. You receive {TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days of Match Fit Premium Pro
            at sign-up. Begin onboarding within {TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} days of sign-up.{" "}
            {TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE}
          </>
        ) : (
          <>
            Standard pricing: onboarding fees as shown at checkout ({trainerStandardOnboardingAfterCapLabel()}).
          </>
        )}
      </p>
      {summary.dueCents > 0 ? (
        <p className="text-sm text-white/80">
          Amount due now: <span className="font-semibold text-[#FFD34E]">{formatUsd(summary.dueCents)}</span> (before
          processing at checkout).
        </p>
      ) : null}
      {summary.dueError ? <p className="text-sm text-amber-200/90">{summary.dueError}</p> : null}
      {error ? <p className="text-sm text-rose-200/90">{error}</p> : null}
      {summary.canPay ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void startCheckout()}
          className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/15 px-5 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/60 disabled:opacity-50"
        >
          {busy ? "Starting checkout…" : "Pay at checkout"}
        </button>
      ) : (
        <p className="text-xs text-white/45">
          Complete background check and certification approval before completing onboarding payment.
        </p>
      )}
    </div>
  );
}
