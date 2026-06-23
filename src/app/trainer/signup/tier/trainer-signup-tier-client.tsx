"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { TrainerSignupShell } from "@/components/trainer/trainer-signup-shell";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { FP_TIER_DISPLAY_NAMES, isFpAccountTier, type FpAccountTier } from "@/lib/fp-account-tier-types";
import {
  FP_BETA_PREMIUM_PRO_STICKER,
  fpBetaSignupActive,
  fpTierRequiresPaidSubscriptionDuringBeta,
  fpTierSignupCardsForDisplay,
} from "@/lib/fp-tier-beta-signup";

const cardClass =
  "w-full rounded-2xl border border-white/10 bg-[#12141C]/90 p-6 text-left transition hover:border-[#FF7E00]/50 focus:border-[#FF7E00] focus:outline-none focus:ring-2 focus:ring-[#FF7E00]/40 disabled:opacity-50";

const primaryCardClass =
  "relative w-full overflow-hidden rounded-2xl border border-[#FF7E00]/45 bg-[linear-gradient(160deg,rgba(255,126,0,0.18),rgba(18,20,28,0.95))] p-6 text-left shadow-[0_24px_60px_-30px_rgba(255,126,0,0.45)] transition hover:border-[#FF7E00] focus:border-[#FF7E00] focus:outline-none focus:ring-2 focus:ring-[#FF7E00]/40 disabled:opacity-50";

export default function TrainerSignupTierClient() {
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FpAccountTier | null>(null);
  const beta = fpBetaSignupActive();
  const cards = fpTierSignupCardsForDisplay();
  const premiumCard = cards.find((c) => c.tier === "match_fit_premium_pro");
  const paidCards = cards.filter((c) => c.tier !== "match_fit_premium_pro");

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const tierRaw = searchParams.get("tier");
    if (checkout === "success" && tierRaw && isFpAccountTier(tierRaw)) {
      void continueWithTier(tierRaw, true);
    }
  }, [searchParams]);

  async function continueWithTier(tier: FpAccountTier, afterCheckout = false) {
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
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        next?: string;
        requiresCheckout?: boolean;
        checkoutUrl?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not save your account type.");
        return;
      }
      if (data.requiresCheckout && data.checkoutUrl && !afterCheckout) {
        window.location.href = data.checkoutUrl;
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
    <TrainerSignupShell
      stepLabel="Step 3"
      title="Choose Account Type"
      description={
        beta
          ? "Beta users start on Match Fit Premium Pro at no cost for 60 days. Independent Fitness Pro and Elite Fitness Pro require a paid subscription."
          : "Pick the Fitness Pro account type that fits how you want to train on Match Fit."
      }
      backHref="/trainer/signup/terms"
      backLabel="Back to Agreement"
    >
      {premiumCard ? (
        <div className="space-y-3">
          <button
            type="button"
            disabled={busy}
            className={`${primaryCardClass} ${selected === premiumCard.tier ? "ring-2 ring-[#FF7E00]" : ""}`}
            onClick={() => void continueWithTier(premiumCard.tier)}
          >
            {beta ? (
              <span className="absolute right-4 top-4 max-w-[11rem] rounded-lg border border-[#FFD34E]/40 bg-[#FFD34E]/15 px-2 py-1 text-[10px] font-black uppercase leading-tight tracking-wide text-[#FFD34E]">
                {FP_BETA_PREMIUM_PRO_STICKER}
              </span>
            ) : null}
            <h2 className="text-xl font-semibold">{premiumCard.title}</h2>
            <p className="mt-2 text-sm text-white/70">{premiumCard.subtitle}</p>
            <p className="mt-4 text-sm font-semibold text-[#FF7E00]">
              {beta ? "Complimentary for beta users" : premiumCard.feeLabel}
            </p>
          </button>
        </div>
      ) : null}

      {paidCards.length > 0 ? (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            {beta ? "Paid account types" : "Other paths"}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {paidCards.map((card) => (
              <button
                key={card.tier}
                type="button"
                disabled={busy}
                className={`${cardClass} ${selected === card.tier ? "border-[#FF7E00]" : ""}`}
                onClick={() => void continueWithTier(card.tier)}
              >
                <h2 className="text-lg font-semibold">{card.title}</h2>
                <p className="mt-2 text-sm text-white/70">{card.subtitle}</p>
                <p className="mt-4 text-sm font-medium text-[#FF7E00]">
                  {fpTierRequiresPaidSubscriptionDuringBeta(card.tier) && beta
                    ? `${card.feeLabel} · subscription required`
                    : card.feeLabel}
                </p>
                {card.backgroundCheck ? (
                  <p className="mt-1 text-xs text-white/50">Background check required</p>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {beta ? (
        <p className="mt-6 text-xs text-white/45">
          Match Fit Pro is not offered during beta. Your complimentary tier is{" "}
          {FP_TIER_DISPLAY_NAMES.match_fit_premium_pro}.
        </p>
      ) : null}

      {error ? <p className="mt-6 text-sm text-red-400">{error}</p> : null}
    </TrainerSignupShell>
  );
}
