"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  TRAINER_DISCOVERY_STRICTNESS_LABELS,
  TRAINER_DISCOVERY_STRICTNESS_MAX,
  TRAINER_DISCOVERY_STRICTNESS_MIN,
} from "@/lib/trainer-discovery-strictness";
import {
  FP_NUDGE_PACK_PRICE_USD,
  FP_NUDGE_PACK_SIZE,
  INDEPENDENT_FP_DAILY_NUDGES,
  INDEPENDENT_FP_NO_CHAT_MESSAGE,
  NUDGE_PACK_PURCHASE_NOTICE,
} from "@/lib/fp-tier-chat-policy";
import { LEGACY_FREE_TRAINER_NUDGES_PER_DAY } from "@/lib/trainer-nudge-limits";

type Row = {
  username: string;
  displayName: string;
  zipCode: string;
  bio: string | null;
  profileImageUrl: string | null;
  score: number;
  nicheHits: number;
  serviceOk: boolean;
  deliveryOk: boolean;
};

type NudgeSummary = {
  accountTier: string | null;
  canUseNudges: boolean;
  canUseInAppChat: boolean;
  nudgesUsedToday: number;
  nudgesDailyLimit: number | null;
  nudgeCreditsBalance: number;
  nudgePackNotice: string | null;
  remainingFreeNudgesToday: number | null;
};

type Props = {
  isPremium: boolean;
};

