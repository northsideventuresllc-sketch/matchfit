"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TRAINER_FITHUB_PREFS_STORAGE_KEY,
  defaultTrainerFithubPrefs,
  normalizeTrainerFithubPrefs,
  type TrainerFithubFeedStyle,
  type TrainerFithubPrefs,
} from "@/lib/trainer-fithub-prefs";

const FEED_STYLES: { value: TrainerFithubFeedStyle; label: string; hint: string }[] = [
  {
    value: "ALGORITHMIC",
    label: "Algorithmic",
    hint: "Blend of engagement and recency so trending trainer content surfaces first.",
  },
  { value: "NEWEST", label: "Newest First", hint: "Strict reverse chronological order." },
];

export function TrainerFitHubSettingsForm() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<TrainerFithubPrefs>({ ...defaultTrainerFithubPrefs });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TRAINER_FITHUB_PREFS_STORAGE_KEY);
      if (raw) setPrefs(normalizeTrainerFithubPrefs(JSON.parse(raw) as unknown));
    } catch {
      /* ignore malformed local storage */
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setOk(null);
    try {
      window.localStorage.setItem(TRAINER_FITHUB_PREFS_STORAGE_KEY, JSON.stringify(prefs));
      setOk("FitHub Settings saved.");
      router.push("/trainer/dashboard/fit-hub");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-center text-sm text-white/45">Loading FitHub Settings…</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {ok ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100" role="status">
          {ok}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white/90">Feed Generation</h2>
        <p className="text-xs text-white/45">Control how trainer posts are ordered in your FitHub feed.</p>
        <ul className="space-y-2">
          {FEED_STYLES.map((row) => (
            <li key={row.value}>
              <label className="flex cursor-pointer gap-3 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3 transition hover:border-white/12">
                <input
                  type="radio"
                  name="feedStyle"
                  value={row.value}
                  checked={prefs.feedStyle === row.value}
                  onChange={() => setPrefs((p) => ({ ...p, feedStyle: row.value }))}
                  className="mt-1 accent-[#FF7E00]"
                />
                <span>
                  <span className="text-sm font-semibold text-white/90">{row.label}</span>
                  <span className="mt-1 block text-xs text-white/45">{row.hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white/90">Content Types</h2>
        <ul className="space-y-3">
          {(
            [
              ["showTextPosts", "Text Posts", "Written updates and long captions."] as const,
              ["showImagePosts", "Photo Posts", "Still frames and image carousels."] as const,
              ["showVideoPosts", "Video Posts", "Clips and short-form video from trainers."] as const,
            ] as const
          ).map(([key, label, hint]) => (
            <li
              key={key}
              className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-white/90">{label}</p>
                <p className="mt-1 text-xs text-white/45">{hint}</p>
              </div>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                className="mt-1 h-5 w-5 shrink-0 accent-[#FF7E00]"
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white/90">Playback & Feed Balance</h2>
        <ul className="space-y-3">
          <li className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white/90">Autoplay Video (Muted)</p>
              <p className="mt-1 text-xs text-white/45">Browsers may still block autoplay until you interact with the page.</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.autoplayVideo}
              onChange={(e) => setPrefs((p) => ({ ...p, autoplayVideo: e.target.checked }))}
              className="mt-1 h-5 w-5 shrink-0 accent-[#FF7E00]"
            />
          </li>
          <li className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white/90">Hide Back-to-Back Posts from the Same Trainer</p>
              <p className="mt-1 text-xs text-white/45">Keeps your feed varied when one trainer has many recent posts.</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.hideRepeatedTrainers}
              onChange={(e) => setPrefs((p) => ({ ...p, hideRepeatedTrainers: e.target.checked }))}
              className="mt-1 h-5 w-5 shrink-0 accent-[#FF7E00]"
            />
          </li>
        </ul>
      </section>

      <div className="flex justify-center pt-2">
        <button
          type="submit"
          disabled={saving}
          className="group relative isolate flex min-h-[3rem] w-full max-w-md items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
        >
          <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
          <span className="relative">{saving ? "SAVING…" : "SAVE FITHUB SETTINGS"}</span>
        </button>
      </div>
    </form>
  );
}
