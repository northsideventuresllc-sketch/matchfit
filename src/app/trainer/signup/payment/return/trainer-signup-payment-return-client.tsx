"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";

export default function TrainerSignupPaymentReturnClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id")?.trim() ?? "";
  const [error, setError] = useState<string | null>(null);

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
        const data = (await res.json()) as { error?: string; next?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "We could not confirm your signup fee authorization.");
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
        <h1 className="mt-8 text-2xl font-black uppercase tracking-tight">Confirming authorization</h1>
        {error ? (
          <div className="mt-6 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100/95">
            <p>{error}</p>
            <Link href="/trainer/signup/payment" className="mt-4 inline-block font-semibold text-white underline-offset-2 hover:underline">
              Return to payment step
            </Link>
          </div>
        ) : (
          <p className="mt-4 text-sm text-white/55">Finishing your signup fee hold…</p>
        )}
      </div>
    </main>
  );
}
