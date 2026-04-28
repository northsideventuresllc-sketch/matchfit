"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type TrainerRow = {
  username: string;
  displayName: string;
  bio: string | null;
  profileImageUrl: string | null;
  fitnessNiches: string | null;
  score: number;
  match: { nicheHits: number; serviceOk: boolean; deliveryOk: boolean; strictPass: boolean };
};

export function FindTrainersClient() {
  const [relaxed, setRelaxed] = useState(false);
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [mode, setMode] = useState<"swipe" | "scroll">("swipe");
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (r: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/trainers/browse?relaxed=${r ? "1" : "0"}`);
      const data = (await res.json()) as { trainers?: TrainerRow[]; relaxed?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load coaches.");
        return;
      }
      setTrainers(data.trainers ?? []);
      if (typeof data.relaxed === "boolean" && data.relaxed && !r) {
        setRelaxed(true);
      }
      setIndex(0);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  function setRelaxedAndLoad(v: boolean) {
    setRelaxed(v);
    void load(v);
  }

  const current = trainers[index] ?? null;

  async function saveTrainer(username: string) {
    const res = await fetch("/api/client/saved-trainers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trainerUsername: username }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setToast(data.error ?? "Could not save coach.");
      return;
    }
    setToast("Saved to your list & chats.");
    setTimeout(() => setToast(null), 2400);
  }

  function nextCard() {
    setIndex((i) => Math.min(i + 1, Math.max(trainers.length - 1, 0)));
  }

  async function onPass() {
    nextCard();
  }

  async function onLike() {
    if (!current) return;
    await saveTrainer(current.username);
    nextCard();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-[#0E1016]/60 p-2">
        <button
          type="button"
          onClick={() => setMode("swipe")}
          className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.1em] ${
            mode === "swipe"
              ? "bg-[linear-gradient(135deg,rgba(255,211,78,0.2),rgba(255,126,0,0.18))] text-white"
              : "text-white/45 hover:text-white/75"
          }`}
        >
          Swipe
        </button>
        <button
          type="button"
          onClick={() => setMode("scroll")}
          className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.1em] ${
            mode === "scroll"
              ? "bg-[linear-gradient(135deg,rgba(255,211,78,0.2),rgba(255,126,0,0.18))] text-white"
              : "text-white/45 hover:text-white/75"
          }`}
        >
          Scroll
        </button>
      </div>

      <label className="flex cursor-pointer items-center justify-center gap-3 text-sm text-white/70">
        <input
          type="checkbox"
          checked={relaxed}
          onChange={(e) => setRelaxedAndLoad(e.target.checked)}
          className="h-4 w-4 accent-[#FF7E00]"
        />
        Include near matches (slightly outside my delivery / niche wording)
      </label>

      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-center text-sm text-[#FFB4B4]">
          {error}
        </p>
      ) : null}
      {toast ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-100">
          {toast}
        </p>
      ) : null}

      {loading ? (
        <p className="text-center text-sm text-white/45">Loading coaches…</p>
      ) : trainers.length === 0 ? (
        <p className="text-center text-sm text-white/45">No published coaches yet. Check back soon.</p>
      ) : mode === "scroll" ? (
        <ul className="space-y-4">
          {trainers.map((t) => (
            <li
              key={t.username}
              className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)]"
            >
              <div className="flex gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0E1016]">
                  {t.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.profileImageUrl.split("?")[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-lg font-black text-white/35">
                      {t.displayName.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white/90">{t.displayName}</p>
                  <p className="text-xs text-white/45">@{t.username}</p>
                  {t.fitnessNiches ? (
                    <p className="mt-2 text-xs text-[#FF7E00]/90">{t.fitnessNiches}</p>
                  ) : null}
                  <p className="mt-2 line-clamp-3 text-sm text-white/60">{t.bio?.trim() || "—"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/trainers/${encodeURIComponent(t.username)}`}
                      className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/10 px-3 text-xs font-black uppercase tracking-[0.08em] text-white"
                    >
                      Full profile
                    </Link>
                    <Link
                      href={`/client/messages/${encodeURIComponent(t.username)}`}
                      className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs font-black uppercase tracking-[0.08em] text-white"
                    >
                      Messages
                    </Link>
                    <button
                      type="button"
                      onClick={() => void saveTrainer(t.username)}
                      className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-white/15 px-3 text-xs font-black uppercase tracking-[0.08em] text-white/80 hover:bg-white/[0.06]"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mx-auto max-w-md space-y-6">
          {current ? (
            <>
              <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-[#12151C] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)]">
                <div className="aspect-[4/5] w-full bg-[#0E1016]">
                  {current.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={current.profileImageUrl.split("?")[0]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-6xl font-black text-white/20">
                      {current.displayName.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-5">
                  <p className="text-xl font-black text-white">{current.displayName}</p>
                  <p className="text-xs text-white/45">@{current.username}</p>
                  {current.fitnessNiches ? (
                    <p className="text-xs font-semibold text-[#FF7E00]/90">{current.fitnessNiches}</p>
                  ) : null}
                  <p className="line-clamp-4 text-sm leading-relaxed text-white/65">{current.bio?.trim() || "—"}</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                    Match score {current.score}
                    {current.match.strictPass ? " · strong fit" : " · near match"}
                  </p>
                </div>
              </div>
              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  onClick={() => void onPass()}
                  className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/[0.06] text-2xl text-white/70 transition hover:border-white/35"
                  aria-label="Pass"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => void onLike()}
                  className="flex h-14 w-14 items-center justify-center rounded-full border border-[#FF7E00]/40 bg-[#FF7E00]/15 text-2xl text-[#FF7E00] transition hover:border-[#FF7E00]/60"
                  aria-label="Save coach"
                >
                  ♥
                </button>
              </div>
              <div className="text-center">
                <Link
                  href={`/trainers/${encodeURIComponent(current.username)}`}
                  className="text-xs font-bold uppercase tracking-[0.12em] text-[#FF7E00] underline-offset-2 hover:underline"
                >
                  Open full profile
                </Link>
              </div>
              <p className="text-center text-xs text-white/35">
                Card {index + 1} of {trainers.length}
              </p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
