"use client";

import Image from "next/image";
import Link from "next/link";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { getStripePublishableKey } from "@/lib/stripe-publishable";

type Props = {
  foundingPricing: boolean;
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
        setError("Payment completed but no payment id was returned.");
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
        setError(data.error ?? "Payment succeeded but we could not update your account. Contact support.");
        return;
      }
      navigateWithFullLoad(data.next ?? "/trainer/dashboard");
    } catch {
      setError("Something went wrong while processing payment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <p className="text-sm leading-relaxed text-white/65">
        {foundingPricing ? (
          <>
            Founding coach pricing: you authorize the estimated background screening fee plus a 20% platform
            surcharge and card processing. Match Fit captures this amount only after your certification and
            background check are approved.
          </>
        ) : (
          <>
            You authorize the $100.00 platform registration fee plus card processing. Match Fit captures this
            amount only after your certification and background check are approved.
          </>
        )}
      </p>
      <p className="text-sm text-white/80">
        Total due now: <span className="font-semibold text-[#FFD34E]">{amountLabel}</span>
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
        {submitting ? "Processing…" : "Authorize signup fee"}
      </button>
    </form>
  );
}

export default function TrainerSignupPaymentClient({ foundingPricing }: Props) {
  const publishableKey = getStripePublishableKey();
  const stripeConfigured = Boolean(publishableKey);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amountLabel, setAmountLabel] = useState<string>("…");
  const [loading, setLoading] = useState(stripeConfigured);
  const [initError, setInitError] = useState<string | null>(
    stripeConfigured ? null : "Stripe is not configured for this environment.",
  );

  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  useEffect(() => {
    if (!stripeConfigured) return;
    let cancelled = false;
    void fetch("/api/trainer/signup/create-payment-intent", {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d: { clientSecret?: string; totalCents?: number; error?: string }) => {
        if (cancelled) return;
        if (!d.clientSecret) {
          setInitError(d.error ?? "Could not initialize payment.");
          return;
        }
        setClientSecret(d.clientSecret);
        if (typeof d.totalCents === "number" && d.totalCents > 0) {
          setAmountLabel(`$${(d.totalCents / 100).toFixed(2)}`);
        }
      })
      .catch(() => {
        if (!cancelled) setInitError("Could not reach the payment server.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stripeConfigured]);

  const options: StripeElementsOptions | undefined = clientSecret
    ? { clientSecret, appearance: { theme: "night", variables: { colorPrimary: "#FF7E00" } } }
    : undefined;

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-lg">
        <Link href="/trainer/signup/terms" className="inline-flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-lg">
            <Image src="/logo.png" alt="Match Fit" fill className="object-contain" sizes="40px" />
          </div>
          <span className="text-sm font-bold text-white/70">Back to agreement</span>
        </Link>

        <h1 className="mt-8 text-2xl font-black uppercase tracking-tight">Trainer signup fee</h1>
        <p className="mt-2 text-sm text-white/55">
          Your card is authorized today. Match Fit captures the fee only after certification and background
          screening are approved.
        </p>

        <div className="mt-8">
          {loading ? (
            <p className="text-sm text-white/50">Loading secure checkout…</p>
          ) : initError ? (
            <p className="text-sm text-rose-300">{initError}</p>
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
