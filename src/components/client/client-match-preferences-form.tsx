"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SERVICE_TYPES, type ClientMatchPreferences, defaultClientMatchPreferences } from "@/lib/client-match-preferences";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

const labelClass = "text-xs font-semibold uppercase tracking-wide text-white/50";

type Props = {
  mode: "onboarding" | "settings";
};

export function ClientMatchPreferencesForm(props: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<ClientMatchPreferences>({ ...defaultClientMatchPreferences });
  const [allowTrainerDiscovery, setAllowTrainerDiscovery] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/client/preferences");
        const data = (await res.json()) as {
          preferences?: ClientMatchPreferences;
          allowTrainerDiscovery?: boolean;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load preferences.");
          return;
        }
        if (data.preferences) {
          setPrefs({ ...defaultClientMatchPreferences, ...data.preferences });
        }
        if (typeof data.allowTrainerDiscovery === "boolean") {
          setAllowTrainerDiscovery(data.allowTrainerDiscovery);
        }
      } catch {
        if (!cancelled) setError("Could not load preferences.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleService(t: (typeof SERVICE_TYPES)[number]) {
    setPrefs((p) => {
      const has = p.serviceTypes.includes(t);
      const next = has ? p.serviceTypes.filter((x) => x !== t) : [...p.serviceTypes, t];
      return { ...p, serviceTypes: next.length ? next : [t] };
    });
  }

  function toggleDelivery(d: ClientMatchPreferences["deliveryModes"][number]) {
    setPrefs((p) => {
      const has = p.deliveryModes.includes(d);
      const next = has ? p.deliveryModes.filter((x) => x !== d) : [...p.deliveryModes, d];
      return { ...p, deliveryModes: next.length ? next : [d] };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        preferences: prefs,
        allowTrainerDiscovery,
      };
      if (props.mode === "onboarding") {
        body.markComplete = true;
      }
      const res = await fetch("/api/client/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      if (props.mode === "onboarding") {
        router.push("/client/dashboard");
        router.refresh();
        return;
      }
      setOk("Preferences saved.");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-center text-sm text-white/50">Loading preferences…</p>;
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
        <label className={labelClass} htmlFor="goals">
          What are you looking to accomplish?
        </label>
        <textarea
          id="goals"
          rows={4}
          value={prefs.goals}
          onChange={(e) => setPrefs((p) => ({ ...p, goals: e.target.value }))}
          className={`${inputClass} resize-y`}
          placeholder="Strength, weight management, sport performance, habit change…"
        />
      </section>

      <section className="space-y-3">
        <p className={labelClass}>Service type</p>
        <div className="flex flex-wrap gap-3">
          {SERVICE_TYPES.map((t) => (
            <label
              key={t}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-[#12151C]/80 px-4 py-3 text-sm text-white/85"
            >
              <input
                type="checkbox"
                checked={prefs.serviceTypes.includes(t)}
                onChange={() => toggleService(t)}
                className="h-4 w-4 accent-[#FF7E00]"
              />
              {t === "personal_training" ? "Personal training" : "Nutrition coaching"}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className={labelClass}>How do you want to work together?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["in_person", "In-person sessions"],
              ["mobile", "Mobile / house-call"],
              ["virtual", "Virtual sessions"],
              ["diy", "DIY programming / templates"],
              ["nutrition_planning", "Nutrition planning"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-[#12151C]/80 px-3 py-2.5 text-sm text-white/85"
            >
              <input
                type="checkbox"
                checked={prefs.deliveryModes.includes(key)}
                onChange={() => toggleDelivery(key)}
                className="h-4 w-4 accent-[#FF7E00]"
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <label className={labelClass} htmlFor="niches">
          Training niches you care about
        </label>
        <textarea
          id="niches"
          rows={3}
          value={prefs.fitnessNiches}
          onChange={(e) => setPrefs((p) => ({ ...p, fitnessNiches: e.target.value }))}
          className={`${inputClass} resize-y`}
          placeholder="e.g. powerlifting, postpartum, marathon, corrective exercise — comma separated"
        />
        <p className="text-xs text-white/40">
          We use this text (plus your goals) to rank coaches. You can widen results anytime on Find coaches.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-white/80">
          <input
            type="checkbox"
            checked={prefs.allowRelaxedSearchDefault}
            onChange={(e) => setPrefs((p) => ({ ...p, allowRelaxedSearchDefault: e.target.checked }))}
            className="mt-1 h-4 w-4 accent-[#FF7E00]"
          />
          <span>
            <span className="font-semibold text-white">Relax matching by default</span>
            <span className="mt-1 block text-xs text-white/45">
              When on, the Find coaches screen starts in “near match” mode so you still see great coaches who are close to
              your delivery style or niche wording.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-white/80">
          <input
            type="checkbox"
            checked={allowTrainerDiscovery}
            onChange={(e) => setAllowTrainerDiscovery(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[#FF7E00]"
          />
          <span>
            <span className="font-semibold text-white">Let verified coaches discover my profile</span>
            <span className="mt-1 block text-xs text-white/45">
              Coaches who fit Match Fit compliance can open your public profile and send a single nudge to invite a
              conversation. You can turn this off anytime.
            </span>
          </span>
        </label>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="group relative isolate flex min-h-[3rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
      >
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
        <span className="relative">
          {saving ? "Saving…" : props.mode === "onboarding" ? "Save & enter dashboard" : "Save match preferences"}
        </span>
      </button>
    </form>
  );
}
