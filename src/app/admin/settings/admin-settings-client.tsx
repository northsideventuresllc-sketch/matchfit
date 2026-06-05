"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  ADMIN_DASHBOARD_LAYOUT_STORAGE_KEY,
  type AdminDashboardLayout,
  serializeAdminDashboardLayout,
} from "@/lib/admin-dashboard-layout";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { adminPortalLinkClass, adminPortalPrimaryButtonClass } from "@/components/admin/admin-portal-styles";
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
    <AdminPortalShell
      current="settings"
      maxWidth="3xl"
      title="Dashboard Settings"
      description="Choose presets, visible sections, and density for your dashboard. Collapse state is saved when you expand or collapse panels on the main dashboard. Test accounts and sandbox billing are always excluded from analytics totals."
    >
      <section className="rounded-2xl border border-white/[0.08] bg-[#12151C]/75 p-5 backdrop-blur-xl">
        <p className="text-sm text-white/70">
          Use the layout editor to show or hide sections such as site traffic, revenue, impersonation audit, and AI
          insights.
        </p>
        <button type="button" onClick={() => setCustomizerOpen(true)} className={`mt-4 ${adminPortalPrimaryButtonClass}`}>
          Edit Dashboard Layout
        </button>
        {message ? <p className="mt-4 text-sm text-emerald-200/90">{message}</p> : null}
        <p className="mt-4 text-xs text-white/40">
          <Link href="/admin" className={adminPortalLinkClass}>
            Back to Dashboard
          </Link>
        </p>
      </section>

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
    </AdminPortalShell>
  );
}
