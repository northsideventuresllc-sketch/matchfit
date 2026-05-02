"use client";

import Link from "next/link";
import { useState } from "react";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";

type Props = {
  trainerUsername: string;
  serviceId: string;
  variationId?: string;
  bundleTierId?: string;
  summaryLine: string;
  serviceSubtotalLabel: string;
  adminFeeLabel: string;
  totalLabel: string;
  canceled?: boolean;
};

export function CoachServiceCheckoutClient(props: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/trainers/${encodeURIComponent(props.trainerUsername)}/service-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: props.serviceId,
          ...(props.variationId ? { variationId: props.variationId } : {}),
          ...(props.bundleTierId ? { bundleTierId: props.bundleTierId } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string; url?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout.");
        return;
      }
      navigateWithFullLoad(data.url);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const profileHref = `/trainers/${encodeURIComponent(props.trainerUsername)}`;

  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-10 text-white antialiased sm:px-8">
      <div className="mx-auto max-w-lg">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FF7E00]/90">Secure checkout</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Confirm your purchase</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          You&apos;ll finish payment on Stripe&apos;s hosted page. The total includes the coach&apos;s package price plus
          Match Fit&apos;s administrative fee (shown as a separate line in Stripe).
        </p>

        {props.canceled ? (
          <p className="mt-6 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white/70" role="status">
            Checkout was canceled. You can try again below.
          </p>
        ) : null}

        {error ? (
          <p className="mt-6 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-8 space-y-4 rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Package</p>
          <p className="text-sm leading-snug text-white/88">{props.summaryLine}</p>
          <div className="border-t border-white/[0.06] pt-4 text-sm text-white/75">
            <div className="flex justify-between gap-3">
              <span>Service subtotal</span>
              <span className="font-semibold text-white">{props.serviceSubtotalLabel}</span>
            </div>
            <div className="mt-2 flex justify-between gap-3">
              <span>Administrative fee (20%)</span>
              <span className="font-semibold text-white">{props.adminFeeLabel}</span>
            </div>
            <div className="mt-3 flex justify-between gap-3 border-t border-white/[0.06] pt-3 text-base font-black text-white">
              <span>Total</span>
              <span>{props.totalLabel}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void startCheckout()}
          className="mt-8 inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#FF7E00_0%,#E32B2B_100%)] px-5 text-sm font-black uppercase tracking-[0.1em] text-white shadow-[0_16px_40px_-12px_rgba(255,126,0,0.55)] transition hover:brightness-110 disabled:opacity-45"
        >
          {busy ? "Starting checkout…" : "Continue to Stripe checkout"}
        </button>

        <p className="mt-6 text-center text-xs text-white/40">
          <Link href={profileHref} className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
            Back to coach profile
          </Link>
          {" · "}
          <Link href="/client/dashboard" className="underline-offset-2 hover:text-white/60 hover:underline">
            Dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
