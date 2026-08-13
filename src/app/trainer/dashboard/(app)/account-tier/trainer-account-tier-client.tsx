"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fpListingStatusLabel } from "@/lib/fp-account-tier-types";
import { fpTierSignupCardsForDisplay } from "@/lib/fp-tier-beta-signup";
import type { FpAccountTier } from "@/lib/fp-account-tier-types";

type AccountTierPayload = {
  accountTier: FpAccountTier | null;
  accountTierLabel: string | null;
  badge: string | null;
  listingStatus: string;
  tierSwitchLockActive: boolean;
  tierSwitchLockEndsAt: string | null;
  promoteTokensBalance: number;
  externalWebsiteUrl: string | null;
  eliteDashboardViewMode: string | null;
  listingStats: {
    profileViews: number;
    clickThroughs: number;
    reviewCountInternal: number;
    reviewCountExternal: number;
    memberSince: string;
    activeListingsCount: number;
  } | null;
  tierSwitchHistory: Array<{
    id: string;
    fromTierLabel: string | null;
    toTierLabel: string;
    switchedAt: string;
    initiatedBy: string;
  }>;
  promoteTokenLedger: Array<{
    id: string;
    action: string;
    amount: number;
    createdAt: string;
  }>;
  permissions: {
    click_stats_public: boolean;
    list_external_website: boolean;
    featured_listing: boolean;
  } | null;
};

