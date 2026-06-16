"use client";

import Image from "next/image";
import Link from "next/link";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import {
  TRAINER_SIGNUP_PAYMENT_AFTER_HOLD_NOTE,
  TRAINER_SIGNUP_PAYMENT_INTRO,
  TRAINER_SIGNUP_PAYMENT_LOADING_MESSAGE,
  TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE,
  trainerSignupPaymentHoldExplanation,
} from "@/lib/trainer-signup-payment-messaging";
import { useStripePublishableKey } from "@/lib/use-stripe-publishable-key";

type Props = {
  foundingPricing: boolean;
  stripePublishableKey?: string | null;
  stripeSecretConfigured: boolean;
};

type PaymentStep = "platform" | "background_check";

function PaymentForm({
  amountLabel,
  foundingPricing,
  step,
  backgroundCheckPaymentIntentId,
  onPlatformAuthorized,
  onBackgroundCheckAuthorized,
}: {
  amountLabel: string;
  foundingPricing: boolean;
  step: PaymentStep;
  backgroundCheckPaymentIntentId: string | null;
  onPlatformAuthorized: () => void;
  onBackgroundCheckAuthorized: (next?: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      if (step === "platform") {
        if (!backgroundCheckPaymentIntentId) {
          setError("Background screening authorization is missing. Refresh and try again.");
          return;
        }
        const platformRes = await fetch("/api/trainer/signup/confirm-platform-hold", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId: piId,
            backgroundCheckPaymentIntentId,
          }),
        });
        const platformData = (await platformRes.json()) as { error?: string };
        if (!platformRes.ok) {
          setError(platformData.error ?? "Platform authorization succeeded but we could not update your account.");
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
          <p>{trainerSignupPaymentHoldExplanation(foundingPricing ? "FOUNDING_BG_SURCHARGE_20PCT" : "STANDARD_100_MINUS_BG")}</p>
          <p className="text-white/55">{TRAINER_SIGNUP_PAYMENT_AFTER_HOLD_NOTE}</p>
        </div>
      ) : (
        <p className="rounded-xl border border-white/[0.08] bg-[#12151C]/60 px-4 py-4 text-sm leading-relaxed text-white/70">
          {foundingPricing
            ? "Authorize your background screening payment through Match Fit. Match Fit captures this amount when Checkr screening runs."
            : "Step 2 of 2: authorize the background screening hold. Match Fit captures this portion when Checkr screening runs, even if the result is not approved."}
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
            ? foundingPricing
              ? "Continue to background check"
              : "Place platform hold (step 1 of 2)"
            : foundingPricing
              ? "Pay background check"
              : "Place background screening hold (step 2 of 2)"}
      </button>
    </form>
  );
}

export default function TrainerSignupPaymentClient({
  foundingPricing,
  stripePublishableKey,
  stripeSecretConfigured,
}: Props) {
  const { publishableKey, loading: publishableLoading } = useStripePublishableKey(stripePublishableKey);
  const useEmbeddedCheckout = Boolean(publishableKey);
  const useCheckoutRedirect = !useEmbeddedCheckout && stripeSecretConfigured;
  const [step, setStep] = useState<PaymentStep>("platform");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amountLabel, setAmountLabel] = useState<string>("…");
  const [backgroundCheckPaymentIntentId, setBackgroundCheckPaymentIntentId] = useState<string | null>(null);
  const [backgroundCheckClientSecret, setBackgroundCheckClientSecret] = useState<string | null>(null);
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
          backgroundCheckClientSecret?: string;
          backgroundCheckPaymentIntentId?: string;
          totalCents?: number;
          platformHoldCents?: number;
          error?: string;
        }) => {
          if (cancelled) return;
          if (!d.clientSecret || !d.paymentIntentId || !d.backgroundCheckClientSecret || !d.backgroundCheckPaymentIntentId) {
            setInitError(d.error ?? TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE);
            return;
          }
          setClientSecret(d.clientSecret);
          setBackgroundCheckPaymentIntentId(d.backgroundCheckPaymentIntentId);
          setBackgroundCheckClientSecret(d.backgroundCheckClientSecret);
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
  }, [publishableLoading, stripeSecretConfigured, useCheckoutRedirect, useEmbeddedCheckout]);

  const redirecting =
    useCheckoutRedirect && !publishableLoading && !displayInitError;
  const loadingIntent =
    useEmbeddedCheckout && !publishableLoading && !clientSecret && !displayInitError;

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

        <h1 className="mt-8 text-2xl font-black uppercase tracking-tight">
          {foundingPricing ? "Pay background check" : "Authorize signup fee"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">{TRAINER_SIGNUP_PAYMENT_INTRO}</p>

        {foundingPricing ? (
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-white/55">
            <li>Pay your background check through Match Fit&apos;s portal (plus card processing).</li>
            <li>Begin onboarding within 7 days of sign-up, including certification uploads and Checkr screening.</li>
            <li>You receive 60 days of Premium Page access at sign-up.</li>
            <li>You cannot sell or offer services until every onboarding requirement is completed.</li>
          </ol>
        ) : (
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-white/55">
            <li>Step 1: platform onboarding hold (released if you are not fully approved).</li>
            <li>Step 2: background screening hold (captured when Checkr screening runs).</li>
            <li>After both holds are placed, continue certification and background screening in your dashboard.</li>
            <li>When certification and screening are fully approved, Match Fit captures the platform hold.</li>
          </ol>
        )}

        <div className="mt-8">
          {loading ? (
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
              <PaymentForm
                amountLabel={amountLabel}
                foundingPricing={foundingPricing}
                step={step}
                backgroundCheckPaymentIntentId={backgroundCheckPaymentIntentId}
                onPlatformAuthorized={handlePlatformAuthorized}
                onBackgroundCheckAuthorized={handleBackgroundCheckAuthorized}
              />
            </Elements>
          ) : null}
        </div>
      </div>
    </main>
  );
}
