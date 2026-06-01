"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_DASHBOARD_WIDGET_LABELS,
  ADMIN_DASHBOARD_WIDGETS,
  type AdminDashboardWidgetId,
} from "@/lib/admin-dashboard-widgets";
import { AdminPortalNav } from "@/components/admin/admin-portal-nav";

export function AdminSettingsClient(props: { initialEnabled: AdminDashboardWidgetId[] }) {
  const [enabled, setEnabled] = useState<Set<AdminDashboardWidgetId>>(new Set(props.initialEnabled));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggle(id: AdminDashboardWidgetId) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const save = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/dashboard-preferences", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledWidgets: [...enabled] }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Could not save.");
        return;
      }
      setMessage("Saved. Return to the dashboard to see your layout.");
    } finally {
      setSaving(false);
    }
  }, [enabled]);

  return (
    <main className="relative min-h-dvh bg-[#050608] px-5 py-10 text-white sm:px-8">
      <div className="relative mx-auto max-w-3xl space-y-8">
        <header className="space-y-4">
          <AdminPortalNav current="settings" />
          <div>
            <h1 className="text-2xl font-black">Dashboard settings</h1>
            <p className="mt-2 text-sm text-white/55">
              Choose which metrics and tools appear on your administrator dashboard. Test accounts and sandbox
              billing are always excluded from analytics totals.
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 p-5 space-y-3">
          {ADMIN_DASHBOARD_WIDGETS.map((id) => (
            <label
              key={id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#07080c]/80 px-4 py-3"
            >
              <input
                type="checkbox"
                checked={enabled.has(id)}
                onChange={() => toggle(id)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-white">{ADMIN_DASHBOARD_WIDGET_LABELS[id]}</span>
                <span className="block font-mono text-[10px] text-white/35">{id}</span>
              </span>
            </label>
          ))}
        </section>

        {message ? <p className="text-sm text-cyan-200/90">{message}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-xl bg-cyan-500/20 px-5 py-3 text-xs font-black uppercase tracking-wide text-cyan-50 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
          <Link href="/admin" className="rounded-xl border border-white/15 px-5 py-3 text-xs font-black uppercase text-white/75">
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
