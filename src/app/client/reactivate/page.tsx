"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { TurnstileField } from "@/components/turnstile-field";
import { useTurnstileGate } from "@/hooks/use-turnstile-gate";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import {
  CLIENT_PAYMENT_GRACE_DAYS,
  CLIENT_PLATFORM_TRIAL_DAYS,
} from "@/lib/client-platform-trial-constants";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

function ReactivateContent() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const turnstile = useTurnstileGate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const tsErr = turnstile.validateBeforeSubmit();
    if (tsErr) {
      setError(tsErr);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/client/reactivate/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, ...turnstile.turnstileField() }),
      });
      const data = (await res.json()) as { error?: string; next?: string; code?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not verify your account.");
        turnstile.reset();
        return;
      }
      navigateWithFullLoad(data.next ?? "/client/reactivate/checkout");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased">
      <div className="relative z-10 mx-auto max-w-lg px-5 py-12 sm:px-8">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Reactivate your account</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/65">
          Match Fit accounts include a {CLIENT_PLATFORM_TRIAL_DAYS}-day free trial at sign-up, then{" "}
          {CLIENT_PAYMENT_GRACE_DAYS} days to add a card. After that grace period ends without payment, access is
          deactivated. Reactivation requires payment and a connected card — a new free trial is not offered.
        </p>

        {error ? (
          <p className="mt-6 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wide text-white/45">
            Email, username, or phone
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={`${inputClass} mt-2`}
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wide text-white/45">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} mt-2`}
              autoComplete="current-password"
              required
            />
          </label>
          <TurnstileField
            enabled={turnstile.enabled}
            widgetRef={turnstile.ref}
            siteKey={turnstile.siteKey}
            onReady={turnstile.onTurnstileReady}
            onError={turnstile.onTurnstileError}
            onExpire={turnstile.onTurnstileExpire}
            widgetError={turnstile.widgetError}
            ready={turnstile.ready}
            className="flex justify-center"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex min-h-[3rem] w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-45"
          >
            {busy ? "Working…" : "Continue to payment"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-white/40">
          <Link href="/client/sign-up" className="underline-offset-2 hover:text-white/60 hover:underline">
            New to Match Fit? Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ClientReactivatePage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#0B0C0F]" aria-hidden />}>
      <ReactivateContent />
    </Suspense>
  );
}
