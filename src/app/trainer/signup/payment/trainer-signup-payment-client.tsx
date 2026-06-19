"use client";

import Image from "next/image";
import Link from "next/link";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotion-caps";
import {
  isTrainerBackgroundCheckPlatformCovered,
} from "@/lib/trainer-registration-pricing-mode";
import {
  TRAINER_SIGNUP_PAYMENT_AFTER_HOLD_NOTE,
  TRAINER_SIGNUP_PAYMENT_INTRO,
  TRAINER_SIGNUP_PAYMENT_LOADING_MESSAGE,
  TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE,
  trainerSignupPaymentHoldExplanation,
} from "@/lib/trainer-signup-payment-messaging";
import { DEFERRED_FEE_MIN_WITHHOLD_PCT } from "@/lib/trainer-deferred-fee-constants";
import { computeTrainerSignupBackgroundEscrowHoldCents, computeTrainerSignupPlatformHoldCents } from "@/lib/trainer-signup-escrow";
import { useStripePublishableKey } from "@/lib/use-stripe-publishable-key";

type Props = {
  pricingMode: TrainerRegistrationPricingMode;
  stripePublishableKey?: string | null;
  stripeSecretConfigured: boolean;
};

type PaymentStep = "platform" | "background_check";
type FeeChoice = "choose" | "pay_now" | "defer";

function DeferredPaymentForm({
  amountLabel,
  onBackgroundCheckAuthorized,
}: {
  amountLabel: string;
  onBackgroundCheckAuthorized: (next?: string) => void;
}) {
  return (
    <PaymentForm
      amountLabel={amountLabel}
      pricingMode="STANDARD_100_MINUS_BG"
      step="background_check"
      backgroundCheckHoldRequired={true}
      backgroundCheckPaymentIntentId={null}
      onPlatformAuthorized={() => undefined}
      onBackgroundCheckAuthorized={onBackgroundCheckAuthorized}
      skipPlatformStep
    />
  );
}

function PaymentForm({
  amountLabel,
  pricingMode,
  step,
  backgroundCheckHoldRequired,
  backgroundCheckPaymentIntentId,
  onPlatformAuthorized,
  onBackgroundCheckAuthorized,
  skipPlatformStep = false,
}: {
  amountLabel: string;
  pricingMode: TrainerRegistrationPricingMode;
  step: PaymentStep;
  backgroundCheckHoldRequired: boolean;
  backgroundCheckPaymentIntentId: string | null;
  onPlatformAuthorized: () => void;
  onBackgroundCheckAuthorized: (next?: string) => void;
  skipPlatformStep?: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bgCovered = isTrainerBackgroundCheckPlatformCovered(pricingMode);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: stripeErr, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
      if (stripeErr) {
        setError(stripeErr.message ?? "Payment could not be completed.");
        return;
      }
      const piId = paymentIntent?.id;
      if (!piId) {
        setError("Authorization completed but no payment id was returned.");
        return;
      }

      if (step === "platform" && !skipPlatformStep) {
        if (backgroundCheckHoldRequired && !backgroundCheckPaymentIntentId) {
          setError("Background screening authorization is missing. Refresh and try again.");
          return;
        }
        const platformRes = await fetch("/api/trainer/signup/confirm-platform-hold", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId: piId,
            ...(backgroundCheckPaymentIntentId
              ? { backgroundCheckPaymentIntentId }
              : {}),
          }),
        });
        const platformData = (await platformRes.json()) as { error?: string };
        if (!platformRes.ok) {
          setError(platformData.error ?? "Platform authorization succeeded but we could not update your account.");
          return;
        }
        if (!backgroundCheckHoldRequired) {
          navigateWithFullLoad("/trainer/dashboard");
          return;
        }
        onPlatformAuthorized();
        return;
      }

      const res = await fetch("/api/trainer/signup/confirm-background-escrow", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: piId }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error ?? "Authorization succeeded but we could not update your account. Contact support.");
        return;
      }
      onBackgroundCheckAuthorized(data.next);
    } catch {
      setError("Something went wrong while processing your card authorization.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {step === "platform" ? (
        <div className="space-y-3 rounded-xl border border-white/[0.08] bg-[#12151C]/60 px-4 py-4 text-sm leading-relaxed text-white/70">
          <p>{trainerSignupPaymentHoldExplanation(pricingMode)}</p>
          <p className="text-white/55">{TRAINER_SIGNUP_PAYMENT_AFTER_HOLD_NOTE}</p>
        </div>
      ) : (
        <p className="rounded-xl border border-white/[0.08] bg-[#12151C]/60 px-4 py-4 text-sm leading-relaxed text-white/70">
          Step 2 of 2: authorize the background screening hold. Match Fit captures this portion when Checkr screening
          runs, even if the result is not approved.
        </p>
      )}
      <p className="text-sm text-white/80">
        Hold amount for this step (includes processing):{" "}
        <span className="font-semibold text-[#FFD34E]">{amountLabel}</span>
      </p>
      <div className="rounded-xl border border-white/[0.08] bg-[#0E1016]/90 px-3 py-4">
        <PaymentElement />
      </div>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="flex min-h-[3rem] w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-60"
      >
        {submitting
          ? "Authorizing…"
          : step === "platform"
            ? bgCovered || !backgroundCheckHoldRequired
              ? "Place platform hold"
              : "Place platform hold (step 1 of 2)"
            : "Place background screening hold (step 2 of 2)"}
      </button>
    </form>
  );
}

