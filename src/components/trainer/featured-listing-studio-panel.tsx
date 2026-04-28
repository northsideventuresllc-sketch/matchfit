"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FEATURED_RULES_VERSION } from "@/lib/featured-rules-version";

type ListingGet =
  | {
      eligible: true;
      regionZipPrefix: string;
      entryDisplayDayKey: string;
      easternCutoffUtcMs: number;
      easternTodayKey: string;
      rulesVersion: string;
      raffle: { entered: boolean; ticketWeight: number | null; copy: string };
      bids: {
        leaderboard: { trainerId: string; amountCents: number; isYou: boolean }[];
        myAmountCents: number | null;
        myRulesAcceptedAt: string | null;
        minNextBidCents: number;
      };
    }
  | {
      eligible: false;
      reason: string;
      message: string;
      rulesVersion: string;
    };

function formatUsd(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "Closed for this window.";
  const h = Math.floor(msRemaining / 3_600_000);
  const m = Math.floor((msRemaining % 3_600_000) / 60_000);
  const s = Math.floor((msRemaining % 60_000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

export function FeaturedListingStudioPanel() {
  const [data, setData] = useState<ListingGet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [bidDollars, setBidDollars] = useState("25");

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/trainer/featured-listing", { cache: "no-store" });
      const j = (await res.json()) as ListingGet & { error?: string };
      if (!res.ok) {
        setLoadError(j.error ?? "Could not load.");
        return;
      }
      setData(j as ListingGet);
    } catch {
      setLoadError("Network error.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const msLeft = useMemo(() => {
    if (!data || !("easternCutoffUtcMs" in data)) return 0;
    return data.easternCutoffUtcMs - Date.now();
  }, [data, tick]);

  async function enterRaffle() {
    if (!data || !("regionZipPrefix" in data)) return;
    setBusy(true);
    setFormError(null);
    setOk(null);
    try {
      const res = await fetch("/api/trainer/featured-listing/raffle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptOfficialRules: true,
          rulesVersion: FEATURED_RULES_VERSION,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFormError(j.error ?? "Could not enter.");
        return;
      }
      setOk("You’re in the raffle for this window.");
      await load();
    } catch {
      setFormError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function submitBid() {
    if (!data || !("regionZipPrefix" in data)) return;
    const raw = bidDollars.trim().replace(/[^0-9.]/g, "");
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      setFormError("Enter a valid dollar amount.");
      return;
    }
    const amountCents = Math.round(n * 100);
    setBusy(true);
    setFormError(null);
    setOk(null);
    try {
      const res = await fetch("/api/trainer/featured-listing/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          rulesVersion: FEATURED_RULES_VERSION,
          acceptSponsoredPlacementTerms: true,
          acceptNonRefundableCharges: true,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFormError(j.error ?? "Could not save bid.");
        return;
      }
      setOk("Bid recorded for this window.");
      await load();
    } catch {
      setFormError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/70 p-5">
        <p className="text-sm text-[#FFB4B4]">{loadError}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/70 p-5">
        <p className="text-sm text-white/50">Loading featured listing…</p>
      </section>
    );
  }

  if (!data.eligible) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/70 p-5">
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#FF7E00]/90">Featured home placement</h2>
        <p className="mt-2 text-sm text-white/65">{data.message}</p>
        <p className="mt-3 text-xs text-white/40">
          Rules version {data.rulesVersion}. See{" "}
          <Link href="/terms#featured-placement" className="text-[#FF7E00] underline-offset-2 hover:underline">
            Terms — Featured placement
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#0E1016]/70 p-5">
      <div>
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#FF7E00]/90">Featured home placement</h2>
        <p className="mt-2 text-xs text-white/45">
          Premium-only. Regional pool <span className="font-semibold text-white/70">ZIP prefix {data.regionZipPrefix}**</span> ·
          Display day <span className="font-semibold text-white/70">{data.entryDisplayDayKey}</span> (America/New_York cutoff).
        </p>
        <p className="mt-2 text-xs font-semibold text-[#FFD34E]/90">{formatCountdown(msLeft)}</p>
      </div>

      {formError ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-3 py-2 text-sm text-[#FFB4B4]" role="alert">
          {formError}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100" role="status">
          {ok}
        </p>
      ) : null}

      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
        <h3 className="text-xs font-black uppercase tracking-[0.12em] text-white/55">Official rules (summary)</h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] leading-relaxed text-white/45">
          <li>
            <strong className="text-white/60">Raffle:</strong> no extra fee beyond Premium Page; you receive five tickets in the
            weighted draw; winners are random among entrants in the same three-digit ZIP area; odds depend on how many
            coaches enter.
          </li>
          <li>
            <strong className="text-white/60">Alternate method of entry (AMOE):</strong> email Match Fit support from
            your trainer account email with subject line “Featured raffle AMOE” during the same window — one free raffle
            entry (void where prohibited). Use the contact channel published in the product footer or your account notices.
          </li>
          <li>
            <strong className="text-white/60">Paid spots:</strong> two highest binding bids per region per day are{" "}
            <em>sponsored placements</em>, not gambling; you are buying advertising visibility. Bids are not refunds once the
            window locks. Card charges may post when coach billing is connected; amounts are binding today.
          </li>
          <li>
            Match Fit may modify or end this program; void where prohibited; you must comply with marketing laws in your
            jurisdiction.
          </li>
        </ul>
        <p className="mt-2 text-[10px] text-white/35">
          Not legal advice. See{" "}
          <Link href="/terms#featured-placement" className="text-[#FF7E00] underline-offset-2 hover:underline">
            Terms — Featured placement
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] p-4">
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-white/55">Daily raffle</h3>
          <p className="mt-2 text-[11px] leading-relaxed text-white/45">{data.raffle.copy}</p>
          <p className="mt-2 text-xs text-white/55">
            Status:{" "}
            <span className="font-semibold text-white/80">{data.raffle.entered ? "Entered" : "Not entered yet"}</span>
          </p>
          <button
            type="button"
            disabled={busy || data.raffle.entered || msLeft <= 0}
            onClick={() => void enterRaffle()}
            className="mt-3 w-full rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/12 px-3 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:border-[#FF7E00]/55 disabled:opacity-40"
          >
            {data.raffle.entered ? "Entered" : "Enter raffle"}
          </button>
        </div>

        <div className="rounded-xl border border-white/[0.06] p-4">
          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-white/55">Sponsored bid (top 2)</h3>
          <p className="mt-2 text-[11px] text-white/45">
            Minimum next total for you: <span className="font-semibold text-white/75">{formatUsd(data.bids.minNextBidCents)}</span>
            {data.bids.myAmountCents != null ? (
              <>
                {" "}
                · Your current bid:{" "}
                <span className="font-semibold text-white/75">{formatUsd(data.bids.myAmountCents)}</span>
              </>
            ) : null}
          </p>
          <label className="mt-3 block text-[10px] font-bold uppercase tracking-wide text-white/40">
            New total bid (USD)
            <input
              value={bidDollars}
              onChange={(e) => setBidDollars(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#12151C] px-3 py-2 text-sm text-white outline-none ring-[#FF7E00]/30 focus-visible:ring-2"
              inputMode="decimal"
            />
          </label>
          <button
            type="button"
            disabled={busy || msLeft <= 0}
            onClick={() => void submitBid()}
            className="mt-3 w-full rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_55%,#E32B2B_100%)] px-3 py-2 text-xs font-black uppercase tracking-wide text-[#0B0C0F] disabled:opacity-40"
          >
            Place / raise bid
          </button>
          <div className="mt-3 max-h-28 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/25 p-2">
            <p className="text-[10px] font-bold uppercase text-white/35">Leaderboard</p>
            <ul className="mt-1 space-y-1 text-[11px] text-white/55">
              {data.bids.leaderboard.length === 0 ? <li>No bids yet.</li> : null}
              {data.bids.leaderboard.map((b, i) => (
                <li key={b.trainerId} className="flex justify-between gap-2">
                  <span>
                    #{i + 1}
                    {b.isYou ? " · You" : ""}
                  </span>
                  <span className="shrink-0 font-mono text-white/75">{formatUsd(b.amountCents)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
