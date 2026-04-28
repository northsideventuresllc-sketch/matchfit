"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Summary = {
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
  stripeSubscriptionActive: boolean;
  subscriptionGraceUntil: string | null;
  nextBillingDate: string | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  defaultPaymentSummary: string | null;
  paymentMethodCount: number;
};

export function ClientBillingPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locked = searchParams.get("locked") === "1";

  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/client/billing/summary");
      const data = (await res.json()) as Summary & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load billing.");
        return;
      }
      setSummary(data);
    } catch {
      setError("Network error.");
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function openPortal() {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/client/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not open billing portal.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function cancelSubscription() {
    if (!window.confirm("End your subscription after the current billing period?")) return;
    setBusy("cancel");
    setError(null);
    try {
      const res = await fetch("/api/client/billing/cancel-at-period-end", { method: "POST" });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not cancel.");
        return;
      }
      await load();
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {locked ? (
        <p className="rounded-2xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-center text-sm text-[#FFB4B4]">
          YOUR SUBSCRIPTION NEEDS ATTENTION. UPDATE PAYMENT OR RENEW BELOW TO RESTORE FULL ACCESS AFTER ANY GRACE
          PERIOD.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}

      {!summary ? (
        <p className="text-center text-sm text-white/45">Loading billing…</p>
      ) : (
        <div className="space-y-6 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 sm:p-8">
          <div className="space-y-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Subscription</p>
            <p className="text-sm text-white/75">
              {summary.hasSubscription
                ? `STATUS: ${(summary.subscriptionStatus ?? "UNKNOWN").toUpperCase().replace(/_/g, " ")}`
                : "NO ACTIVE STRIPE SUBSCRIPTION ON THIS ACCOUNT (DEVELOPMENT OR LEGACY)."}
            </p>
            {summary.nextBillingDate ? (
              <p className="text-xs text-white/50">
                NEXT BILLING DATE:{" "}
                <span className="font-semibold text-white/80">
                  {new Date(summary.nextBillingDate).toLocaleDateString(undefined, {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </p>
            ) : null}
            {summary.subscriptionGraceUntil && !summary.stripeSubscriptionActive ? (
              <p className="text-xs text-amber-200/90">
                ACCESS GRACE ENDS:{" "}
                {new Date(summary.subscriptionGraceUntil).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            ) : null}
            {summary.cancelAtPeriodEnd ? (
              <p className="text-xs font-semibold text-amber-200/90">CANCEL AT PERIOD END IS SCHEDULED.</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Card on file</p>
            <p className="mt-2 text-sm text-white/80">
              {summary.defaultPaymentSummary ?? "NO DEFAULT CARD RETURNED — OPEN THE PORTAL TO ADD ONE."}
            </p>
            <p className="mt-2 text-xs text-white/45">
              Manage up to four saved cards in the secure Stripe billing portal (Match Fit never stores full card
              numbers on our servers).
            </p>
            <p className="mt-1 text-xs text-white/35">
              PAYMENT METHODS ON FILE: {summary.paymentMethodCount}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              disabled={busy !== null || !summary.hasStripeCustomer}
              onClick={() => void openPortal()}
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/12 px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/50 disabled:opacity-40 sm:max-w-xs"
            >
              {busy === "portal" ? "OPENING…" : "UPDATE PAYMENT METHODS"}
            </button>
            <button
              type="button"
              disabled={busy !== null || !summary.hasSubscription}
              onClick={() => void cancelSubscription()}
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.08em] text-white/85 transition hover:border-white/25 disabled:opacity-40 sm:max-w-xs"
            >
              {busy === "cancel" ? "WORKING…" : "STOP SUBSCRIPTION"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
