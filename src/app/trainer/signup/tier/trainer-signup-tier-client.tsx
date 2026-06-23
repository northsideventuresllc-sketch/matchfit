"use client";

import Link from "next/link";
import { useState } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { FP_TIER_SIGNUP_CARDS } from "@/lib/fp-tier-signup-cards";
import type { FpAccountTier } from "@/lib/fp-account-tier-types";

const cardClass =
  "rounded-2xl border border-white/10 bg-[#12141C] p-6 text-left transition hover:border-[#FF7E00]/50 focus:border-[#FF7E00] focus:outline-none focus:ring-2 focus:ring-[#FF7E00]/40";

export default function TrainerSignupTierClient() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FpAccountTier | null>(null);

  async function continueWithTier(tier: FpAccountTier) {
    setSelected(tier);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/signup/select-tier", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save your account type.");
        return;
      }
      navigateWithFullLoad(data.next ?? "/trainer/signup/docs");
    } catch {
      setError("Could not save your account type. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-white">
      <p className="text-xs font-medium uppercase tracking-widest text-[#FF7E00]">Step 3</p>
      <h1 className="mt-2 text-3xl font-semibold">Choose Your Path</h1>
      <p className="mt-2 text-white/70">
        Pick the Fitness Pro account type that fits how you want to train on Match Fit.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {FP_TIER_SIGNUP_CARDS.map((card) => (
          <button
            key={card.tier}
            type="button"
            disabled={busy}
            className={`${cardClass} ${selected === card.tier ? "border-[#FF7E00]" : ""}`}
            onClick={() => void continueWithTier(card.tier)}
          >
            <h2 className="text-lg font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm text-white/70">{card.subtitle}</p>
            <p className="mt-4 text-sm font-medium text-[#FF7E00]">{card.feeLabel}</p>
            {card.backgroundCheck ? (
              <p className="mt-1 text-xs text-white/50">Background check required</p>
            ) : null}
          </button>
        ))}
      </div>

      {error ? <p className="mt-6 text-sm text-red-400">{error}</p> : null}

      <p className="mt-10 text-sm text-white/50">
        <Link href="/trainer/signup/terms" className="text-[#FF7E00] hover:underline">
          Back to agreement
        </Link>
      </p>
    </div>
  );
}
