"use client";

import { useEffect, useState } from "react";
import {
  type TrainerNotificationPrefs,
  defaultTrainerNotificationPrefs,
} from "@/lib/trainer-notification-prefs";

type Summary = {
  mode: "placeholder";
  email: string;
  premiumStudioActive: boolean;
  premiumStudioEnabledAt: string | null;
  message: string;
};

export function TrainerBillingPageClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [prefs, setPrefs] = useState<TrainerNotificationPrefs>({ ...defaultTrainerNotificationPrefs });
  const [error, setError] = useState<string | null>(null);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [prefsOk, setPrefsOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/trainer/billing/summary");
        const data = (await res.json()) as Summary & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load billing.");
          return;
        }
        setSummary({
          mode: data.mode,
          email: data.email,
          premiumStudioActive: data.premiumStudioActive,
          premiumStudioEnabledAt: data.premiumStudioEnabledAt,
          message: data.message,
        });

        const prefsRes = await fetch("/api/trainer/notification-prefs");
        const prefsData = (await prefsRes.json()) as { preferences?: TrainerNotificationPrefs };
        if (prefsRes.ok && prefsData.preferences) {
          setPrefs({ ...defaultTrainerNotificationPrefs, ...prefsData.preferences });
        }
      } catch {
        if (!cancelled) setError("Could not load billing.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
        {error}
      </p>
    );
  }

  if (!summary) {
    return <p className="text-center text-sm text-white/45">Loading billing…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 sm:p-8">
        <div className="space-y-2 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Premium subscription</p>
          <p className="text-sm text-white/75">
            {summary.premiumStudioActive ? "STATUS: ACTIVE" : "STATUS: NOT ACTIVE"}
          </p>
          {summary.premiumStudioEnabledAt ? (
            <p className="text-xs text-white/50">
              STARTED:{" "}
              <span className="font-semibold text-white/80">
                {new Date(summary.premiumStudioEnabledAt).toLocaleDateString(undefined, {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/60 px-4 py-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Billing History</p>
          <p className="mt-2 text-sm text-white/80">{summary.message}</p>
          <p className="mt-2 text-xs text-white/35">
            Your trainer billing history, invoices, and payment methods will appear here when Stripe for coaches is
            connected.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#0E1016]/60 px-4 py-4">
          <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-white/40">
            Billing Notifications
          </p>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-[#12151C]/70 px-4 py-3">
              <span className="text-sm text-white/85">Email Billing Notifications</span>
              <input
                type="checkbox"
                checked={prefs.billingEmailNotifications}
                onChange={(e) => {
                  setPrefsOk(null);
                  setPrefs((p) => ({ ...p, billingEmailNotifications: e.target.checked }));
                }}
                className="h-5 w-5 accent-[#FF7E00]"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-[#12151C]/70 px-4 py-3">
              <span className="text-sm text-white/85">Text Billing Notifications</span>
              <input
                type="checkbox"
                checked={prefs.billingTextNotifications}
                onChange={(e) => {
                  setPrefsOk(null);
                  setPrefs((p) => ({ ...p, billingTextNotifications: e.target.checked }));
                }}
                className="h-5 w-5 accent-[#FF7E00]"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              disabled={prefsBusy}
              onClick={async () => {
                setPrefsBusy(true);
                setPrefsOk(null);
                setError(null);
                try {
                  const res = await fetch("/api/trainer/notification-prefs", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ preferences: prefs }),
                  });
                  const data = (await res.json()) as { error?: string };
                  if (!res.ok) {
                    setError(data.error ?? "Could not save billing notification settings.");
                    return;
                  }
                  setPrefsOk("Billing notification settings saved.");
                } catch {
                  setError("Could not save billing notification settings.");
                } finally {
                  setPrefsBusy(false);
                }
              }}
              className="inline-flex min-h-[2.6rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.08em] text-white/85 transition hover:border-white/25 disabled:opacity-40"
            >
              {prefsBusy ? "Saving…" : "Save Notification Settings"}
            </button>
          </div>
          {prefsOk ? <p className="mt-3 text-center text-xs text-emerald-200/85">{prefsOk}</p> : null}
          <p className="mt-4 text-center text-xs text-white/40">
            Account email on file: <span className="text-white/60">{summary.email}</span>
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {summary.premiumStudioActive ? (
            <>
              <a
                href="/trainer/dashboard/premium"
                className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/12 px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/50 sm:max-w-xs"
              >
                OPEN PREMIUM HUB
              </a>
              <a
                href="/trainer/dashboard/premium/fit-hub-content"
                className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.08em] text-white/85 transition hover:border-white/25 sm:max-w-xs"
              >
                FIT HUB &amp; CONTENT
              </a>
            </>
          ) : (
            <a
              href="/trainer/dashboard/premium"
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-[#FF7E00]/35 bg-[#FF7E00]/12 px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-[#FF7E00]/50 sm:max-w-xs"
            >
              PURCHASE PREMIUM PAGE
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
