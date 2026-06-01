"use client";

import { useMemo, useState } from "react";
import {
  ADMIN_DASHBOARD_SECTIONS,
  type AdminDashboardLayout,
  DEFAULT_ADMIN_DASHBOARD_LAYOUT,
  type AdminDashboardSectionId,
  isSectionVisible,
  moveSection,
  sectionsByGroup,
  setSectionVisible,
} from "@/lib/admin-dashboard-layout";

export function AdminDashboardLayoutCustomizer(props: {
  layout: AdminDashboardLayout;
  saving: boolean;
  saveError: string | null;
  persistedHint: string | null;
  onSave: (layout: AdminDashboardLayout) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(props.layout);
  const grouped = useMemo(() => sectionsByGroup(), []);

  function toggle(id: AdminDashboardSectionId) {
    setDraft((prev) => setSectionVisible(prev, id, !isSectionVisible(prev, id)));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-layout-customizer-title"
      onClick={props.onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") props.onClose();
      }}
    >
      <div
        className="max-h-[min(90vh,42rem)] w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0c0f14] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/[0.08] px-5 py-4">
          <h2 id="admin-layout-customizer-title" className="text-lg font-black text-white">
            Customize dashboard
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Choose which sections appear and their order. Saved to your staff account when the database column is
            available; otherwise this browser only.
          </p>
        </div>

        <div className="max-h-[min(60vh,28rem)] overflow-y-auto px-5 py-4">
          {(["Overview", "Analytics", "Activity", "Operations"] as const).map((groupName) => (
            <div key={groupName} className="mb-5 last:mb-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300/60">{groupName}</p>
              <ul className="mt-2 space-y-2">
                {grouped[groupName].map((meta) => {
                  const visible = isSectionVisible(draft, meta.id);
                  const orderIndex = draft.order.indexOf(meta.id);
                  return (
                    <li
                      key={meta.id}
                      className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-[#07080c]/90 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => toggle(meta.id)}
                          className="mt-0.5 size-4 shrink-0 rounded border-white/20 bg-[#050608] accent-cyan-400"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-white">{meta.label}</span>
                          <span className="block text-[11px] leading-snug text-white/40">{meta.description}</span>
                        </span>
                      </label>
                      <div className="flex shrink-0 gap-1 sm:ml-2">
                        <button
                          type="button"
                          disabled={orderIndex <= 0}
                          onClick={() => setDraft((prev) => moveSection(prev, meta.id, "up"))}
                          className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold uppercase text-white/60 hover:bg-white/[0.06] disabled:opacity-30"
                          aria-label={`Move ${meta.label} up`}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          disabled={orderIndex < 0 || orderIndex >= draft.order.length - 1}
                          onClick={() => setDraft((prev) => moveSection(prev, meta.id, "down"))}
                          className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold uppercase text-white/60 hover:bg-white/[0.06] disabled:opacity-30"
                          aria-label={`Move ${meta.label} down`}
                        >
                          Down
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-white/[0.08] px-5 py-4">
          {props.saveError ? (
            <p className="text-sm text-[#FFB4B4]" role="alert">
              {props.saveError}
            </p>
          ) : null}
          {props.persistedHint ? <p className="text-[11px] text-amber-200/80">{props.persistedHint}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDraft({ ...DEFAULT_ADMIN_DASHBOARD_LAYOUT })}
              className="rounded-lg border border-white/15 px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-white/70 hover:bg-white/[0.06]"
            >
              Reset defaults
            </button>
            <button
              type="button"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  hidden: [],
                }))
              }
              className="rounded-lg border border-white/15 px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-white/70 hover:bg-white/[0.06]"
            >
              Show all
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-lg border border-white/15 px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-white/70 hover:bg-white/[0.06]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={props.saving}
              onClick={() => props.onSave(draft)}
              className="rounded-lg border border-cyan-400/35 bg-cyan-500/15 px-4 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-cyan-50 hover:bg-cyan-500/20 disabled:opacity-40"
            >
              {props.saving ? "Saving…" : "Save layout"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
