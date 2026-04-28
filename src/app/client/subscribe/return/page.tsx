"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function MissingSession() {
  return (
    <div className="mt-6 space-y-4">
      <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
        Missing checkout session. Return here from Stripe after completing payment.
      </p>
      <p>
        <Link href="/client/subscribe" className="text-sm font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
          Back to subscribe
        </Link>
      </p>
    </div>
  );
}

function ConfirmCheckout({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/client/billing/confirm-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = (await res.json()) as { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setMessage(data.error ?? "Could not confirm your payment.");
          return;
        }
        router.push("/client/dashboard");
        router.refresh();
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Network error. Try again.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  if (status === "working") {
    return <p className="mt-6 text-sm text-white/60">Confirming your subscription…</p>;
  }

  return (
    <div className="mt-6 space-y-4">
      <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
        {message}
      </p>
      <p>
        <Link href="/client/subscribe" className="text-sm font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
          Back to subscribe
        </Link>
      </p>
    </div>
  );
}

function ReturnContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.12),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.08),transparent_50%)]"
      />
      <div className="relative z-10 mx-auto max-w-lg px-5 py-12 sm:px-8">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Finishing up</h1>
        {!sessionId ? <MissingSession /> : <ConfirmCheckout sessionId={sessionId} />}
      </div>
    </main>
  );
}

export default function SubscribeReturnPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-sm text-white/50 antialiased">Loading…</main>
      }
    >
      <ReturnContent />
    </Suspense>
  );
}
