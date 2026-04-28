"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ClientFithubFeedStyle,
  type ClientFithubPrefs,
  defaultClientFithubPrefs,
} from "@/lib/client-fithub-prefs";

const FEED_STYLES: { value: ClientFithubFeedStyle; label: string; hint: string }[] = [
  {
    value: "ALGORITHMIC",
    label: "Algorithmic",
    hint: "Blend of engagement, freshness, and coaches you interact with.",
  },
  { value: "NEWEST", label: "Newest first", hint: "Strict reverse chronological order." },
  {
    value: "SAVED_COACHES_ONLY",
    label: "Saved coaches only",
    hint: "Only posts from coaches you have saved to your list.",
  },
];

export function ClientFitHubSettingsForm() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<ClientFithubPrefs>({ ...defaultClientFithubPrefs });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/client/fithub-prefs");
          const data = (await res.json()) as { preferences?: ClientFithubPrefs; error?: string };
          if (cancelled) return;
          if (!res.ok) {
            setError(data.error ?? "Could not load settings.");
            return;
          }
          if (data.preferences) setPrefs({ ...defaultClientFithubPrefs, ...data.preferences });
        } catch {
          if (!cancelled) setError("Could not load settings.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/client/fithub-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      setOk("FitHub preferences saved.");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-center text-sm text-white/45">Loading FitHub settings…</p>;
  }

  return (
    <form onSubmit={(ev) => void handleSubmit(ev)} className="space-y-8">
      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100" role="status">
          {ok}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white/90">Feed generation</h2>
        <p className="text-xs text-white/45">Control how posts are ordered and which coaches can appear.</p>
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
        <h2 className="text-sm font-semibold text-white/90">Discovery & relevance</h2>
        <ul className="space-y-3">
          <li className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white/90">Prioritize saved coaches</p>
              <p className="mt-1 text-xs text-white/45">Boosts posts from coaches you have saved when using the algorithmic feed.</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.prioritizeSavedCoaches}
              onChange={(e) => setPrefs((p) => ({ ...p, prioritizeSavedCoaches: e.target.checked }))}
              className="mt-1 h-5 w-5 shrink-0 accent-[#FF7E00]"
            />
          </li>
          <li className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white/90">Emphasize coaches in your circle</p>
              <p className="mt-1 text-xs text-white/45">
                Until regional routing ships, this uses saved coaches as a stand-in for “near you” in the algorithmic mix.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.onlyTrainersInYourArea}
              onChange={(e) => setPrefs((p) => ({ ...p, onlyTrainersInYourArea: e.target.checked }))}
              className="mt-1 h-5 w-5 shrink-0 accent-[#FF7E00]"
            />
          </li>
          <li className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white/90">Hide back-to-back posts from the same coach</p>
              <p className="mt-1 text-xs text-white/45">Keeps the feed varied when many posts exist from one creator.</p>
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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white/90">Content types</h2>
        <ul className="space-y-3">
          {(
            [
              ["showTextPosts", "Text posts", "Written updates and long captions."] as const,
              ["showImagePosts", "Photo posts", "Still frames and image carousels (when available)."] as const,
              ["showVideoPosts", "Video posts", "Clips and short-form video from coaches."] as const,
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
        <h2 className="text-sm font-semibold text-white/90">Playback & sensitivity</h2>
        <ul className="space-y-3">
          <li className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white/90">Autoplay video (muted)</p>
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
              <p className="text-sm font-semibold text-white/90">Show high-intensity content</p>
              <p className="mt-1 text-xs text-white/45">
                Reserved for future labels (max-effort, competition prep). Turning this off will hide tagged posts when the
                taxonomy ships.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.showHighIntensityContent}
              onChange={(e) => setPrefs((p) => ({ ...p, showHighIntensityContent: e.target.checked }))}
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
          <span className="relative">{saving ? "SAVING…" : "SAVE FITHUB PREFERENCES"}</span>
        </button>
      </div>
    </form>
  );
}
