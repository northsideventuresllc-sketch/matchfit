"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ClientNotificationPrefs,
  coachPurchaseReceiptDeliveries,
  defaultClientNotificationPrefs,
} from "@/lib/client-notification-prefs";
import { WebPushEnrollmentCard } from "@/components/web-push-enrollment-card";

type ClientPushNotificationPrefKey = Exclude<
  keyof ClientNotificationPrefs,
  "coachPurchaseReceiptDelivery" | "emailWelcome" | "emailPurchases" | "emailBilling" | "emailCompliance" | "emailTrustSafety" | "emailProduct"
>;

const EMAIL_ROWS: {
  key: "emailWelcome" | "emailPurchases" | "emailBilling" | "emailCompliance" | "emailTrustSafety" | "emailProduct";
  label: string;
  hint: string;
}[] = [
  { key: "emailWelcome", label: "Welcome email", hint: "Branded welcome message after your account is created." },
  { key: "emailPurchases", label: "Purchases & receipts", hint: "Coach package confirmations and related receipts." },
  { key: "emailBilling", label: "Subscription & billing", hint: "Membership changes, renewals, and payment issues." },
  { key: "emailCompliance", label: "Compliance & screening", hint: "Background check or verification updates." },
  { key: "emailTrustSafety", label: "Trust & safety", hint: "Policy reminders, moderation notices, and serious account alerts." },
  { key: "emailProduct", label: "Product & support", hint: "Bug report acknowledgments and similar messages." },
];

const ROWS: { key: ClientPushNotificationPrefKey; label: string; hint: string }[] = [
  { key: "pushNudge", label: "Coach Nudges", hint: "When a trainer nudges you from discovery." },
  { key: "pushNewMatch", label: "New Fitness Matches", hint: "When you save a coach or a match is suggested." },
  {
    key: "pushDailyQuestionnaire",
    label: "Daily Questionnaire",
    hint: "Reminders when a new daily check-in is available.",
  },
  { key: "pushAppUpdate", label: "App Updates", hint: "Product releases and required upgrades." },
  { key: "pushBilling", label: "Billing", hint: "Renewals, failed charges, receipts, and overdue notices." },
  { key: "pushSystem", label: "System & Safety", hint: "Account security and platform notices." },
];

export function ClientNotificationSettingsForm() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<ClientNotificationPrefs>({ ...defaultClientNotificationPrefs });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/client/notification-prefs");
          const data = (await res.json()) as { preferences?: ClientNotificationPrefs; error?: string };
          if (cancelled) return;
          if (!res.ok) {
            setError(data.error ?? "Could not load settings.");
            return;
          }
          if (data.preferences) setPrefs({ ...defaultClientNotificationPrefs, ...data.preferences });
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
      const res = await fetch("/api/client/notification-prefs", {
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
        These toggles control Web Push categories on supported browsers. In-app notifications may still appear for
        critical billing and safety events.
      </p>

      <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3">
        <p className="text-sm font-semibold text-white/90">Coach Package Receipts</p>
        <p className="mt-1 text-xs text-white/45">
          After you pay a trainer on Match Fit, how (or if) we send a duplicate receipt by email or Web Push. You always
          get an in-app Billing notification.
        </p>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
          <div className="min-w-0 shrink-0 pt-0.5 sm:max-w-[11rem]">
            <p className="text-[10px] font-black uppercase tracking-wide text-white/40">Receipt copy</p>
          </div>
          <select
            value={prefs.coachPurchaseReceiptDelivery}
            onChange={(e) =>
              setPrefs((p) => ({
                ...p,
                coachPurchaseReceiptDelivery: e.target.value as (typeof coachPurchaseReceiptDeliveries)[number],
              }))
            }
            className="w-full min-w-0 flex-1 rounded-lg border border-white/15 bg-[#0B0C0F] px-4 py-2.5 text-sm text-white sm:max-w-md"
          >
            {coachPurchaseReceiptDeliveries.map((v) => (
              <option key={v} value={v}>
                {v === "EMAIL" ? "Email" : v === "PUSH" ? "Web Push only" : "In-app only (no duplicate receipt)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3">
        <p className="text-sm font-semibold text-white/90">Email from Match Fit</p>
        <p className="mt-1 text-xs text-white/45">
          Security emails (sign-in codes, password resets, email-change links) are always sent. Optional categories can be
          turned off below.
        </p>
        <ul className="mt-4 space-y-4">
          {EMAIL_ROWS.map((row) => (
            <li
              key={row.key}
              className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.04] bg-[#0B0C0F]/40 px-3 py-2.5"
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
                <span className="text-[10px] font-black uppercase tracking-wide text-white/40">Email</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

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
            <label className="flex cursor-pointer items-center gap-2 shrink-0">
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

      <WebPushEnrollmentCard registerUrl="/api/client/settings/web-push" roleLabel="client" />

      <div className="flex justify-center pt-2">
        <button
          type="submit"
          disabled={saving}
          className="group relative isolate flex min-h-[3rem] w-full max-w-md items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
        >
          <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
          <span className="relative">{saving ? "SAVING…" : "SAVE NOTIFICATION PREFERENCES"}</span>
        </button>
      </div>
    </form>
  );
}
