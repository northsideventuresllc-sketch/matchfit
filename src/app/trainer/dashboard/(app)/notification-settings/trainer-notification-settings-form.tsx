"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type TrainerNotificationPrefs,
  defaultTrainerNotificationPrefs,
} from "@/lib/trainer-notification-prefs";

const ROWS: { key: keyof TrainerNotificationPrefs; label: string; hint: string }[] = [
  { key: "pushClientInquiry", label: "Client inquiries", hint: "When a client requests you or accepts a connection." },
  { key: "pushChatMessages", label: "Chat messages", hint: "New messages in threads with clients." },
  {
    key: "pushCertificationUpdates",
    label: "Credential reviews",
    hint: "Status changes on CPT, nutrition, or other uploaded certifications.",
  },
  {
    key: "pushComplianceReminders",
    label: "Compliance reminders",
    hint: "Background check, W-9, agreements, and other onboarding tasks.",
  },
  { key: "pushBilling", label: "Billing & payouts", hint: "Charges, receipts, failed payments, and payout notices." },
  { key: "pushPlatformUpdates", label: "Platform & safety", hint: "Product updates, policy changes, and account security." },
];

export function TrainerNotificationSettingsForm() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<TrainerNotificationPrefs>({ ...defaultTrainerNotificationPrefs });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/trainer/notification-prefs");
          const data = (await res.json()) as { preferences?: TrainerNotificationPrefs; error?: string };
          if (cancelled) return;
          if (!res.ok) {
            setError(data.error ?? "Could not load settings.");
            return;
          }
          if (data.preferences) setPrefs({ ...defaultTrainerNotificationPrefs, ...data.preferences });
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
      const res = await fetch("/api/trainer/notification-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      setOk("Notification preferences saved.");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-center text-sm text-white/45">Loading notification settings…</p>;
  }

  return (
    <form onSubmit={(ev) => void handleSubmit(ev)} className="space-y-6">
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

      <p className="text-sm text-white/55">
        These toggles control which categories can surface push notifications as Match Fit rolls out native push for
        coaches. In-app notifications may still appear for critical billing, compliance, and safety events.
      </p>

      <ul className="space-y-4">
        {ROWS.map((row) => (
          <li
            key={row.key}
            className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-white/90">{row.label}</p>
              <p className="mt-1 text-xs text-white/45">{row.hint}</p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={prefs[row.key]}
                onChange={(e) => setPrefs((p) => ({ ...p, [row.key]: e.target.checked }))}
                className="h-5 w-5 accent-[#FF7E00]"
              />
              <span className="text-[10px] font-black uppercase tracking-wide text-white/40">Push</span>
            </label>
          </li>
        ))}
      </ul>

      <button
        type="submit"
        disabled={saving}
        className="group relative isolate mx-auto flex min-h-[3rem] w-full max-w-md items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
      >
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
        <span className="relative">{saving ? "SAVING…" : "SAVE NOTIFICATION PREFERENCES"}</span>
      </button>
    </form>
  );
}
