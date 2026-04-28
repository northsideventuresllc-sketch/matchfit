"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Summary = {
  premium: boolean;
  balance?: number;
  regionalBoostConfigured?: boolean;
  economics?: {
    tokensPerPack: number;
    packPriceUsd: number;
    weeklyGrant: number;
    minTokensPerDay: number;
    maxPromotionDays: number;
    maxSinglePromotionTokens: number;
    clientGiftCapPerTrainerPerWeek: number;
  };
  message?: string;
};

type MyPost = {
  id: string;
  postType: string;
  visibility: string;
  caption: string | null;
  createdAt: string;
};

export function TrainerPromoTokensClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [postId, setPostId] = useState("");
  const [durationDays, setDurationDays] = useState(1);
  const [tokensBudget, setTokensBudget] = useState(20);
  const [packCount, setPackCount] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [sRes, pRes] = await Promise.all([
        fetch("/api/trainer/promo-tokens/summary"),
        fetch("/api/trainer/fithub/my-posts"),
      ]);
      const s = (await sRes.json()) as Summary;
      setSummary(s);
      const pData = (await pRes.json()) as { posts?: MyPost[]; error?: string };
      if (pRes.ok) {
        const vids = (pData.posts ?? []).filter((x) => x.postType === "VIDEO" && x.visibility === "PUBLIC");
        setPosts(vids);
        setPostId((prev) => (prev && vids.some((v) => v.id === prev) ? prev : vids[0]?.id ?? ""));
      }
    } catch {
      setErr("Could not load.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const minRequired = useMemo(() => {
    const m = summary?.economics?.minTokensPerDay ?? 20;
    return m * durationDays;
  }, [summary, durationDays]);

  useEffect(() => {
    if (!summary?.economics) return;
    setTokensBudget((t) => Math.max(minRequired, t));
  }, [minRequired, summary?.economics]);

  async function buyPacks() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/trainer/promo-tokens/purchase-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packCount }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Checkout failed.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } finally {
      setBusy(false);
    }
  }

  async function promote() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/trainer/promo-tokens/promote-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, durationDays, tokensBudget }),
      });
      const data = (await res.json()) as { error?: string; promotionId?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not start promotion.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!summary) {
    return <p className="text-center text-sm text-white/50">Loading…</p>;
  }

  if (!summary.premium) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-6 text-center text-sm text-white/70">
        {summary.message ?? "Premium required."}
      </div>
    );
  }

  const eco = summary.economics;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Premium</p>
        <h1 className="text-2xl font-black uppercase tracking-[0.06em] sm:text-3xl">Promotion tokens</h1>
        <p className="text-sm text-white/50">
          Boost eligible public <strong className="text-white/80">video</strong> posts in the client FitHub feed for
          viewers whose ZIP matches your in-person service region.
        </p>
      </header>

      <div className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">Balance</p>
        <p className="mt-2 text-4xl font-black tabular-nums text-white">{summary.balance ?? 0}</p>
        <p className="mt-2 text-xs text-white/45">
          You receive <strong className="text-white/70">{eco?.weeklyGrant ?? 20}</strong> tokens each week while
          Premium is active. Each completed client service (platform checkout) adds{" "}
          <strong className="text-white/70">10</strong> tokens. Purchased packs:{" "}
          <strong className="text-white/70">{eco?.tokensPerPack ?? 20}</strong> tokens for $
          {(eco?.packPriceUsd ?? 5).toFixed(2)} each.
        </p>
        {!summary.regionalBoostConfigured ? (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
            Add your in-person US ZIP in the Match questionnaire so regional boosts can apply.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-6 space-y-4">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white/80">Buy tokens</h2>
        <label className="block text-xs text-white/50">
          Packs (each pack {eco?.tokensPerPack ?? 20} tokens @ ${(eco?.packPriceUsd ?? 5).toFixed(2)})
          <input
            type="number"
            min={1}
            max={40}
            value={packCount}
            onChange={(e) => setPackCount(Math.max(1, Math.min(40, parseInt(e.target.value, 10) || 1)))}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void buyPacks()}
          className="w-full rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/12 py-3 text-sm font-black uppercase tracking-[0.1em] text-white transition hover:border-[#FF7E00]/55 disabled:opacity-40"
        >
          Checkout with Stripe
        </button>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-6 space-y-4">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white/80">Promote a video</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-white/50">
            No public video posts yet.{" "}
            <Link
              href="/trainer/dashboard/premium/fit-hub-content"
              className="text-[#FF7E00] underline-offset-2 hover:underline"
            >
              Create one in Fit Hub &amp; content
            </Link>
            .
          </p>
        ) : (
          <>
            <label className="block text-xs text-white/50">
              Post
              <select
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white"
              >
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.caption ?? "Video").slice(0, 48)} · {new Date(p.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-white/50">
              Duration (days, max {eco?.maxPromotionDays ?? 30})
              <input
                type="number"
                min={1}
                max={eco?.maxPromotionDays ?? 30}
                value={durationDays}
                onChange={(e) =>
                  setDurationDays(Math.max(1, Math.min(eco?.maxPromotionDays ?? 30, parseInt(e.target.value, 10) || 1)))
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-white/50">
              Token budget (min {minRequired} = {eco?.minTokensPerDay ?? 20}/day × {durationDays} day(s))
              <input
                type="number"
                min={minRequired}
                max={eco?.maxSinglePromotionTokens ?? 20000}
                value={tokensBudget}
                onChange={(e) =>
                  setTokensBudget(
                    Math.max(
                      minRequired,
                      Math.min(eco?.maxSinglePromotionTokens ?? 20000, parseInt(e.target.value, 10) || minRequired),
                    ),
                  )
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white"
              />
            </label>
            <p className="text-[11px] text-white/40">
              Larger budgets increase regional ranking weight during the window. One active promotion per post at a
              time. Tokens are non-refundable once the window starts.
            </p>
            <button
              type="button"
              disabled={busy || !postId}
              onClick={() => void promote()}
              className="w-full rounded-xl border border-white/15 bg-white/[0.06] py-3 text-sm font-black uppercase tracking-[0.1em] text-white transition hover:border-white/25 disabled:opacity-40"
            >
              Spend tokens &amp; promote
            </button>
          </>
        )}
      </div>

      {err ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]">{err}</p>
      ) : null}

      <p className="text-center text-xs text-white/40">
        <Link href="/trainer/dashboard/premium" className="text-[#FF7E00] underline-offset-2 hover:underline">
          Back to Premium
        </Link>
      </p>
    </div>
  );
}
