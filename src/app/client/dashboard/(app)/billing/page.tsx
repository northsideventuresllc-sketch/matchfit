import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientBillingPageClient } from "./client-billing-page-client";

export const metadata: Metadata = {
  title: "Billing | Client | Match Fit",
};

export default function ClientBillingPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Account</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] sm:text-4xl">Billing settings</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Review renewal dates, update cards, and manage cancellation. Payment methods are edited inside Stripe&apos;s
          hosted billing portal for PCI compliance.
        </p>
      </header>
      <Suspense fallback={<p className="text-center text-sm text-white/45">Loading…</p>}>
        <ClientBillingPageClient />
      </Suspense>
    </div>
  );
}