export default function TrainerAccountTierClient() {
  const [data, setData] = useState<AccountTierPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [website, setWebsite] = useState("");
  const [checkoutNotice] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const result = new URLSearchParams(window.location.search).get("tierCheckout");
    if (result === "success") {
      return "Payment received. Your new account type is active — this can take a minute to show below.";
    }
    if (result === "cancel") {
      return "Checkout was cancelled. Your account type has not changed.";
    }
    return null;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("tierCheckout")) return;
    params.delete("tierCheckout");
    params.delete("tier");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchTier() {
      const res = await fetch("/api/trainer/dashboard/account-tier", { credentials: "include" });
      if (!res.ok) {
        if (!cancelled) setError("Could not load account type details.");
        return;
      }
      const json = (await res.json()) as AccountTierPayload;
      if (cancelled) return;
      setData(json);
      setWebsite(json.externalWebsiteUrl ?? "");
    }
    void fetchTier();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    const res = await fetch("/api/trainer/dashboard/account-tier", { credentials: "include" });
    if (!res.ok) {
      setError("Could not load account type details.");
      return;
    }
    const json = (await res.json()) as AccountTierPayload;
    setData(json);
    setWebsite(json.externalWebsiteUrl ?? "");
  }

  async function switchTier(targetTier: FpAccountTier) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trainer/dashboard/switch-tier", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTier }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        requiresCheckout?: boolean;
        checkoutUrl?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Could not switch account type.");
        return;
      }
      if (json.requiresCheckout && json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function setEliteView(viewMode: "match_fit_pro" | "independent_fitness_pro") {
    setBusy(true);
    try {
      await fetch("/api/trainer/dashboard/elite-view-mode", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewMode }),
      });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <p className="text-white/70">Loading account type…</p>;
  }

  const showStats = data.permissions?.click_stats_public;
  const lockLabel = data.tierSwitchLockActive && data.tierSwitchLockEndsAt
    ? `Switch available after ${new Date(data.tierSwitchLockEndsAt).toLocaleDateString()}`
    : null;
  const switchCards = fpTierSignupCardsForDisplay().filter((c) => c.tier !== data.accountTier);

  return (
    <div className="space-y-8 text-white">
      <div>
        <h1 className="text-2xl font-semibold">Account Type</h1>
        <p className="mt-1 text-white/60">Manage your Fitness Pro account type, listing status, and promote tokens.</p>
      </div>

      {checkoutNotice ? (
        <p className="rounded-xl border border-white/10 bg-[#12141C] px-4 py-3 text-sm text-white/80">{checkoutNotice}</p>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-[#12141C] p-6">
        <p className="text-xs uppercase tracking-widest text-[#FF7E00]">Current Account Type</p>
        <h2 className="mt-2 text-xl font-semibold">{data.accountTierLabel ?? "Not selected"}</h2>
        {data.badge ? <p className="mt-1 text-sm text-white/70">Badge: {data.badge}</p> : null}
        <p className="mt-2 text-sm text-white/60">Listing status: {fpListingStatusLabel(data.listingStatus)}</p>
        <p className="mt-1 text-sm text-white/60">Promote tokens: {data.promoteTokensBalance}</p>
      </section>

      {data.accountTier === "elite_fitness_pro" ? (
        <section className="rounded-2xl border border-white/10 bg-[#12141C] p-6">
          <h3 className="font-semibold">Elite Dual-View</h3>
          <p className="mt-1 text-sm text-white/60">Toggle dashboard context without losing history.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void setEliteView("match_fit_pro")}
              className={`rounded-lg px-4 py-2 text-sm ${data.eliteDashboardViewMode === "match_fit_pro" || !data.eliteDashboardViewMode ? "bg-[#FF7E00] text-black" : "border border-white/20"}`}
            >
              Viewing as Match Fit Pro
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void setEliteView("independent_fitness_pro")}
              className={`rounded-lg px-4 py-2 text-sm ${data.eliteDashboardViewMode === "independent_fitness_pro" ? "bg-[#FF7E00] text-black" : "border border-white/20"}`}
            >
              Viewing as Independent Fitness Pro
            </button>
          </div>
        </section>
      ) : null}

      {showStats && data.listingStats ? (
        <section className="rounded-2xl border border-white/10 bg-[#12141C] p-6">
          <h3 className="font-semibold">Public Stats</h3>
          <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-white/50">Profile Views</dt><dd className="font-medium">{data.listingStats.profileViews}</dd></div>
            <div><dt className="text-white/50">Click-Throughs</dt><dd className="font-medium">{data.listingStats.clickThroughs}</dd></div>
            <div><dt className="text-white/50">Match Fit Reviews</dt><dd className="font-medium">{data.listingStats.reviewCountInternal}</dd></div>
            <div><dt className="text-white/50">External Reviews</dt><dd className="font-medium">{data.listingStats.reviewCountExternal}</dd></div>
            <div><dt className="text-white/50">Active Listings</dt><dd className="font-medium">{data.listingStats.activeListingsCount}</dd></div>
          </dl>
        </section>
      ) : null}

      {data.permissions?.list_external_website ? (
        <section className="rounded-2xl border border-white/10 bg-[#12141C] p-6">
          <h3 className="font-semibold">External Website</h3>
          <input
            className="mt-3 w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-sm"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://yourbusiness.com"
          />
          <p className="mt-2 text-xs text-white/50">Save from dashboard settings when ready.</p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-[#12141C] p-6">
        <h3 className="font-semibold">Switch Account Type</h3>
        {lockLabel ? <p className="mt-2 text-sm text-amber-400">{lockLabel}</p> : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {switchCards.map((card) => (
            <button
              key={card.tier}
              type="button"
              disabled={busy || data.tierSwitchLockActive}
              onClick={() => void switchTier(card.tier)}
              className="rounded-xl border border-white/10 px-4 py-3 text-left text-sm hover:border-[#FF7E00]/50 disabled:opacity-50"
            >
              <span className="font-medium">{card.title}</span>
              <span className="mt-1 block text-white/60">{card.feeLabel}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#12141C] p-6">
        <h3 className="font-semibold">Account Type History</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {data.tierSwitchHistory.length === 0 ? (
            <li className="text-white/50">No switches yet.</li>
          ) : (
            data.tierSwitchHistory.map((row) => (
              <li key={row.id} className="border-b border-white/5 pb-2">
                {row.fromTierLabel ? `${row.fromTierLabel} → ` : ""}
                {row.toTierLabel}
                <span className="ml-2 text-white/40">{new Date(row.switchedAt).toLocaleString()}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      {data.promoteTokenLedger.length > 0 ? (
        <section className="rounded-2xl border border-white/10 bg-[#12141C] p-6">
          <h3 className="font-semibold">Promote Token Activity</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {data.promoteTokenLedger.map((row) => (
              <li key={row.id}>
                {row.action}: {row.amount} — {new Date(row.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.permissions?.featured_listing ? (
        <p className="text-sm text-white/60">
          <Link href="/trainer/dashboard/premium/featured" className="text-[#FF7E00] hover:underline">
            Open Featured Listing Bid Manager
          </Link>
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
