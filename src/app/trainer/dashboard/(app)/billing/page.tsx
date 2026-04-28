import type { Metadata } from "next";
import { Suspense } from "react";
import { TrainerBillingPageClient } from "./trainer-billing-page-client";

export const metadata: Metadata = {
  title: "Billing | Trainer | Match Fit",
};

export default function TrainerBillingPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Account</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Billing settings</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Review how Match Fit will handle coach subscriptions, Premium Page fees, and payouts. Card and invoice
          management will use Stripe&apos;s hosted billing portal once connected for trainers.
        </p>
      </header>
      <Suspense fallback={<p className="text-center text-sm text-white/45">Loading…</p>}>
        <TrainerBillingPageClient />
      </Suspense>
    </div>
  );
}
