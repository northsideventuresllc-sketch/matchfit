import type { Metadata } from "next";
import type { ReactNode } from "react";
import { connectDemoStyles } from "@/lib/stripe-connect/demo-styles";

export const metadata: Metadata = {
  title: "Stripe Connect Sample | Match Fit",
  description: "Sample V2 Connect onboarding, storefront, and platform subscriptions.",
};

export default function StripeConnectDemoLayout({ children }: { children: ReactNode }) {
  return (
    <div className={connectDemoStyles.page}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.12),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6">{children}</div>
    </div>
  );
}
