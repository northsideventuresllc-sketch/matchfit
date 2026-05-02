"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type PackTier = { id: string; label: string; tokens: number; priceUsd: number };

type Summary = {
  premium: boolean;
  balance?: number;
  regionalBoostConfigured?: boolean;
  packTiers?: PackTier[];
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

type PromoPhase = "past" | "current" | "scheduled";

type PromotionRow = {
  id: string;
  phase: PromoPhase;
  startsAt: string;
  endsAt: string;
  tokensSpent: number;
  durationDays: number;
  regionZipPrefix: string;
  tokensPerDay: number;
  estMaxRegionalBoost: number;
  post: { id: string; caption: string | null; mediaUrl: string | null; postType: string };
  stats: { likes: number; comments: number; reposts: number; shares: number };
  statsWindowNote: string;
};

const TAB_LABELS: { id: PromoPhase; label: string }[] = [
  { id: "past", label: "Past promoted" },
  { id: "current", label: "Currently promoted" },
  { id: "scheduled", label: "Scheduled" },
];

export function TrainerPromoTokensClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [promoTab, setPromoTab] = useState<PromoPhase>("current");
  const [postId, setPostId] = useState("");
  const [durationDays, setDurationDays] = useState(1);
  const [tokensBudget, setTokensBudget] = useState(20);
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    setLoadErr(null);
    try {
      const [sRes, pRes, prRes] = await Promise.all([
        fetch("/api/trainer/promo-tokens/summary"),
        fetch("/api/trainer/fithub/my-posts"),
        fetch("/api/trainer/promo-tokens/promotions"),
      ]);
      const sJson = (await sRes.json().catch(() => ({}))) as Summary & { error?: string };
      if (!sRes.ok) {
        setSummary(null);
        setLoadErr(sJson.error ?? `Could not load token summary (${sRes.status}).`);
        return;
      }
      setSummary(sJson);
      const pData = (await pRes.json()) as { posts?: MyPost[]; error?: string };
      if (pRes.ok) {
        const vids = (pData.posts ?? []).filter((x) => x.postType === "VIDEO" && x.visibility === "PUBLIC");
        setPosts(vids);
        setPostId((prev) => (prev && vids.some((v) => v.id === prev) ? prev : vids[0]?.id ?? ""));
      }
      const prData = (await prRes.json()) as { promotions?: PromotionRow[]; error?: string };
      if (prRes.ok) {
        setPromotions(prData.promotions ?? []);
      } else {
        setPromotions([]);
      }
    } catch {
      setSummary(null);
      setLoadErr("Could not load. Check your connection and try again.");
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

  const tabPromotions = useMemo(() => promotions.filter((p) => p.phase === promoTab), [promotions, promoTab]);

  const tabDashboard = useMemo(() => {
    const n = tabPromotions.length;
    const tokens = tabPromotions.reduce((a, p) => a + p.tokensSpent, 0);
    const likes = tabPromotions.reduce((a, p) => a + p.stats.likes, 0);
    const comments = tabPromotions.reduce((a, p) => a + p.stats.comments, 0);
    const reposts = tabPromotions.reduce((a, p) => a + p.stats.reposts, 0);
    const shares = tabPromotions.reduce((a, p) => a + p.stats.shares, 0);
    const avgBoost =
      n > 0 ? Math.round((tabPromotions.reduce((a, p) => a + p.estMaxRegionalBoost, 0) / n) * 10) / 10 : 0;
    return { n, tokens, likes, comments, reposts, shares, avgBoost };
  }, [tabPromotions]);

  async function buyPackTier(tierId: "starter" | "growth" | "scale") {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/trainer/promo-tokens/purchase-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packTier: tierId }),
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
      let scheduledStartsAt: string | null = null;
      if (scheduleLocal.trim()) {
        const d = new Date(scheduleLocal);
        if (Number.isNaN(d.getTime())) {
          setErr("Invalid schedule time.");
          setBusy(false);
          return;
        }
        scheduledStartsAt = d.toISOString();
      }
      const payload: Record<string, unknown> = { postId, durationDays, tokensBudget };
      if (scheduledStartsAt) payload.scheduledStartsAt = scheduledStartsAt;
      const res = await fetch("/api/trainer/promo-tokens/promote-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Could not start promotion.");
        return;
      }
      setScheduleLocal("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!summary && !loadErr) {
    return <p className="text-center text-sm text-white/50">Loading…</p>;
  }

  if (loadErr) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 p-6 text-center text-sm text-[#FFB4B4]">
        {loadErr}
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 w-full rounded-xl border border-white/20 py-2 text-xs font-black uppercase tracking-wide text-white/90 hover:bg-white/[0.06]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!summary?.premium) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-6 text-center text-sm text-white/70">
        {summary?.message ??
          "Promotion tokens are available to Premium Page coaches only. Open the Premium Page from your dashboard to enroll."}
      </div>
    );
  }

  const eco = summary.economics;
  const tiers = summary.packTiers ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-black tracking-[0.22em] text-white/55">PREMIUM HUB</p>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Premium · Tokens</p>
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
          You receive <strong className="text-white/70">{eco?.weeklyGrant ?? 20}</strong> tokens each week while Premium
          is active. Each completed client service (platform checkout) adds{" "}
          <strong className="text-white/70">10</strong> tokens.
        </p>
        {!summary.regionalBoostConfigured ? (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
            Add your in-person US ZIP in your Onboarding Questionnaire so regional boosts can apply.
          </p>
        ) : null}
      </div>

      <div className="rounded-3xl border border-[#FF7E00]/25 bg-[linear-gradient(180deg,rgba(255,126,0,0.12)_0%,rgba(18,21,28,0.92)_2.5rem)] p-5 shadow-[0_20px_60px_-40px_rgba(255,126,0,0.45)] sm:p-6">
        <div className="mb-4 text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-[#FF7E00] sm:text-base">Buy token packs</p>
          <p className="mt-1 text-[11px] text-white/45">
            One checkout per pack. Tokens credit after Stripe confirms payment. Checkout adds a separate{" "}
            <strong className="text-white/70">20% non-refundable administrative fee</strong> plus Stripe processing on top of
            the pack price (Terms §3).
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {(tiers.length
            ? tiers
            : [
                { id: "starter", label: "Starter", tokens: 20, priceUsd: 5 },
                { id: "growth", label: "Growth", tokens: 100, priceUsd: 20 },
                { id: "scale", label: "Scale", tokens: 1000, priceUsd: 80 },
              ]
          ).map((t) => (
            <div
              key={t.id}
              className="flex flex-col rounded-2xl border border-white/[0.1] bg-[#0E1016]/80 p-4 text-center shadow-inner"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">{t.label}</p>
              <p className="mt-2 text-2xl font-black text-white">${t.priceUsd.toFixed(2)}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-white/40">Pack subtotal before admin + processing.</p>
              <p className="mt-1 text-sm font-bold text-[#FFD34E]">{t.tokens} tokens</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void buyPackTier(t.id as "starter" | "growth" | "scale")}
                className="mt-4 w-full rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_55%,#E32B2B_100%)] py-2.5 text-[10px] font-black uppercase tracking-wide text-[#0B0C0F] disabled:opacity-40"
              >
                Buy with Stripe
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-6 space-y-4">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white/80">Start a new promotion</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-white/50">
            No public video posts yet.{" "}
            <Link href="/trainer/dashboard/premium/fit-hub-content" className="text-[#FF7E00] underline-offset-2 hover:underline">
              Create one in FitHub &amp; Content
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
            <label className="block text-xs text-white/50">
              Schedule start (optional — leave empty to start immediately)
              <input
                type="datetime-local"
                value={scheduleLocal}
                onChange={(e) => setScheduleLocal(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0E1016] px-3 py-2 text-sm text-white"
              />
            </label>
            <p className="text-[11px] text-white/40">
              Larger budgets increase regional ranking weight during the window. Overlapping windows on the same post are
              not allowed. Tokens are charged when you confirm, including for scheduled runs.
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

      <div className="space-y-4">
        <div className="rounded-3xl border border-[#FF7E00]/25 bg-[linear-gradient(180deg,rgba(255,126,0,0.12)_0%,rgba(18,21,28,0.92)_2.5rem)] p-5 shadow-[0_20px_60px_-40px_rgba(255,126,0,0.45)] sm:p-6">
          <div className="text-center">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-[#FF7E00] sm:text-base">Promoted content</p>
            <p className="mt-1 text-[11px] text-white/45">Switch tabs to review past, live, or scheduled runs for this bucket.</p>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2 rounded-2xl border border-white/[0.1] bg-black/25 p-1">
            {TAB_LABELS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPromoTab(t.id)}
                className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wide transition sm:px-4 sm:text-xs ${
                  promoTab === t.id
                    ? "bg-[#FF7E00]/25 text-white ring-1 ring-[#FF7E00]/40"
                    : "text-white/45 hover:bg-white/[0.06] hover:text-white/70"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-6 border-t border-white/[0.08] pt-5">
            {tabPromotions.length === 0 ? (
              <p className="rounded-xl border border-white/[0.08] bg-black/30 py-8 text-center text-sm text-white/45">
                Nothing in this bucket yet.
              </p>
            ) : (
              <ul className="space-y-4">
                {tabPromotions.map((p) => (
                  <li
                    key={p.id}
                    className="overflow-hidden rounded-2xl border border-white/[0.12] bg-black/30 p-4 shadow-[0_12px_40px_-28px_rgba(0,0,0,0.75)]"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="h-24 w-full shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30 sm:h-28 sm:w-40">
                        {p.post.mediaUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.post.mediaUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] font-bold uppercase text-white/25">
                            Video
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-xs font-semibold text-white/90 line-clamp-2">{p.post.caption ?? "(No caption)"}</p>
                        <p className="text-[10px] text-white/40">
                          {new Date(p.startsAt).toLocaleString()} → {new Date(p.endsAt).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-white/45">
                          Region <span className="font-mono text-white/70">{p.regionZipPrefix}**</span> · {p.durationDays}{" "}
                          day(s) · {p.tokensSpent} tokens · ~{p.tokensPerDay}/day
                        </p>
                        <p className="text-[10px] italic text-white/35">{p.statsWindowNote}</p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="rounded-md bg-rose-500/15 px-2 py-1 text-[10px] font-bold text-rose-100">
                            ♥ {p.stats.likes}
                          </span>
                          <span className="rounded-md bg-sky-500/15 px-2 py-1 text-[10px] font-bold text-sky-100">
                            💬 {p.stats.comments}
                          </span>
                          <span className="rounded-md bg-violet-500/15 px-2 py-1 text-[10px] font-bold text-violet-100">
                            ↻ {p.stats.reposts}
                          </span>
                          <span className="rounded-md bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-50">
                            ⧉ {p.stats.shares}
                          </span>
                          <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-100">
                            Est. boost {p.estMaxRegionalBoost}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-[#FF7E00]/25 bg-[linear-gradient(180deg,rgba(255,126,0,0.12)_0%,rgba(18,21,28,0.92)_2.5rem)] p-5 shadow-[0_20px_60px_-40px_rgba(255,126,0,0.45)] sm:p-6">
          <div className="mb-4 text-center">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-[#FF7E00] sm:text-base">Promotion dashboard</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/45">
              Totals for the tab you selected in Promoted content. Engagement is counted in-window; boost is the same
              regional score model as the client FitHub feed when a client ZIP prefix matches yours (not impressions).
            </p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.1] bg-black/35 px-4 py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/45">Runs</p>
                <p className="mt-2 text-2xl font-black tabular-nums leading-none text-white">{tabDashboard.n}</p>
              </div>
              <div className="rounded-xl border border-white/[0.1] bg-black/35 px-4 py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/45">Tokens spent</p>
                <p className="mt-2 text-2xl font-black tabular-nums leading-none text-[#FFD34E]">{tabDashboard.tokens}</p>
              </div>
              <div className="rounded-xl border border-white/[0.1] bg-black/35 px-4 py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/45">Avg est. boost</p>
                <p className="mt-2 text-2xl font-black tabular-nums leading-none text-emerald-200/95">{tabDashboard.avgBoost}</p>
                <p className="mt-2 text-[10px] text-white/40">0–160 scale</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.12] bg-black/25 p-4 sm:p-5">
              <div className="mb-4 text-center sm:text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF7E00]/90">Engagement</p>
                <p className="mt-1 text-xs leading-relaxed text-white/50">
                  In-window totals for the tab you selected (likes, comments, reposts, and recorded shares).
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                <div className="flex flex-col items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-3 py-4 text-center sm:min-h-[6.5rem] sm:justify-center sm:py-5">
                  <p className="text-[10px] font-black uppercase tracking-wide text-rose-200/80">Likes</p>
                  <p className="text-2xl font-black tabular-nums leading-none text-white sm:text-3xl">{tabDashboard.likes}</p>
                </div>
                <div className="flex flex-col items-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/[0.08] px-3 py-4 text-center sm:min-h-[6.5rem] sm:justify-center sm:py-5">
                  <p className="text-[10px] font-black uppercase tracking-wide text-sky-200/85">Comments</p>
                  <p className="text-2xl font-black tabular-nums leading-none text-white sm:text-3xl">{tabDashboard.comments}</p>
                </div>
                <div className="flex flex-col items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/[0.08] px-3 py-4 text-center sm:min-h-[6.5rem] sm:justify-center sm:py-5">
                  <p className="text-[10px] font-black uppercase tracking-wide text-violet-200/85">Reposts</p>
                  <p className="text-2xl font-black tabular-nums leading-none text-white sm:text-3xl">{tabDashboard.reposts}</p>
                </div>
                <div className="flex flex-col items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.1] px-3 py-4 text-center sm:min-h-[6.5rem] sm:justify-center sm:py-5">
                  <p className="text-[10px] font-black uppercase tracking-wide text-amber-100/90">Shares</p>
                  <p className="text-2xl font-black tabular-nums leading-none text-white sm:text-3xl">{tabDashboard.shares}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {err ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]">{err}</p>
      ) : null}

      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
        <Link href="/trainer/dashboard/premium/featured" className="text-[#FF7E00] underline-offset-2 hover:underline">
          Featured Trainer
        </Link>
        <span className="text-white/25" aria-hidden>
          ·
        </span>
        <Link href="/trainer/dashboard/premium/fit-hub-content" className="text-[#FF7E00] underline-offset-2 hover:underline">
          FitHub &amp; Content
        </Link>
      </p>
    </div>
  );
}
