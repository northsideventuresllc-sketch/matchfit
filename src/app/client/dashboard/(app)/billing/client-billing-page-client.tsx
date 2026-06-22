"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CLIENT_BETA_VIP_TRIAL_DAYS,
  CLIENT_FREE_PLAN_FEATURES,
  CLIENT_FREE_PLAN_LABEL,
  CLIENT_VIP_PLAN_FEATURES,
  CLIENT_VIP_PLAN_LABEL,
  clientVipPriceLabel,
} from "@/lib/client-plan-copy";
import type { ClientPlanStatus } from "@/lib/client-plan-status";
import { ClientPlanStatusBanner } from "@/components/client/client-plan-status-banner";

type Summary = {
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
  stripeSubscriptionActive: boolean;
  subscriptionGraceUntil: string | null;
  platformTrialEndsAt: string | null;
  paymentGraceUntil: string | null;
  accountDeactivatedAt: string | null;
  platformTrialConsumed: boolean;
  accessPhase:
    | "platform_trial"
    | "freemium"
    | "payment_grace"
    | "deactivated"
    | "paid"
    | "vip"
    | "stripe_lapsed_grace";
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
  const vipResult = searchParams.get("vip");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [plan, setPlan] = useState<ClientPlanStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [summaryRes, planRes] = await Promise.all([
        fetch("/api/client/billing/summary"),
        fetch("/api/client/billing/plan-status"),
      ]);
      const summaryData = (await summaryRes.json()) as Summary & { error?: string };
      const planData = (await planRes.json()) as ClientPlanStatus & { error?: string; accessPhase?: Summary["accessPhase"] };
      if (!summaryRes.ok) {
        setError(summaryData.error ?? "Could not load billing.");
        return;
      }
      if (!planRes.ok) {
        setError(planData.error ?? "Could not load plan status.");
        return;
      }
      setSummary(summaryData);
      setPlan(planData);
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

  async function startVipCheckout() {
    setBusy("vip");
    setError(null);
    try {
      const res = await fetch("/api/client/billing/vip-checkout", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start VIP checkout.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function startSubscriptionCheckout() {
    setBusy("checkout");
    setError(null);
    try {
      const res = await fetch("/api/client/billing/create-subscription", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactivation: summary?.accessPhase === "deactivated" }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

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

  const showLegacySubscription =
    summary?.accessPhase === "payment_grace" ||
    summary?.accessPhase === "deactivated" ||
    summary?.accessPhase === "stripe_lapsed_grace" ||
    summary?.hasSubscription;

  return (
    <div className="space-y-6">
      {vipResult === "success" ? (
        <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-100">
          VIP checkout completed. Your membership should activate within a minute.
        </p>
      ) : null}
      {vipResult === "cancel" ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm text-white/60">
          VIP checkout was canceled. You can upgrade anytime from this page.
        </p>
      ) : null}

      {locked ? (
        <p className="rounded-2xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-center text-sm text-[#FFB4B4]">
          Your legacy payment grace window has ended. Connect a card below to restore access, or contact support if you
          believe this is an error.
        </p>
      ) : null}

      {plan ? <ClientPlanStatusBanner plan={plan} /> : null}

      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}

      {!summary || !plan ? (
        <p className="text-center text-sm text-white/45">Loading billing…</p>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">{CLIENT_FREE_PLAN_LABEL} plan</p>
              <p className="mt-2 text-2xl font-black text-white">$0 / month</p>
              <ul className="mt-4 space-y-2 text-sm text-white/65">
                {CLIENT_FREE_PLAN_FEATURES.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              {plan.displayTier === "free" ? (
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-[#FFD34E]">Current plan</p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-[#FF7E00]/30 bg-[linear-gradient(160deg,rgba(255,211,78,0.1),rgba(18,21,28,0.95))] p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FFD34E]">{CLIENT_VIP_PLAN_LABEL} plan</p>
              <p className="mt-2 text-2xl font-black text-[#FFD34E]">{clientVipPriceLabel()} / month</p>
              <ul className="mt-4 space-y-2 text-sm text-white/70">
                {CLIENT_VIP_PLAN_FEATURES.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              {plan.displayTier === "vip_trial" ? (
                <p className="mt-4 text-xs text-white/55">
                  Beta trial active — {plan.trialDaysRemaining ?? CLIENT_BETA_VIP_TRIAL_DAYS} day(s) of full access remain.
                </p>
              ) : null}
              {plan.displayTier === "vip" ? (
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-300">Current plan</p>
              ) : (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void startVipCheckout()}
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-4 text-xs font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-50"
                >
                  {busy === "vip" ? "Opening checkout…" : "Upgrade to VIP"}
                </button>
              )}
            </div>
          </div>

          {showLegacySubscription ? (
            <div className="space-y-6 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 sm:p-8">
              <div className="space-y-2 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Legacy platform subscription</p>
                <p className="text-sm text-white/75">
                  {summary.accessPhase === "platform_trial"
                    ? "FREE TRIAL ACTIVE — NO CARD REQUIRED YET."
                    : summary.accessPhase === "payment_grace"
                      ? "PAYMENT GRACE — SUBSCRIBE AND ADD A CARD TO RESTORE FULL ACCESS."
                      : summary.hasSubscription
                        ? `STATUS: ${(summary.subscriptionStatus ?? "UNKNOWN").toUpperCase().replace(/_/g, " ")}`
                        : "NO ACTIVE LEGACY STRIPE SUBSCRIPTION ON THIS ACCOUNT."}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                {summary.accessPhase === "payment_grace" || summary.accessPhase === "stripe_lapsed_grace" ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void startSubscriptionCheckout()}
                    className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-[#FF7E00]/50 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-4 text-xs font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-40 sm:max-w-xs"
                  >
                    {busy === "checkout" ? "Opening checkout…" : "Subscribe & add card"}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy !== null || !summary.hasStripeCustomer}
                  onClick={() => void openPortal()}
                  className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/12 px-4 text-xs font-black uppercase tracking-[0.08em] text-white disabled:opacity-40 sm:max-w-xs"
                >
                  {busy === "portal" ? "Opening…" : "Update payment methods"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null || !summary.hasSubscription}
                  onClick={() => void cancelSubscription()}
                  className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.08em] text-white/85 disabled:opacity-40 sm:max-w-xs"
                >
                  {busy === "cancel" ? "Working…" : "Stop subscription"}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
