"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  type TrainerNotificationPrefs,
  defaultTrainerNotificationPrefs,
} from "@/lib/trainer-notification-prefs";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";

type ConnectStatus = {
  connected: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
  disabledReason: string | null;
};

type Summary = {
  mode: "live" | "placeholder";
  email: string;
  premiumStudioActive: boolean;
  premiumStudioEnabledAt: string | null;
  hasActiveSubscription: boolean;
  stripeSubscriptionActive?: boolean;
  platformTrialEndsAt?: string | null;
  paymentGraceUntil?: string | null;
  accessPhase?: string;
  needsPayment?: boolean;
  monthlyPriceUsd?: number;
  accountTier?: string;
  accountTierLabel?: string;
  message: string;
};

export function TrainerBillingPageClient() {
  const searchParams = useSearchParams();
  const locked = searchParams.get("locked") === "1";
  const subscribed = searchParams.get("subscribed") === "1";
  const canceled = searchParams.get("canceled") === "1";
  const connectReturn = searchParams.get("connect") === "return";
  const connectRefresh = searchParams.get("connect") === "refresh";

  const [summary, setSummary] = useState<Summary | null>(null);
  const [prefs, setPrefs] = useState<TrainerNotificationPrefs>({ ...defaultTrainerNotificationPrefs });
  const [error, setError] = useState<string | null>(null);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [prefsOk, setPrefsOk] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [cashoutAmount, setCashoutAmount] = useState("");
  const [cashoutMethod, setCashoutMethod] = useState<"STANDARD" | "INSTANT">("STANDARD");
  const [cashoutStep, setCashoutStep] = useState<"idle" | "otp">("idle");
  const [cashoutCode, setCashoutCode] = useState("");
  const [cashoutBusy, setCashoutBusy] = useState(false);
  const [cashoutMsg, setCashoutMsg] = useState<string | null>(null);
  const [cashoutPreview, setCashoutPreview] = useState<{ feeCents: number; netCents: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/trainer/billing/summary");
        const data = (await res.json()) as Summary & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load billing.");
          return;
        }
        setSummary({
          mode: data.mode,
          email: data.email,
          premiumStudioActive: data.premiumStudioActive,
          premiumStudioEnabledAt: data.premiumStudioEnabledAt,
          hasActiveSubscription: data.hasActiveSubscription,
          stripeSubscriptionActive: data.stripeSubscriptionActive,
          platformTrialEndsAt: data.platformTrialEndsAt,
          paymentGraceUntil: data.paymentGraceUntil,
          accessPhase: data.accessPhase,
          needsPayment: data.needsPayment,
          monthlyPriceUsd: data.monthlyPriceUsd,
          accountTier: data.accountTier,
          accountTierLabel: data.accountTierLabel,
          message: data.message,
        });

        const prefsRes = await fetch("/api/trainer/notification-prefs");
        const prefsData = (await prefsRes.json()) as { preferences?: TrainerNotificationPrefs };
        if (prefsRes.ok && prefsData.preferences) {
          setPrefs({ ...defaultTrainerNotificationPrefs, ...prefsData.preferences });
        }

        const [balanceRes, connectRes] = await Promise.all([
          fetch("/api/trainer/payouts/balance"),
          fetch("/api/trainer/payouts/connect/status"),
        ]);
        if (!cancelled) {
          if (balanceRes.ok) {
            const balanceData = (await balanceRes.json()) as { balanceCents: number };
            setBalanceCents(balanceData.balanceCents);
          }
          if (connectRes.ok) {
            setConnectStatus((await connectRes.json()) as ConnectStatus);
          }
        }
      } catch {
        if (!cancelled) setError("Could not load billing.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function parsedCashoutAmountCents(): number | null {
    const dollars = Number.parseFloat(cashoutAmount);
    if (!Number.isFinite(dollars) || dollars <= 0) return null;
    return Math.round(dollars * 100);
  }

  async function startCashout() {
    const amountCents = parsedCashoutAmountCents();
    if (!amountCents) {
      setCashoutMsg("Enter an amount to cash out.");
      return;
    }
    setCashoutBusy(true);
    setCashoutMsg(null);
    try {
      const res = await fetch("/api/trainer/payouts/cashout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents, method: cashoutMethod }),
      });
      const data = (await res.json()) as { error?: string; feeCents?: number; netCents?: number };
      if (!res.ok) {
        setCashoutMsg(data.error ?? "Could not start cash out.");
        return;
      }
      setCashoutPreview({ feeCents: data.feeCents ?? 0, netCents: data.netCents ?? amountCents });
      setCashoutStep("otp");
      setCashoutMsg("Check your email for a 6-digit code.");
    } catch {
      setCashoutMsg("Could not start cash out.");
    } finally {
      setCashoutBusy(false);
    }
  }

  async function confirmCashout() {
    const amountCents = parsedCashoutAmountCents();
    if (!amountCents || !/^\d{6}$/.test(cashoutCode)) {
      setCashoutMsg("Enter the 6-digit code from your email.");
      return;
    }
    setCashoutBusy(true);
    setCashoutMsg(null);
    try {
      const res = await fetch("/api/trainer/payouts/cashout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents, method: cashoutMethod, code: cashoutCode }),
      });
      const data = (await res.json()) as { error?: string; netCents?: number };
      if (!res.ok) {
        setCashoutMsg(data.error ?? "Could not complete cash out.");
        return;
      }
      setCashoutMsg(`Cash out sent — $${((data.netCents ?? 0) / 100).toFixed(2)} on its way to your bank.`);
      setCashoutStep("idle");
      setCashoutAmount("");
      setCashoutCode("");
      setCashoutPreview(null);
      const balanceRes = await fetch("/api/trainer/payouts/balance");
      if (balanceRes.ok) {
        const balanceData = (await balanceRes.json()) as { balanceCents: number };
        setBalanceCents(balanceData.balanceCents);
      }
    } catch {
      setCashoutMsg("Could not complete cash out.");
    } finally {
      setCashoutBusy(false);
    }
  }

  async function startPayoutsOnboarding() {
    setConnectBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trainer/payouts/connect/start", { method: "POST" });
      const data = (await res.json()) as { error?: string; url?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start payout setup.");
        return;
      }
      navigateWithFullLoad(data.url);
    } catch {
      setError("Could not start payout setup.");
    } finally {
      setConnectBusy(false);
    }
  }

  async function startSubscriptionCheckout() {
    setCheckoutBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trainer/billing/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactivation: Boolean(summary?.needsPayment) }),
      });
      const data = (await res.json()) as { error?: string; url?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout.");
        return;
      }
      navigateWithFullLoad(data.url);
    } catch {
      setError("Could not start checkout.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  if (error && !summary) {
    return (
      <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
        {error}
      </p>
    );
  }

  if (!summary) {
    return <p className="text-center text-sm text-white/45">Loading billing…</p>;
  }

  const monthlyLabel = `$${(summary.monthlyPriceUsd ?? 15).toFixed(2)}`;
  const tierLabel = summary.accountTierLabel ?? "Independent Pro";
  const showSubscribeCta = !summary.hasActiveSubscription;

  return (
    <div className="space-y-6">
      {locked || summary.needsPayment ? (
        <div className="rounded-2xl border border-[#FFD34E]/35 bg-[#FFD34E]/10 px-4 py-4 text-sm text-[#FFE9A8]" role="status">
          Your {tierLabel} free trial has ended. Start the {monthlyLabel} per month subscription to keep your account
          active. You will be prompted for payment whenever you log in until billing is connected.
        </div>
      ) : null}
      {subscribed ? (
        <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100" role="status">
          Subscription started. Your {tierLabel} account stays active while billing remains current.
        </div>
      ) : null}
      {canceled ? (
        <div className="rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white/70" role="status">
          Checkout was canceled. You can resume whenever you are ready.
        </div>
      ) : null}
      {connectReturn ? (
        <div className="rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white/70" role="status">
          {connectStatus?.payoutsEnabled
            ? "Payout setup is complete."
            : "We saved your progress. Finish any remaining steps below to enable payouts."}
        </div>
      ) : null}
      {connectRefresh ? (
        <div className="rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white/70" role="status">
          That payout setup link expired. Start again below.
        </div>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-6 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 sm:p-8">
        <div className="space-y-2 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
            {tierLabel} Subscription
          </p>
          <p className="text-sm text-white/75">
            {summary.hasActiveSubscription ? "STATUS: ACTIVE" : summary.needsPayment ? "STATUS: PAYMENT REQUIRED" : "STATUS: FREE TRIAL"}
          </p>
          {summary.platformTrialEndsAt ? (
            <p className="text-xs text-white/50">
              Trial ends:{" "}
              <span className="font-semibold text-white/80">
                {new Date(summary.platformTrialEndsAt).toLocaleDateString(undefined, {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </p>
          ) : null}
          {summary.premiumStudioEnabledAt ? (
            <p className="text-xs text-white/50">
              Premium started:{" "}
              <span className="font-semibold text-white/80">
                {new Date(summary.premiumStudioEnabledAt).toLocaleDateString(undefined, {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/60 px-4 py-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Plan</p>
          <p className="mt-2 text-sm text-white/80">{summary.message}</p>
          <p className="mt-2 text-xs text-white/35">
            After your free trial, {monthlyLabel} per month keeps your {tierLabel} account active.
          </p>
        </div>

        {showSubscribeCta ? (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={checkoutBusy}
              onClick={() => void startSubscriptionCheckout()}
              className="inline-flex min-h-[3rem] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-6 text-xs font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-45"
            >
              {checkoutBusy ? "Starting Checkout…" : `Start ${monthlyLabel}/Mo Subscription`}
            </button>
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/60 px-4 py-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Earnings Balance</p>
          <p className="mt-2 text-2xl font-black text-white">
            ${((balanceCents ?? 0) / 100).toFixed(2)}
          </p>
          <p className="mt-2 text-xs text-white/40">
            {connectStatus?.payoutsEnabled
              ? "Bank account connected."
              : connectStatus?.connected
                ? "Bank setup started but not finished — finish it to enable payouts."
                : "Connect a bank account so this balance can be paid out to you."}
          </p>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              disabled={connectBusy}
              onClick={() => void startPayoutsOnboarding()}
              className="inline-flex min-h-[2.6rem] items-center justify-center rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/12 px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/50 disabled:opacity-40"
            >
              {connectBusy
                ? "Starting…"
                : connectStatus?.payoutsEnabled
                  ? "Update Bank Account"
                  : connectStatus?.connected
                    ? "Continue Bank Setup"
                    : "Connect Bank Account"}
            </button>
          </div>

          {connectStatus?.payoutsEnabled ? (
            <div className="mt-6 space-y-3 border-t border-white/[0.06] pt-6 text-left">
              <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-white/40">
                Cash Out
              </p>
              <input
                type="number"
                min="5"
                step="0.01"
                placeholder="Amount ($5.00 minimum)"
                value={cashoutAmount}
                disabled={cashoutStep === "otp"}
                onChange={(e) => {
                  setCashoutAmount(e.target.value);
                  setCashoutPreview(null);
                }}
                className="w-full rounded-xl border border-white/15 bg-[#12151C]/70 px-4 py-3 text-sm text-white placeholder:text-white/30 disabled:opacity-50"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={cashoutStep === "otp"}
                  onClick={() => setCashoutMethod("STANDARD")}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.06em] transition disabled:opacity-50 ${
                    cashoutMethod === "STANDARD"
                      ? "border-[#FF7E00]/60 bg-[#FF7E00]/15 text-white"
                      : "border-white/15 bg-white/[0.04] text-white/70"
                  }`}
                >
                  Standard (1-2 days, no fee)
                </button>
                <button
                  type="button"
                  disabled={cashoutStep === "otp"}
                  onClick={() => setCashoutMethod("INSTANT")}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.06em] transition disabled:opacity-50 ${
                    cashoutMethod === "INSTANT"
                      ? "border-[#FF7E00]/60 bg-[#FF7E00]/15 text-white"
                      : "border-white/15 bg-white/[0.04] text-white/70"
                  }`}
                >
                  Instant ($1.99 fee)
                </button>
              </div>

              {cashoutStep === "idle" ? (
                <button
                  type="button"
                  disabled={cashoutBusy}
                  onClick={() => void startCashout()}
                  className="w-full rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-45"
                >
                  {cashoutBusy ? "Sending Code…" : "Send Verification Code"}
                </button>
              ) : (
                <div className="space-y-3">
                  {cashoutPreview ? (
                    <p className="text-center text-xs text-white/50">
                      Fee: ${(cashoutPreview.feeCents / 100).toFixed(2)} — you receive $
                      {(cashoutPreview.netCents / 100).toFixed(2)}
                    </p>
                  ) : null}
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="6-digit code"
                    value={cashoutCode}
                    onChange={(e) => setCashoutCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full rounded-xl border border-white/15 bg-[#12151C]/70 px-4 py-3 text-center text-sm tracking-[0.3em] text-white placeholder:text-white/30"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={cashoutBusy}
                      onClick={() => {
                        setCashoutStep("idle");
                        setCashoutCode("");
                        setCashoutMsg(null);
                      }}
                      className="flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-white/70"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={cashoutBusy}
                      onClick={() => void confirmCashout()}
                      className="flex-1 rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-45"
                    >
                      {cashoutBusy ? "Confirming…" : "Confirm Cash Out"}
                    </button>
                  </div>
                </div>
              )}
              {cashoutMsg ? <p className="text-center text-xs text-white/60">{cashoutMsg}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/60 px-4 py-4">
          <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-white/40">
            Billing Notifications
          </p>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-[#12151C]/70 px-4 py-3">
              <span className="text-sm text-white/85">Email Billing Notifications</span>
              <input
                type="checkbox"
                checked={prefs.billingEmailNotifications}
                onChange={(e) => {
                  setPrefsOk(null);
                  setPrefs((p) => ({ ...p, billingEmailNotifications: e.target.checked }));
                }}
                className="h-5 w-5 accent-[#FF7E00]"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-[#12151C]/70 px-4 py-3">
              <span className="text-sm text-white/85">Web Push billing alerts</span>
              <input
                type="checkbox"
                checked={prefs.billingPushNotifications}
                onChange={(e) => {
                  setPrefsOk(null);
                  setPrefs((p) => ({ ...p, billingPushNotifications: e.target.checked }));
                }}
                className="h-5 w-5 accent-[#FF7E00]"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              disabled={prefsBusy}
              onClick={async () => {
                setPrefsBusy(true);
                setPrefsOk(null);
                setError(null);
                try {
                  const res = await fetch("/api/trainer/notification-prefs", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ preferences: prefs }),
                  });
                  const data = (await res.json()) as { error?: string };
                  if (!res.ok) {
                    setError(data.error ?? "Could not save billing notification settings.");
                    return;
                  }
                  setPrefsOk("Billing notification settings saved.");
                } catch {
                  setError("Could not save billing notification settings.");
                } finally {
                  setPrefsBusy(false);
                }
              }}
              className="inline-flex min-h-[2.6rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.08em] text-white/85 transition hover:border-white/25 disabled:opacity-40"
            >
              {prefsBusy ? "Saving…" : "Save Notification Settings"}
            </button>
          </div>
          {prefsOk ? <p className="mt-3 text-center text-xs text-emerald-200/85">{prefsOk}</p> : null}
          <p className="mt-4 text-center text-xs text-white/40">
            Account email on file: <span className="text-white/60">{summary.email}</span>
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {summary.premiumStudioActive ? (
            <>
              <a
                href="/trainer/dashboard/premium"
                className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/12 px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/50 sm:max-w-xs"
              >
                Open Premium Hub
              </a>
              <a
                href="/trainer/dashboard/premium/fit-hub-content"
                className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.08em] text-white/85 transition hover:border-white/25 sm:max-w-xs"
              >
                Fit Hub &amp; Content
              </a>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
