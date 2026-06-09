"use client";

import Image from "next/image";
import Link from "next/link";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { useStripePublishableKey } from "@/lib/use-stripe-publishable-key";

function BackgroundEscrowForm({
  amountLabel,
  onComplete,
}: {
  amountLabel: string;
  onComplete: (next?: string) => void;
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
      const res = await fetch("/api/trainer/signup/confirm-background-escrow", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: piId }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error ?? "Authorization succeeded but we could not update your account.");
        return;
      }
      onComplete(data.next);
    } catch {
      setError("Something went wrong while processing your card authorization.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4 text-left">
      <p className="text-sm text-white/60">
        One more step: authorize the background screening hold ({amountLabel}). Match Fit captures this when Checkr
        screening runs.
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
        {submitting ? "Authorizing…" : "Place background screening hold"}
      </button>
    </form>
  );
}

export default function TrainerSignupPaymentReturnClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id")?.trim() ?? "";
  const { publishableKey } = useStripePublishableKey();
  const [error, setError] = useState<string | null>(null);
  const [needsBackgroundCheckAuthorization, setNeedsBackgroundCheckAuthorization] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amountLabel, setAmountLabel] = useState("…");

  const stripePromise = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), [publishableKey]);
  const options: StripeElementsOptions | undefined = clientSecret
    ? { clientSecret, appearance: { theme: "night", variables: { colorPrimary: "#FF7E00" } } }
    : undefined;

  useEffect(() => {
    if (!sessionId) {
      router.replace("/trainer/signup/payment");
      return;
    }

    let cancelled = false;
    void fetch("/api/trainer/signup/confirm-checkout-session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (res) => {
        const data = (await res.json()) as {
          error?: string;
          next?: string;
          needsBackgroundCheckAuthorization?: boolean;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "We could not confirm your signup fee authorization.");
          return;
        }
        if (data.needsBackgroundCheckAuthorization) {
          setNeedsBackgroundCheckAuthorization(true);
          const escrowRes = await fetch("/api/trainer/signup/retrieve-background-escrow-intent", {
            method: "POST",
            credentials: "include",
          });
          const escrowData = (await escrowRes.json()) as {
            clientSecret?: string;
            amountCents?: number;
            error?: string;
          };
          if (!escrowRes.ok || !escrowData.clientSecret) {
            setError(escrowData.error ?? "Could not load background screening authorization.");
            return;
          }
          setClientSecret(escrowData.clientSecret);
          if (typeof escrowData.amountCents === "number" && escrowData.amountCents > 0) {
            setAmountLabel(`$${(escrowData.amountCents / 100).toFixed(2)}`);
          }
          return;
        }
        navigateWithFullLoad(data.next ?? "/trainer/dashboard");
      })
      .catch(() => {
        if (!cancelled) {
          setError("Something went wrong while confirming your authorization. Try the payment step again.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router, sessionId]);

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-lg text-center">
        <Link href="/trainer/signup/payment" className="inline-flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-lg">
            <Image src="/logo.png" alt="Match Fit" fill className="object-contain" sizes="40px" />
          </div>
        </Link>
        <h1 className="mt-8 text-2xl font-black uppercase tracking-tight">
          {needsBackgroundCheckAuthorization ? "One more authorization" : "Confirming authorization"}
        </h1>
        {error ? (
          <div className="mt-6 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100/95">
            <p>{error}</p>
            <Link href="/trainer/signup/payment" className="mt-4 inline-block font-semibold text-white underline-offset-2 hover:underline">
              Return to payment step
            </Link>
          </div>
        ) : needsBackgroundCheckAuthorization && clientSecret && stripePromise && options ? (
          <Elements stripe={stripePromise} options={options}>
            <BackgroundEscrowForm
              amountLabel={amountLabel}
              onComplete={(next) => navigateWithFullLoad(next ?? "/trainer/dashboard")}
            />
          </Elements>
        ) : (
          <p className="mt-4 text-sm text-white/55">Finishing your signup fee hold…</p>
        )}
      </div>
    </main>
  );
}
