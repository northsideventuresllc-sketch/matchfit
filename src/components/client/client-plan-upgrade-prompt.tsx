"use client";

import Link from "next/link";
import { useState } from "react";
import { freemiumGateMessage } from "@/lib/client-plan-copy";
import { clientVipPriceLabel } from "@/lib/client-plan-copy";

type Props = {
  errorCode: string;
  onDismiss?: () => void;
  compact?: boolean;
};

export function ClientPlanUpgradePrompt({ errorCode, onDismiss, compact = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const message = freemiumGateMessage(errorCode);

  async function startVipCheckout() {
    setBusy(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/client/billing/vip-checkout", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setCheckoutError(data.error ?? "Could not start VIP checkout.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setCheckoutError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={
        compact
          ? "rounded-2xl border border-[#FF7E00]/30 bg-[#FF7E00]/10 px-4 py-4"
          : "rounded-3xl border border-[#FF7E00]/30 bg-[#12151C]/90 px-5 py-6 sm:px-7"
      }
      role="alert"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FFD34E]">Free plan limit</p>
      <p className="mt-2 text-base font-bold text-white">{message.title}</p>
      <p className="mt-2 text-sm leading-relaxed text-white/65">{message.body}</p>
      <p className="mt-3 text-xs text-white/45">
        VIP is {clientVipPriceLabel()} per month and unlocks full discovery, chat, booking, and FitHub.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={busy}
          onClick={() => void startVipCheckout()}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-5 text-xs font-black uppercase tracking-[0.08em] text-[#0B0C0F] disabled:opacity-50"
        >
          {busy ? "Opening checkout…" : "Upgrade to VIP"}
        </button>
        <Link
          href="/client/dashboard/billing"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-5 text-xs font-black uppercase tracking-[0.08em] text-white/85"
        >
          View billing
        </Link>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-xs font-semibold text-white/50 hover:text-white/75"
          >
            Dismiss
          </button>
        ) : null}
      </div>
      {checkoutError ? <p className="mt-3 text-sm text-rose-300">{checkoutError}</p> : null}
    </div>
  );
}
