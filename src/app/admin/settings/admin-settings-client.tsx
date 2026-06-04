"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  ADMIN_DASHBOARD_LAYOUT_STORAGE_KEY,
  type AdminDashboardLayout,
  serializeAdminDashboardLayout,
} from "@/lib/admin-dashboard-layout";
import { AdminPortalNav } from "@/components/admin/admin-portal-nav";
import {
  AdminPortalBackdrop,
  adminAccentButtonClass,
  adminLinkClass,
  adminPanelClass,
} from "@/components/admin/admin-portal-ui";
import { AdminDashboardLayoutCustomizer } from "../admin-dashboard-layout-customizer";

export function AdminSettingsClient(props: {
  administratorId: string;
  initialLayout: AdminDashboardLayout;
  layoutLoadedFromServer: boolean;
}) {
  const [layout, setLayout] = useState(props.initialLayout);
  const [customizerOpen, setCustomizerOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const layoutStorageKey = `${ADMIN_DASHBOARD_LAYOUT_STORAGE_KEY}:${props.administratorId}`;

  const saveLayout = useCallback(
    async (next: AdminDashboardLayout) => {
      setSaving(true);
      setMessage(null);
      try {
        const res = await fetch("/api/admin/dashboard-layout", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layout: next }),
        });
        const data = (await res.json()) as { error?: string; persisted?: boolean };
        if (!res.ok) {
          setMessage(data.error ?? "Could not save layout.");
          return;
        }
        setLayout(next);
        try {
          localStorage.setItem(layoutStorageKey, serializeAdminDashboardLayout(next));
        } catch {
          /* ignore */
        }
        setMessage(
          data.persisted
            ? "Saved to your staff account. Return to the dashboard to see your layout."
            : "Saved in this browser. Run the latest database migration to persist across devices.",
        );
        setCustomizerOpen(false);
      } finally {
        setSaving(false);
      }
    },
    [layoutStorageKey],
  );

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] px-5 py-10 text-white sm:px-8 sm:py-12">
      <AdminPortalBackdrop />
      <div className="relative z-10 mx-auto max-w-3xl space-y-8">
        <header className="space-y-4">
          <AdminPortalNav current="settings" />
          <div>
            <h1 className="text-2xl font-black">Dashboard settings</h1>
            <p className="mt-2 text-sm text-white/55">
              Choose which metrics and tools appear on your administrator dashboard. Test accounts and sandbox billing
              are always excluded from analytics totals.
            </p>
          </div>
        </header>

        <section className={`${adminPanelClass} p-5`}>
          <p className="text-sm text-white/70">
            Use the layout editor to show or hide sections such as site traffic, revenue, impersonation audit, and AI
            insights.
          </p>
          <button
            type="button"
            onClick={() => setCustomizerOpen(true)}
            className={`mt-4 ${adminAccentButtonClass} px-4 py-2.5 text-xs hover:bg-[#FF7E00]/15`}
          >
            Edit dashboard layout
          </button>
          {message ? <p className="mt-4 text-sm text-emerald-200/90">{message}</p> : null}
          <p className="mt-4 text-xs text-white/40">
            <Link href="/admin" className={adminLinkClass}>
              Back to dashboard
            </Link>
          </p>
        </section>
      </div>

      {customizerOpen ? (
        <AdminDashboardLayoutCustomizer
          layout={layout}
          saving={saving}
          saveError={null}
          persistedHint={props.layoutLoadedFromServer ? "Saved to your account" : null}
          onSave={(next) => void saveLayout(next)}
          onClose={() => setCustomizerOpen(false)}
        />
      ) : null}
    </main>
  );
}
