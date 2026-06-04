"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";

function CheckoutRedirect() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/client/billing/create-subscription", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reactivation: true }),
        });
        const data = (await res.json()) as { error?: string; url?: string };
        if (cancelled) return;
        if (!res.ok || !data.url) {
          setError(data.error ?? "Could not start checkout.");
          return;
        }
        navigateWithFullLoad(data.url);
      } catch {
        if (!cancelled) setError("Network error. Try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased">
      <div className="relative z-10 mx-auto max-w-lg px-5 py-12 sm:px-8">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Secure checkout</h1>
        {error ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
              {error}
            </p>
            <Link href="/client/reactivate" className="text-sm font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
              Back to reactivation
            </Link>
          </div>
        ) : (
          <p className="mt-6 text-sm text-white/60">Redirecting to Stripe to connect your card and reactivate…</p>
        )}
      </div>
    </main>
  );
}

export default function ClientReactivateCheckoutPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#0B0C0F]" aria-hidden />}>
      <CheckoutRedirect />
    </Suspense>
  );
}
