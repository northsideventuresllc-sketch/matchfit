"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { TRAINER_SIGNUP_AGREEMENT_DOCUMENT } from "@/app/trainer/onboarding/trainer-agreement-bullets";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

export default function TrainerSignupTermsClient() {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accepted) {
      setError("Please confirm that you agree to the Trainer Agreement and Terms of Service.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/signup/terms", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedTrainerAgreement: true }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save your agreement.");
        setBusy(false);
        return;
      }
      navigateWithFullLoad(data.next ?? "/trainer/signup/payment");
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/trainer/signup" className="inline-flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-lg">
            <Image src="/logo.png" alt="Match Fit" fill className="object-contain" sizes="40px" />
          </div>
          <span className="text-sm font-bold text-white/70">Back to account details</span>
        </Link>

        <h1 className="mt-8 text-2xl font-black uppercase tracking-tight sm:text-3xl">Trainer agreement</h1>
        <p className="mt-2 text-sm text-white/55">
          Read the summary below, then open the full Terms of Service and Privacy Policy for complete platform rules,
          fees, and enforcement policies.
        </p>

        <article className="mt-6 max-h-[min(50vh,28rem)] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-5 text-sm leading-relaxed text-white/70">
          {TRAINER_SIGNUP_AGREEMENT_DOCUMENT.split("\n\n").map((para, i) => (
            <p key={i} className={i > 0 ? "mt-4" : undefined}>
              {para}
            </p>
          ))}
        </article>

        <p className="mt-4 text-xs text-white/45">
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#FF7E00] hover:underline">
            Terms of Service
          </Link>
          {" · "}
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#FF7E00] hover:underline">
            Privacy Policy
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${inputClass}`}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-[#FF7E00]"
            />
            <span className="text-sm leading-relaxed text-white/80">
              I have read and agree to the Trainer Agreement, Terms of Service, and Privacy Policy.
            </span>
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="flex min-h-[3rem] w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-60"
          >
            {busy ? "Saving…" : "Continue to payment"}
          </button>
        </form>
      </div>
    </main>
  );
}
