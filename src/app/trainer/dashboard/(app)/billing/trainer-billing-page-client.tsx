"use client";

import { useEffect, useState } from "react";

type Summary = {
  mode: "placeholder";
  email: string;
  message: string;
};

export function TrainerBillingPageClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/trainer/billing/summary");
        const data = (await res.json()) as Summary & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load billing.");
          return;
        }
        setSummary({
          mode: data.mode,
          email: data.email,
          message: data.message,
        });
      } catch {
        if (!cancelled) setError("Could not load billing.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
        {error}
      </p>
    );
  }

  if (!summary) {
    return <p className="text-center text-sm text-white/45">Loading billing…</p>;
  }

  return (
    <div className="space-y-6 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 sm:p-8">
      <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]/90">Account</p>
      <p className="text-center text-sm leading-relaxed text-white/60">{summary.message}</p>
      <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/60 px-4 py-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Account email on file</p>
        <p className="mt-1 text-sm font-medium text-white/85">{summary.email}</p>
      </div>
      <p className="text-center text-xs text-white/40">
        When Stripe billing for coaches is enabled, you will open a secure portal from here to update cards and
        download receipts—similar to the client billing experience.
      </p>
    </div>
  );
}
