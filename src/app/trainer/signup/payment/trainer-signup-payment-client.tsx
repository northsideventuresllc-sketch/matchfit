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
  stripeConfiguredOnServer: boolean;
};

function PaymentForm({
  amountLabel,
  foundingPricing,
}: {
  amountLabel: string;
  foundingPricing: boolean;
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
      const res = await fetch("/api/trainer/signup/confirm-payment", {
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
      navigateWithFullLoad(data.next ?? "/trainer/dashboard");
    } catch {
      setError("Something went wrong while processing your card authorization.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="space-y-3 rounded-xl border border-white/[0.08] bg-[#12151C]/60 px-4 py-4 text-sm leading-relaxed text-white/70">
        <p>{trainerSignupPaymentHoldExplanation(foundingPricing ? "FOUNDING_BG_SURCHARGE_20PCT" : "STANDARD_100_MINUS_BG")}</p>
        <p className="text-white/55">{TRAINER_SIGNUP_PAYMENT_AFTER_HOLD_NOTE}</p>
      </div>
      <p className="text-sm text-white/80">
        Hold amount today (includes processing):{" "}
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
        {submitting ? "Authorizing…" : "Place signup fee hold"}
      </button>
    </form>
  );
}

export default function TrainerSignupPaymentClient({
  foundingPricing,
  stripePublishableKey,
  stripeConfiguredOnServer,
}: Props) {
  const { publishableKey, loading: publishableLoading } = useStripePublishableKey(stripePublishableKey);
  const stripeConfigured = Boolean(publishableKey);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amountLabel, setAmountLabel] = useState<string>("…");
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  useEffect(() => {
    if (publishableLoading) return;
    if (!stripeConfigured) {
      setInitError(TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE);
      return;
    }
    if (!stripeConfiguredOnServer) {
      setInitError(TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE);
      return;
    }

    let cancelled = false;
    setLoadingIntent(true);
    setInitError(null);
    void fetch("/api/trainer/signup/create-payment-intent", {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d: { clientSecret?: string; totalCents?: number; error?: string }) => {
        if (cancelled) return;
        if (!d.clientSecret) {
          setInitError(d.error ?? TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE);
          return;
        }
        setClientSecret(d.clientSecret);
        if (typeof d.totalCents === "number" && d.totalCents > 0) {
          setAmountLabel(`$${(d.totalCents / 100).toFixed(2)}`);
        }
      })
      .catch(() => {
        if (!cancelled) setInitError(TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE);
      })
      .finally(() => {
        if (!cancelled) setLoadingIntent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publishableLoading, stripeConfigured, stripeConfiguredOnServer]);

  const options: StripeElementsOptions | undefined = clientSecret
    ? { clientSecret, appearance: { theme: "night", variables: { colorPrimary: "#FF7E00" } } }
    : undefined;

  const loading = publishableLoading || loadingIntent;

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
          <li>Your card receives a temporary hold for the total shown below (not an immediate charge).</li>
          <li>You continue onboarding in your dashboard — certification upload, tax forms, background screening.</li>
          <li>
            Match Fit captures the fee only after certification and background screening are approved. If screening is
            not approved, only the platform portion of the hold may be captured; the rest is released.
          </li>
        </ol>

        <div className="mt-8">
          {loading ? (
            <p className="text-sm text-white/50">{TRAINER_SIGNUP_PAYMENT_LOADING_MESSAGE}</p>
          ) : initError ? (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-4 text-sm leading-relaxed text-rose-100/95">
              <p>{initError}</p>
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
            <Elements stripe={stripePromise} options={options}>
              <PaymentForm amountLabel={amountLabel} foundingPricing={foundingPricing} />
            </Elements>
          ) : null}
        </div>
      </div>
    </main>
  );
}
