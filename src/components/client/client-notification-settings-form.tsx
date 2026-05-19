"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ClientNotificationPrefs,
  defaultClientNotificationPrefs,
} from "@/lib/client-notification-prefs";

type ClientPushNotificationPrefKey = keyof Pick<
  ClientNotificationPrefs,
  | "pushNudge"
  | "pushNewMatch"
  | "pushDailyQuestionnaire"
  | "pushAppUpdate"
  | "pushBilling"
  | "pushSystem"
>;

const PUSH_ROWS: { key: ClientPushNotificationPrefKey; label: string; hint: string }[] = [
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
        Choose how Match Fit reaches you. Required account emails (sign-in codes, password resets, and similar security
        messages) are always sent. In-app notifications may still appear for critical billing and safety events.
      </p>

      <SettingsPanel title="Email from Match Fit">
        <p className="text-xs leading-relaxed text-white/45">
          Welcome messages, purchase confirmations, billing updates, compliance notices, trust &amp; safety alerts, and
          product messages are sent when the situation requires them. You cannot turn these off in settings.
        </p>
      </SettingsPanel>

      <SettingsPanel title="Coach Package Receipts">
        <p className="text-xs leading-relaxed text-white/45">
          After you pay a trainer on Match Fit, choose how we send a duplicate receipt. You always get an in-app Billing
          notification. You can select more than one option.
        </p>
        <ul className="mt-4 space-y-3">
          <ReceiptToggleRow
            label="Email"
            hint="Duplicate receipt to your account email."
            checked={prefs.coachPurchaseReceiptEmail}
            onChange={(checked) => setPrefs((p) => ({ ...p, coachPurchaseReceiptEmail: checked }))}
          />
          <ReceiptToggleRow
            label="Push"
            hint="Lock-screen alert on the Match Fit app when available."
            checked={prefs.coachPurchaseReceiptPush}
            onChange={(checked) => setPrefs((p) => ({ ...p, coachPurchaseReceiptPush: checked }))}
          />
        </ul>
      </SettingsPanel>

      <SettingsPanel title="Push Notifications">
        <p className="text-xs leading-relaxed text-white/45">
          These categories control push alerts in the Match Fit app as we roll out native push.
        </p>
        <ul className="mt-4 space-y-4">
          {PUSH_ROWS.map((row) => (
            <li
              key={row.key}
              className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-white/90">{row.label}</p>
                <p className="mt-1 text-xs text-white/45">{row.hint}</p>
              </div>
              <PrefCheckbox
                checked={prefs[row.key]}
                onChange={(checked) => setPrefs((p) => ({ ...p, [row.key]: checked }))}
              />
            </li>
          ))}
        </ul>
      </SettingsPanel>

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

function SettingsPanel(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 px-4 py-3">
      <p className="text-sm font-semibold text-white/90">{props.title}</p>
      <div className="mt-3">{props.children}</div>
    </section>
  );
}

function ReceiptToggleRow(props: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <li className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.04] bg-[#0B0C0F]/40 px-3 py-2.5">
      <div>
        <p className="text-sm font-semibold text-white/90">{props.label}</p>
        <p className="mt-1 text-xs text-white/45">{props.hint}</p>
      </div>
      <PrefCheckbox checked={props.checked} onChange={props.onChange} />
    </li>
  );
}

function PrefCheckbox(props: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        className="h-5 w-5 accent-[#FF7E00]"
      />
    </label>
  );
}
