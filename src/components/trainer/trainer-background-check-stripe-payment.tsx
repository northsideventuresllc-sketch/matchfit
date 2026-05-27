"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getStripePublishableKey } from "@/lib/stripe-publishable";

type Props = {
  amountLabel: string;
  onPaid: () => Promise<void>;
  onError: (message: string) => void;
};

function PaymentForm({ amountLabel, onPaid, onError }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    onError("");
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
      if (error) {
        onError(error.message ?? "Payment could not be completed.");
        return;
      }
      const piId = paymentIntent?.id;
      if (!piId) {
        onError("Payment completed but no payment id was returned.");
        return;
      }
      const res = await fetch("/api/trainer/onboarding/confirm-background-payment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: piId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        onError(data.error ?? "Payment succeeded but we could not update your account. Contact support.");
        return;
      }
      await onPaid();
    } catch {
      onError("Something went wrong while processing payment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <p className="text-sm text-white/65">
        Pay <span className="font-semibold text-white">{amountLabel}</span> for your background screening through
        Stripe. Card details are handled by Stripe — Match Fit does not store your full card number.
      </p>
      <div className="rounded-xl border border-white/[0.08] bg-[#0E1016]/90 px-3 py-4">
        <PaymentElement />
      </div>
      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="flex min-h-[3rem] w-full items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/15 px-4 text-sm font-black uppercase tracking-[0.1em] text-[#FFD34E] transition hover:border-[#FF7E00]/55 disabled:opacity-50"
      >
        {submitting ? "Processing…" : "Pay background check fee"}
      </button>
    </form>
  );
}

export function TrainerBackgroundCheckStripePayment({ amountLabel, onPaid, onError }: Props) {
  const publishableKey = getStripePublishableKey();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  useEffect(() => {
    if (!publishableKey) {
      queueMicrotask(() => {
        setLoading(false);
        onError(
          "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Add it to your environment to pay the background check fee.",
        );
      });
      return;
    }
    let cancelled = false;
    void fetch("/api/trainer/onboarding/create-payment-intent", {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d: { clientSecret?: string; error?: string }) => {
        if (cancelled) return;
        if (!d.clientSecret) {
          onError(d.error ?? "Could not initialize payment.");
          return;
        }
        setClientSecret(d.clientSecret);
      })
      .catch(() => {
        if (!cancelled) onError("Could not reach the payment server.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publishableKey, onError]);

  if (!publishableKey) {
    return (
      <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
        Stripe publishable key is missing. Set <code className="text-amber-50">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>{" "}
        in your environment.
      </p>
    );
  }

  if (loading || !clientSecret || !stripePromise) {
    return <p className="text-sm text-white/50">Loading secure payment…</p>;
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: "night",
      variables: {
        colorPrimary: "#FF7E00",
        colorBackground: "#0E1016",
        colorText: "#ffffff",
        borderRadius: "12px",
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm amountLabel={amountLabel} onPaid={onPaid} onError={onError} />
    </Elements>
  );
}
