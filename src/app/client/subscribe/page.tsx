"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  CLIENT_PLATFORM_SUBSCRIPTION_FEE_DISCLOSURE,
  formatClientPlatformSubscriptionUsd,
} from "@/lib/client-platform-subscription-pricing";
import { LAUNCH_CLIENT_TRIAL_DAYS } from "@/lib/match-fit-launch-cohort";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";

type TrialChoice = "STANDARD_72H" | "PAY_NOW";

function SubscribeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canceled = searchParams.get("canceled") === "1";

  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);
  const [launchCohortEligible, setLaunchCohortEligible] = useState(false);
  const [trialChoice, setTrialChoice] = useState<TrialChoice>("STANDARD_72H");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [qaSkip, setQaSkip] = useState(false);
  const [qaMasked, setQaMasked] = useState<string | null>(null);
  const [qaPassword, setQaPassword] = useState("");
  const [qaBusy, setQaBusy] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const metaRes = await fetch("/api/client/billing/pending-hold-meta", { credentials: "include" });
        const meta = (await metaRes.json()) as {
          hasHold?: boolean;
          internalQaBillingSkipEligible?: boolean;
          emailMasked?: string;
          launchCohortEligible?: boolean;
        };
        if (cancelled) return;
        if (meta.internalQaBillingSkipEligible) {
          setQaSkip(true);
          setQaMasked(meta.emailMasked ?? null);
          setLoading(false);
          return;
        }
        setLaunchCohortEligible(Boolean(meta.launchCohortEligible));
        setLoading(false);
      } catch {
        if (!cancelled) {
          setFatal("Network error. Try again.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function startCheckout() {
    setCheckoutBusy(true);
    setFatal(null);
    try {
      const res = await fetch("/api/client/billing/create-subscription", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialPlan: launchCohortEligible ? undefined : trialChoice,
        }),
      });
      const data = (await res.json()) as { error?: string; url?: string };
      if (!res.ok) {
        setFatal(data.error ?? "Unable to start checkout.");
        return;
      }
      if (!data.url) {
        setFatal("Checkout could not be initialized.");
        return;
      }
      navigateWithFullLoad(data.url);
    } catch {
      setFatal("Network error. Try again.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function qaComplete() {
    setQaError(null);
    setQaBusy(true);
    try {
      const res = await fetch("/api/client/billing/internal-qa-complete-registration", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: qaPassword }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setQaError(data.error ?? "Could not complete.");
        return;
      }
      const next = data.next ?? "/client/login?registered=1";
      navigateWithFullLoad(next);
    } catch {
      setQaError("Network error. Try again.");
    } finally {
      setQaBusy(false);
    }
  }

  async function abandon() {
    await fetch("/api/client/registration-hold/abandon", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const monthly = formatClientPlatformSubscriptionUsd();

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.12),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.08),transparent_50%)]"
      />
      <div className="relative z-10 mx-auto max-w-lg px-5 py-12 sm:px-8">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Subscription</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/65 sm:text-base">
          Match Fit is <span className="font-semibold text-white">{monthly} per month</span> for full client access. A
          valid card is required on file before you can use the app.
        </p>
        <p className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-white/55">
          {CLIENT_PLATFORM_SUBSCRIPTION_FEE_DISCLOSURE}
        </p>
        {launchCohortEligible ? (
          <p className="mt-4 rounded-xl border border-[#FFD34E]/30 bg-[#FFD34E]/10 px-4 py-3 text-sm leading-relaxed text-[#FFE9A8]">
            <span className="font-semibold text-white">Launch offer:</span> your first{" "}
            <span className="font-semibold text-white">{LAUNCH_CLIENT_TRIAL_DAYS} days</span> are free with a card on
            file. We email you 48 hours and 24 hours before your first {monthly} charge.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-white/45">Choose how to start</p>
            <label className="flex cursor-pointer gap-3 rounded-xl border border-white/15 bg-white/5 p-4">
              <input
                type="radio"
                name="trial"
                checked={trialChoice === "STANDARD_72H"}
                onChange={() => setTrialChoice("STANDARD_72H")}
                className="mt-1"
              />
              <span className="text-sm text-white/75">
                <span className="font-semibold text-white">72 hours free</span> — card required now; first {monthly}{" "}
                charge after 72 hours unless you cancel. We notify you 24 hours before billing.
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-xl border border-white/15 bg-white/5 p-4">
              <input
                type="radio"
                name="trial"
                checked={trialChoice === "PAY_NOW"}
                onChange={() => setTrialChoice("PAY_NOW")}
                className="mt-1"
              />
              <span className="text-sm text-white/75">
                <span className="font-semibold text-white">Pay now</span> — start your {monthly} subscription immediately.
              </span>
            </label>
          </div>
        )}
        <p className="mt-4 text-sm leading-relaxed text-white/55">
          Card numbers are collected by our PCI-compliant payment processor. Match Fit does not store your full card
          details—only secure tokens and subscription references.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-white/40">
          Your profile is created after checkout succeeds (including free-trial starts with a card on file). If you
          leave without completing checkout, use &quot;Cancel and delete my sign-up&quot; to remove your in-progress
          registration.
        </p>

        {canceled ? (
          <p className="mt-8 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/70" role="status">
            Checkout was canceled. You can try again below, or leave and delete your sign-up.
          </p>
        ) : null}

        {qaSkip ? (
          <div className="mt-10 space-y-4">
            <p className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100/95">
              Internal QA billing bypass is active for{" "}
              <span className="font-semibold text-white">{qaMasked ?? "this registration"}</span>. Enter the account
              password for this sign-up to continue without card checkout.
            </p>
            <label className="block text-xs font-bold uppercase tracking-wide text-white/45">
              Account password
              <input
                type="password"
                autoComplete="current-password"
                value={qaPassword}
                onChange={(e) => setQaPassword(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none ring-0 focus:border-[#FF7E00]/55"
              />
            </label>
            {qaError ? (
              <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
                {qaError}
              </p>
            ) : null}
            <button
              type="button"
              disabled={qaBusy || !qaPassword.trim()}
              onClick={() => void qaComplete()}
              className="flex min-h-[3rem] w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-45"
            >
              {qaBusy ? "Working…" : "Complete without card checkout"}
            </button>
          </div>
        ) : loading ? (
          <p className="mt-10 text-sm text-white/50">Loading checkout options…</p>
        ) : (
          <div className="mt-10 space-y-4">
            {fatal ? (
              <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
                {fatal}
              </p>
            ) : null}
            <button
              type="button"
              disabled={checkoutBusy}
              onClick={() => void startCheckout()}
              className="flex min-h-[3rem] w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-45"
            >
              {checkoutBusy ? "Redirecting…" : "Continue to secure checkout"}
            </button>
            <button
              type="button"
              onClick={abandon}
              className="w-full text-center text-xs font-semibold uppercase tracking-wide text-white/40 transition hover:text-white/65"
            >
              Cancel and delete my sign-up
            </button>
          </div>
        )}

        <p className="mt-10 text-xs text-white/35">
          <Link href="/terms" className="underline-offset-2 hover:text-white/55 hover:underline">
            Terms of Service
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SubscribePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-sm text-white/50 antialiased">Loading…</main>
      }
    >
      <SubscribeContent />
    </Suspense>
  );
}
