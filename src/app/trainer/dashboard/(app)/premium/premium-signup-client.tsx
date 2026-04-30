"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PremiumSignupClient() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trainer/dashboard/premium/activate", { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not complete signup.");
        return;
      }
      router.push("/trainer/dashboard/premium");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 text-center">
      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mx-auto max-w-lg text-sm leading-relaxed text-white/55">
        Enrolling turns on the premium hub and per-area shortcuts. Checkout and plan details will connect here in a later
        release—this flow is for early access to the studio and token surfaces. A fuller breakdown sits below.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void activate()}
        className="group relative isolate mx-auto flex min-h-[3rem] w-full max-w-md items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
      >
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
        <span className="relative">{busy ? "Enrolling…" : "SIGN UP FOR PREMIUM PAGE"}</span>
      </button>
    </div>
  );
}
