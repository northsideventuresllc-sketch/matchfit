"use client";

import { useEffect, useState } from "react";
import {
  computeStandardTrainerRegistrationBreakdown,
  formatTrainerRegistrationUsd,
} from "@/lib/trainer-registration-fee";

type Summary = {
  hasPaidRegistrationFee: boolean;
  foundingPricing: boolean;
  backgroundCheckPaidCents: number;
  canPay: boolean;
  dueCents: number;
  dueError: string | null;
  pricingMode: string;
};

function formatUsd(cents: number): string {
  return formatTrainerRegistrationUsd(cents);
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
          setError(data.error ?? "Could not load registration billing.");
          setSummary(null);
          return;
        }
        setSummary(data);
      } catch {
        if (!cancelled) setError("Network error loading registration billing.");
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
    return <p className="text-sm text-white/50">Loading registration billing…</p>;
  }

  if (!summary) {
    return error ? <p className="text-sm text-rose-200/90">{error}</p> : null;
  }

  if (summary.hasPaidRegistrationFee) {
    return (
      <p className="text-sm text-emerald-200/90">
        Platform registration fee paid. Thank you — your compliance record is up to date for billing.
      </p>
    );
  }

  const bgLabel = formatUsd(summary.backgroundCheckPaidCents);
  const standardBreakdown = summary.foundingPricing
    ? null
    : computeStandardTrainerRegistrationBreakdown(summary.backgroundCheckPaidCents);

  return (
    <div className="space-y-3">
      {summary.foundingPricing ? (
        <>
          <p className="text-sm leading-relaxed text-white/65">
            Founding coach pricing: pay <span className="font-semibold text-white">20%</span> of your verified background
            check amount ({bgLabel} paid to Checkr) plus an estimated card processing fee.
          </p>
          <p className="text-xs leading-relaxed text-white/50">
            Founding coaches among the first eligible trainer signups may also earn a promotional sales bonus (see Terms
            and the Promos page) on qualifying client package sales through Match Fit checkout.
          </p>
        </>
      ) : standardBreakdown ? (
        <div className="space-y-2 text-sm leading-relaxed text-white/65">
          <p>
            Standard pricing:{" "}
            <span className="font-semibold text-white">{bgLabel}</span> background check +{" "}
            <span className="font-semibold text-white">{formatUsd(standardBreakdown.platformCents)}</span> Match Fit
            platform sign-up fee ={" "}
            <span className="font-semibold text-white">{formatUsd(standardBreakdown.totalCents)}</span> total (USD).
          </p>
          <p className="text-white/55">
            Background check is paid to Checkr; the platform sign-up fee is collected after screening clears. Each card
            payment also includes an estimated processing fee at checkout.
          </p>
        </div>
      ) : null}
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
          {busy ? "Starting checkout…" : "Pay registration fee"}
        </button>
      ) : (
        <p className="text-xs text-white/45">
          Complete background check and certification approval before paying the platform registration fee.
        </p>
      )}
    </div>
  );
}