export default function TrainerSignupPaymentClient({
  pricingMode,
  stripePublishableKey,
  stripeSecretConfigured,
}: Props) {
  const bgCovered = isTrainerBackgroundCheckPlatformCovered(pricingMode);
  const { publishableKey, loading: publishableLoading } = useStripePublishableKey(stripePublishableKey);
  const useEmbeddedCheckout = Boolean(publishableKey);
  const useCheckoutRedirect = !useEmbeddedCheckout && stripeSecretConfigured;
  const isStandard = pricingMode === "STANDARD_100_MINUS_BG";
  const platformDueLabel = `$${(computeTrainerSignupPlatformHoldCents("STANDARD_100_MINUS_BG") / 100).toFixed(2)}`;
  const deferredBalanceLabel = `$${(computeTrainerSignupPlatformHoldCents("STANDARD_100_MINUS_BG") / 100).toFixed(2)}`;
  const [feeChoice, setFeeChoice] = useState<FeeChoice>(isStandard ? "choose" : "pay_now");
  const [withholdPct, setWithholdPct] = useState(DEFERRED_FEE_MIN_WITHHOLD_PCT);
  const [deferSubmitting, setDeferSubmitting] = useState(false);
  const [step, setStep] = useState<PaymentStep>("platform");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amountLabel, setAmountLabel] = useState<string>("…");
  const [backgroundCheckPaymentIntentId, setBackgroundCheckPaymentIntentId] = useState<string | null>(null);
  const [backgroundCheckClientSecret, setBackgroundCheckClientSecret] = useState<string | null>(null);
  const [backgroundCheckHoldRequired, setBackgroundCheckHoldRequired] = useState(!bgCovered);
  const [initError, setInitError] = useState<string | null>(null);

  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  const configUnavailable =
    !publishableLoading && !stripeSecretConfigured ? TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE : null;
  const checkoutUnavailable =
    !publishableLoading &&
    stripeSecretConfigured &&
    !useCheckoutRedirect &&
    !useEmbeddedCheckout
      ? TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE
      : null;
  const displayInitError = initError ?? configUnavailable ?? checkoutUnavailable;

  useEffect(() => {
    if (publishableLoading) return;
    if (feeChoice !== "pay_now") return;
    if (!stripeSecretConfigured || (!useCheckoutRedirect && !useEmbeddedCheckout)) return;

    if (useCheckoutRedirect) {
      let cancelled = false;
      void fetch("/api/trainer/signup/create-checkout-session", {
        method: "POST",
        credentials: "include",
      })
        .then((r) => r.json())
        .then((d: { url?: string; totalCents?: number; error?: string }) => {
          if (cancelled) return;
          if (!d.url) {
            setInitError(d.error ?? TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE);
            return;
          }
          if (typeof d.totalCents === "number" && d.totalCents > 0) {
            setAmountLabel(`$${(d.totalCents / 100).toFixed(2)}`);
          }
          window.location.assign(d.url);
        })
        .catch(() => {
          if (!cancelled) {
            setInitError(TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE);
          }
        });
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    void fetch("/api/trainer/signup/create-payment-intent", {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.json())
      .then(
        (d: {
          clientSecret?: string;
          paymentIntentId?: string;
          backgroundCheckClientSecret?: string | null;
          backgroundCheckPaymentIntentId?: string | null;
          backgroundCheckHoldRequired?: boolean;
          totalCents?: number;
          platformHoldCents?: number;
          error?: string;
        }) => {
          if (cancelled) return;
          const holdRequired = d.backgroundCheckHoldRequired ?? true;
          setBackgroundCheckHoldRequired(holdRequired);
          if (!d.clientSecret || !d.paymentIntentId) {
            setInitError(d.error ?? TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE);
            return;
          }
          if (holdRequired && (!d.backgroundCheckClientSecret || !d.backgroundCheckPaymentIntentId)) {
            setInitError(d.error ?? TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE);
            return;
          }
          setClientSecret(d.clientSecret);
          setBackgroundCheckPaymentIntentId(d.backgroundCheckPaymentIntentId ?? null);
          setBackgroundCheckClientSecret(d.backgroundCheckClientSecret ?? null);
          if (typeof d.platformHoldCents === "number" && d.platformHoldCents > 0) {
            setAmountLabel(`$${(d.platformHoldCents / 100).toFixed(2)}`);
          } else if (typeof d.totalCents === "number" && d.totalCents > 0) {
            setAmountLabel(`$${(d.totalCents / 100).toFixed(2)}`);
          }
        },
      )
      .catch(() => {
        if (!cancelled) setInitError(TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE);
      });
    return () => {
      cancelled = true;
    };
  }, [publishableLoading, stripeSecretConfigured, useCheckoutRedirect, useEmbeddedCheckout, feeChoice]);

  async function startDeferredSignup() {
    setDeferSubmitting(true);
    setInitError(null);
    try {
      const res = await fetch("/api/trainer/signup/choose-deferred-fee", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withholdPct }),
      });
      const data = (await res.json()) as {
        error?: string;
        backgroundCheckClientSecret?: string | null;
        backgroundCheckHoldRequired?: boolean;
      };
      if (!res.ok) {
        setInitError(data.error ?? TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE);
        return;
      }
      const bgHoldCents = computeTrainerSignupBackgroundEscrowHoldCents("STANDARD_100_MINUS_BG");
      setAmountLabel(`$${(bgHoldCents / 100).toFixed(2)}`);
      setBackgroundCheckHoldRequired(data.backgroundCheckHoldRequired ?? true);
      setStep("background_check");
      setFeeChoice("defer");
      if (data.backgroundCheckClientSecret) {
        setClientSecret(data.backgroundCheckClientSecret);
      } else {
        setInitError(TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE);
      }
    } catch {
      setInitError(TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE);
    } finally {
      setDeferSubmitting(false);
    }
  }

  const redirecting =
    feeChoice === "pay_now" && useCheckoutRedirect && !publishableLoading && !displayInitError;
  const loadingIntent =
    feeChoice !== "choose" &&
    useEmbeddedCheckout &&
    !publishableLoading &&
    !clientSecret &&
    !displayInitError;

  const options: StripeElementsOptions | undefined = clientSecret
    ? { clientSecret, appearance: { theme: "night", variables: { colorPrimary: "#FF7E00" } } }
    : undefined;

  const loading = publishableLoading || loadingIntent || redirecting;

  function handlePlatformAuthorized() {
    setStep("background_check");
    if (backgroundCheckClientSecret) {
      setClientSecret(backgroundCheckClientSecret);
    }
  }

  function handleBackgroundCheckAuthorized(next?: string) {
    navigateWithFullLoad(next ?? "/trainer/dashboard");
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-lg">
        <Link href="/trainer/signup/terms" className="inline-flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-lg">
            <Image src="/logo.png" alt="Match Fit" fill className="object-contain" sizes="40px" />
          </div>
          <span className="text-sm font-bold text-white/70">Back to agreement</span>
        </Link>

        <h1 className="mt-8 text-2xl font-black uppercase tracking-tight">Authorize signup fee</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">{TRAINER_SIGNUP_PAYMENT_INTRO}</p>

        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-white/55">
          <li>Step 1: platform onboarding hold (released if you are not fully approved).</li>
          {backgroundCheckHoldRequired ? (
            <li>Step 2: background screening hold (captured when Checkr screening runs).</li>
          ) : (
            <li>
              Founding coach benefit: Match Fit covers your Checkr background screening — no separate screening hold
              on your card.
            </li>
          )}
          <li>
            After {backgroundCheckHoldRequired ? "both holds are placed" : "your platform hold is placed"}, continue
            certification and background screening in your dashboard.
          </li>
          <li>When certification and screening are fully approved, Match Fit captures the platform hold.</li>
        </ol>

        <div className="mt-8">
          {isStandard && feeChoice === "choose" ? (
            <div className="space-y-4">
              <p className="text-sm text-white/70">Choose how you want to handle your platform onboarding fee.</p>
              <button
                type="button"
                onClick={() => setFeeChoice("pay_now")}
                className="w-full rounded-xl border border-white/10 bg-[#12151C]/80 px-4 py-4 text-left text-sm text-white/80 hover:border-[#FFD34E]/40"
              >
                <span className="block font-black uppercase tracking-[0.08em] text-[#FFD34E]">Pay now</span>
                <span className="mt-2 block">Pay {platformDueLabel} today (authorized now, captured after approval).</span>
              </button>
              <div className="rounded-xl border border-white/10 bg-[#12151C]/80 px-4 py-4 text-sm text-white/80">
                <span className="block font-black uppercase tracking-[0.08em] text-[#FFD34E]">Defer</span>
                <p className="mt-2 leading-relaxed">
                  Pay $0 today. Match Fit withholds at least {DEFERRED_FEE_MIN_WITHHOLD_PCT}% of each payout until your{" "}
                  {deferredBalanceLabel} balance is cleared. Full balance due within 60 days of completing onboarding.
                  Missing the deadline results in a 1-year account ban.
                </p>
                <label className="mt-4 block text-xs uppercase tracking-[0.12em] text-white/45">
                  Withhold percentage ({DEFERRED_FEE_MIN_WITHHOLD_PCT}–100%)
                </label>
                <input
                  type="range"
                  min={DEFERRED_FEE_MIN_WITHHOLD_PCT}
                  max={100}
                  value={withholdPct}
                  onChange={(e) => setWithholdPct(Number(e.target.value))}
                  className="mt-2 w-full"
                />
                <p className="mt-1 text-xs text-white/55">{withholdPct}% of each payout</p>
                <button
                  type="button"
                  disabled={deferSubmitting}
                  onClick={() => void startDeferredSignup()}
                  className="mt-4 flex min-h-[3rem] w-full items-center justify-center rounded-xl border border-[#FFD34E]/40 bg-[#FFD34E]/10 text-sm font-black uppercase tracking-[0.08em] text-[#FFD34E] disabled:opacity-60"
                >
                  {deferSubmitting ? "Starting…" : "Continue with deferred fee"}
                </button>
              </div>
            </div>
          ) : loading ? (
            <p className="text-sm text-white/50">
              {redirecting
                ? `Redirecting to secure Stripe checkout${amountLabel !== "…" ? ` for ${amountLabel}` : ""}…`
                : TRAINER_SIGNUP_PAYMENT_LOADING_MESSAGE}
            </p>
          ) : displayInitError ? (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-4 text-sm leading-relaxed text-rose-100/95">
              <p>{displayInitError}</p>
              <p className="mt-3 text-xs text-rose-100/70">
                This is a temporary platform setup issue on our side — not a problem with your card. You can refresh
                this page in a few minutes or email{" "}
                <a href="mailto:support@match-fit.net" className="font-semibold text-white underline-offset-2 hover:underline">
                  support@match-fit.net
                </a>{" "}
                if it persists.
              </p>
            </div>
          ) : clientSecret && stripePromise && options ? (
            <Elements key={`${step}-${clientSecret}`} stripe={stripePromise} options={options}>
              {feeChoice === "defer" ? (
                <DeferredPaymentForm
                  amountLabel={amountLabel}
                  onBackgroundCheckAuthorized={handleBackgroundCheckAuthorized}
                />
              ) : (
                <PaymentForm
                  amountLabel={amountLabel}
                  pricingMode={pricingMode}
                  step={step}
                  backgroundCheckHoldRequired={backgroundCheckHoldRequired}
                  backgroundCheckPaymentIntentId={backgroundCheckPaymentIntentId}
                  onPlatformAuthorized={handlePlatformAuthorized}
                  onBackgroundCheckAuthorized={handleBackgroundCheckAuthorized}
                />
              )}
            </Elements>
          ) : null}
        </div>
      </div>
    </main>
  );
}