export function TrainerDiscoverClientsClient(props: Props) {
  const { isPremium } = props;
  const [strictness, setStrictness] = useState(3);
  const [clients, setClients] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nudgeMsg, setNudgeMsg] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [matchBatchNote, setMatchBatchNote] = useState<string | null>(null);
  const [nudgeSummary, setNudgeSummary] = useState<NudgeSummary | null>(null);
  const [purchaseBusy, setPurchaseBusy] = useState(false);

  const loadNudgeSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/trainer/nudges/summary");
      const data = (await res.json()) as NudgeSummary & { error?: string };
      if (res.ok) setNudgeSummary(data);
    } catch {
      setNudgeSummary(null);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trainer/dashboard/discover-clients?strictness=${strictness}`);
      const data = (await res.json()) as {
        clients?: Row[];
        error?: string;
        matchBatch?: { premiumUnlimited: boolean; standardBatchSize: number; standardWindowHours: number };
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load clients.");
        setClients([]);
        setMatchBatchNote(null);
        return;
      }
      setClients(data.clients ?? []);
      const mb = data.matchBatch;
      if (mb && !mb.premiumUnlimited) {
        setMatchBatchNote(
          `Standard plan: up to ${mb.standardBatchSize} discovery matches per ${mb.standardWindowHours} hours (UTC bucket). Premium unlocks unlimited batching.`,
        );
      } else {
        setMatchBatchNote(null);
      }
    } catch {
      setError("Network error.");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [strictness]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
      void loadNudgeSummary();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load, loadNudgeSummary]);

  async function purchaseNudgePack() {
    setPurchaseBusy(true);
    setToast(null);
    try {
      const res = await fetch("/api/trainer/nudges/purchase-checkout", { method: "POST" });
      const data = (await res.json()) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) {
        setToast(data.error ?? "Could not start checkout.");
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setToast("Network error.");
    } finally {
      setPurchaseBusy(false);
    }
  }

  async function nudge(username: string) {
    setToast(null);
    setStatusLine(null);
    const message = nudgeMsg[username]?.trim() || undefined;
    const res = await fetch("/api/trainer/clients/nudge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientUsername: username, message }),
    });
    const data = (await res.json()) as {
      error?: string;
      code?: string;
      nudgesUsedToday?: number;
      nudgesDailyLimit?: number | null;
      nudgeCreditsBalance?: number;
      nudgePackNotice?: string | null;
      unlimitedNudges?: boolean;
      chatDisabled?: boolean;
      chatNotice?: string | null;
    };
    if (!res.ok) {
      setToast(data.error ?? "Could not send nudge.");
      if (data.code === "NUDGE_DAILY_CAP" && data.nudgePackNotice) {
        setStatusLine(data.nudgePackNotice);
      }
      return;
    }
    setToast(
      data.chatDisabled
        ? `Nudge sent to @${username}. In-app chat is not available on Independent Fitness Pro — the client is notified via discovery only.`
        : `Nudge sent to @${username}.`,
    );
    if (data.unlimitedNudges) {
      setStatusLine(null);
    } else if (data.nudgesUsedToday != null && data.nudgesDailyLimit != null) {
      const creditNote =
        data.nudgeCreditsBalance != null && data.nudgeCreditsBalance > 0
          ? ` Purchased credits remaining: ${data.nudgeCreditsBalance}.`
          : "";
      setStatusLine(
        `Used ${data.nudgesUsedToday} of ${data.nudgesDailyLimit} free nudges today.${creditNote}`,
      );
    }
    void loadNudgeSummary();
  }

  const tier = nudgeSummary?.accountTier ?? null;
  const isIndependent = tier === "independent_fitness_pro";
  const isElite = tier === "elite_fitness_pro";
  const isFpProTier = tier === "match_fit_pro" || tier === "match_fit_premium_pro";
  const legacyNoTier = !tier;

  function nudgeLimitsNotice() {
    if (isIndependent) {
      return (
        <>
          <p className="mt-2 text-amber-100/85">
            <span className="font-semibold text-white">Independent Fitness Pro</span> uses discovery nudges only —{" "}
            <span className="font-semibold text-white">in-app chat is not available</span> on this account type. You
            receive <span className="font-semibold text-white">{INDEPENDENT_FP_DAILY_NUDGES} nudges per day</span>{" "}
            (UTC). {NUDGE_PACK_PURCHASE_NOTICE}
          </p>
          <p className="mt-2 text-xs text-amber-100/70">{INDEPENDENT_FP_NO_CHAT_MESSAGE}</p>
          {nudgeSummary ? (
            <p className="mt-2 text-xs text-amber-100/75">
              Today: {nudgeSummary.nudgesUsedToday} used
              {nudgeSummary.nudgesDailyLimit != null ? ` of ${nudgeSummary.nudgesDailyLimit} free` : ""}.
              {nudgeSummary.nudgeCreditsBalance > 0
                ? ` Purchased credits: ${nudgeSummary.nudgeCreditsBalance}.`
                : null}
            </p>
          ) : null}
        </>
      );
    }
    if (isElite) {
      return (
        <p className="mt-2 text-emerald-100/85">
          <span className="font-semibold text-white">Elite Fitness Pro</span> includes unlimited discovery nudges and
          full in-app chat. You may share business email addresses and external listing links in chat; phone numbers and
          off-platform payment details are still prohibited.
        </p>
      );
    }
    if (isFpProTier) {
      return (
        <p className="mt-2 text-emerald-100/85">
          <span className="font-semibold text-white">Match Fit Pro</span> and{" "}
          <span className="font-semibold text-white">Match Fit Premium Pro</span> use in-app chat (not discovery nudges)
          for client outreach. Keep payments and scheduling on Match Fit; contact and payment leakage rules apply in
          chat.
        </p>
      );
    }
    if (isPremium || legacyNoTier) {
      return isPremium ? (
        <p className="mt-2 text-emerald-100/85">
          With <span className="font-semibold text-white">legacy Premium Page</span> access, discovery nudges are{" "}
          <span className="font-semibold text-white">unlimited</span> for clients who appear here and accept coach
          discovery.
        </p>
      ) : (
        <p className="mt-2 text-amber-100/85">
          You can send up to{" "}
          <span className="font-semibold text-white">{LEGACY_FREE_TRAINER_NUDGES_PER_DAY} discovery nudges per day</span>{" "}
          on the legacy free tier. Select a Fitness Pro account type in{" "}
          <Link
            href="/trainer/dashboard/account-tier"
            className="font-semibold text-[#FF7E00] underline decoration-[#FF7E00]/40 underline-offset-2 transition hover:text-[#FF9A3D]"
          >
            Account Type
          </Link>{" "}
          for tier-specific messaging rules.
        </p>
      );
    }
    return null;
  }

  return (
    <div className="space-y-8">
      {matchBatchNote ? (
        <p className="rounded-2xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-xs leading-relaxed text-white/55">
          {matchBatchNote}
        </p>
      ) : null}
      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-white/40">Match strictness</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-white/50">
          Tune how closely surfaced clients need to align with your Onboarding Questionnaire ideal profile.
        </p>
        <div className="mx-auto mt-6 max-w-md space-y-3">
          <input
            type="range"
            min={TRAINER_DISCOVERY_STRICTNESS_MIN}
            max={TRAINER_DISCOVERY_STRICTNESS_MAX}
            value={strictness}
            onChange={(e) => setStrictness(Number(e.target.value))}
            className="w-full accent-[#FF7E00]"
          />
          <p className="text-center text-sm font-semibold text-[#FF7E00]">
            {TRAINER_DISCOVERY_STRICTNESS_LABELS[strictness] ?? `Level ${strictness}`}
          </p>
        </div>
      </section>

      <section
        className={
          isIndependent || (!isPremium && legacyNoTier && !isFpProTier && !isElite)
            ? "rounded-3xl border border-amber-500/25 bg-amber-500/[0.07] p-5 text-sm leading-relaxed text-amber-100/90"
            : "rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.07] p-5 text-sm leading-relaxed text-emerald-100/90"
        }
      >
        <p
          className={
            isIndependent || (!isPremium && legacyNoTier && !isFpProTier && !isElite)
              ? "font-bold uppercase tracking-[0.12em] text-amber-200/90"
              : "font-bold uppercase tracking-[0.12em] text-emerald-200/90"
          }
        >
          Discovery & messaging
        </p>
        {nudgeLimitsNotice()}
        {isIndependent ? (
          <button
            type="button"
            disabled={purchaseBusy}
            onClick={() => void purchaseNudgePack()}
            className="mt-4 inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/12 px-4 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:border-[#FF7E00]/55 disabled:opacity-50"
          >
            {purchaseBusy
              ? "Starting checkout…"
              : `Buy ${FP_NUDGE_PACK_SIZE} Nudges — $${FP_NUDGE_PACK_PRICE_USD.toFixed(2)}`}
          </button>
        ) : null}
      </section>

      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-center text-sm text-[#FFB4B4]">
          {error}
        </p>
      ) : null}
      {toast ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-100/90">
          {toast}
        </p>
      ) : null}
      {statusLine ? (
        <p className="rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-4 py-3 text-center text-xs leading-relaxed text-white/55">
          {statusLine}
        </p>
      ) : null}

      {loading ? (
        <p className="text-center text-sm text-white/45">Loading…</p>
      ) : clients.length === 0 ? (
        <p className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-8 text-center text-sm text-white/50">
          No clients match at this strictness. Try a looser setting or add more detail in your Onboarding Questionnaire.
        </p>
      ) : (
        <ul className="space-y-4">
          {clients.map((c) => (
            <li
              key={c.username}
              className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.85)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#0E1016]">
                    {c.profileImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.profileImageUrl.split("?")[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-sm font-black text-white/35">
                        {c.displayName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white/90">{c.displayName}</p>
                    <p className="text-xs text-white/45">@{c.username}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                      Fit score {c.score} · niches {c.nicheHits} · services {c.serviceOk ? "ok" : "miss"} · delivery{" "}
                      {c.deliveryOk ? "ok" : "miss"}
                    </p>
                    {c.bio?.trim() ? (
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-white/50">{c.bio}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-56">
                  {nudgeSummary?.canUseNudges !== false && !isFpProTier ? (
                    <>
                      <textarea
                        value={nudgeMsg[c.username] ?? ""}
                        onChange={(e) => setNudgeMsg((m) => ({ ...m, [c.username]: e.target.value }))}
                        placeholder="Optional short note with your nudge"
                        rows={2}
                        className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-3 py-2 text-xs text-white placeholder:text-white/30"
                      />
                      <button
                        type="button"
                        onClick={() => void nudge(c.username)}
                        className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/12 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:border-[#FF7E00]/55"
                      >
                        Send nudge
                      </button>
                    </>
                  ) : isFpProTier ? (
                    <p className="text-center text-xs leading-relaxed text-white/45">
                      Use{" "}
                      <Link href="/trainer/dashboard/messages" className="text-[#FF9A4A] underline-offset-2 hover:underline">
                        Chats
                      </Link>{" "}
                      or client inquiries for outreach on your account type.
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
