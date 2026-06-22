"use client";

import Link from "next/link";
import type { ClientPlanStatus } from "@/lib/client-plan-status";
import {
  CLIENT_BETA_VIP_TRIAL_DAYS,
  CLIENT_FREE_PLAN_LABEL,
  CLIENT_VIP_PLAN_LABEL,
  clientVipPriceLabel,
} from "@/lib/client-plan-copy";

export function ClientPlanStatusBanner({ plan }: { plan: ClientPlanStatus }) {
  if (plan.displayTier === "vip") {
    return (
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90">
        <span className="font-bold uppercase tracking-[0.08em]">{CLIENT_VIP_PLAN_LABEL}</span> is active — full platform
        access unlocked.
      </div>
    );
  }

  if (plan.displayTier === "vip_trial") {
    return (
      <div className="rounded-2xl border border-[#FFD34E]/30 bg-[#FFD34E]/10 px-4 py-3 text-sm text-[#FFE9A8]">
        <span className="font-bold uppercase tracking-[0.08em]">Beta VIP trial</span> — you have full access for{" "}
        {plan.trialDaysRemaining != null ? (
          <span className="font-semibold text-white">{plan.trialDaysRemaining} day(s)</span>
        ) : (
          <span className="font-semibold text-white">{CLIENT_BETA_VIP_TRIAL_DAYS} days</span>
        )}{" "}
        after sign-up. After that, your account moves to the {CLIENT_FREE_PLAN_LABEL} plan unless you subscribe to VIP.
        <Link href="/client/dashboard/billing" className="ml-1 font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
          View plans
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
      You are on the <span className="font-bold text-white/90">{CLIENT_FREE_PLAN_LABEL}</span> plan with limited discovery
      and no chat or booking. Upgrade to <span className="font-bold text-[#FFD34E]">{CLIENT_VIP_PLAN_LABEL}</span> for{" "}
      {clientVipPriceLabel()}/month to unlock everything.
      <Link href="/client/dashboard/billing" className="ml-1 font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
        Upgrade
      </Link>
    </div>
  );
}
