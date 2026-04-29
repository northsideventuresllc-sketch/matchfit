"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  TRAINER_DISCOVERY_STRICTNESS_LABELS,
  TRAINER_DISCOVERY_STRICTNESS_MAX,
  TRAINER_DISCOVERY_STRICTNESS_MIN,
} from "@/lib/trainer-discovery-strictness";
import { PREMIUM_NUDGES_PRODUCT_NOTICE } from "@/lib/trainer-nudge-limits";

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
  const [premiumLine, setPremiumLine] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trainer/dashboard/discover-clients?strictness=${strictness}`);
      const data = (await res.json()) as { clients?: Row[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load clients.");
        setClients([]);
        return;
      }
      setClients(data.clients ?? []);
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
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function nudge(username: string) {
    setToast(null);
    setPremiumLine(null);
    const message = nudgeMsg[username]?.trim() || undefined;
    const res = await fetch("/api/trainer/clients/nudge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientUsername: username, message }),
    });
    const data = (await res.json()) as {
      error?: string;
      premiumNotice?: string;
      nudgesUsedToday?: number;
      nudgesDailyLimit?: number;
      unlimitedNudges?: boolean;
    };
    if (!res.ok) {
      setToast(data.error ?? "Could not send nudge.");
      if (data.premiumNotice) setPremiumLine(data.premiumNotice);
      return;
    }
    setToast(`Nudge sent to @${username}.`);
    if (data.unlimitedNudges) {
      setPremiumLine(null);
    } else if (data.nudgesUsedToday != null && data.nudgesDailyLimit != null) {
      setPremiumLine(`Used ${data.nudgesUsedToday} of ${data.nudgesDailyLimit} free nudges today. ${PREMIUM_NUDGES_PRODUCT_NOTICE}`);
    } else {
      setPremiumLine(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 backdrop-blur-xl sm:p-8">
        <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-white/40">Match strictness</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-white/50">
          Tune how closely surfaced clients need to align with your Match Me ideal profile.
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
          isPremium
            ? "rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.07] p-5 text-sm leading-relaxed text-emerald-100/90"
            : "rounded-3xl border border-amber-500/25 bg-amber-500/[0.07] p-5 text-sm leading-relaxed text-amber-100/90"
        }
      >
        <p
          className={
            isPremium
              ? "font-bold uppercase tracking-[0.12em] text-emerald-200/90"
              : "font-bold uppercase tracking-[0.12em] text-amber-200/90"
          }
        >
          Nudge limits
        </p>
        {isPremium ? (
          <p className="mt-2 text-emerald-100/85">
            With <span className="font-semibold text-white">Match Fit Premium</span>, discovery nudges are{" "}
            <span className="font-semibold text-white">unlimited</span> for clients who appear on this list and still
            accept trainer discovery—there is no three-per-day cap on your account. Your practical limit is the same
            reach you see here: eligible profiles only.
          </p>
        ) : (
          <p className="mt-2 text-amber-100/85">
            You can send up to <span className="font-semibold text-white">3 discovery nudges per day</span> on the free
            tier. Need more than 3 nudges per day?{" "}
            <Link
              href="/trainer/dashboard/premium"
              className="font-semibold text-[#FF7E00] underline decoration-[#FF7E00]/40 underline-offset-2 transition hover:text-[#FF9A3D]"
            >
              Match Fit Premium
            </Link>{" "}
            ($19.99/month) will unlock higher limits — billing is handled by a separate integration.
          </p>
        )}
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
      {premiumLine ? (
        <p className="rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-4 py-3 text-center text-xs leading-relaxed text-white/55">
          {premiumLine}
        </p>
      ) : null}

      {loading ? (
        <p className="text-center text-sm text-white/45">Loading…</p>
      ) : clients.length === 0 ? (
        <p className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-8 text-center text-sm text-white/50">
          No clients match at this strictness. Try a looser setting or finish more of your Match Me questionnaire.
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
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
