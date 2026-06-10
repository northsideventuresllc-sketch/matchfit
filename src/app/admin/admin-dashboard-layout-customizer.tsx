"use client";

import { useMemo, useState } from "react";
import {
  ADMIN_DASHBOARD_LAYOUT_PRESETS,
  type AdminDashboardLayout,
  type AdminDashboardLayoutPresetId,
  DEFAULT_ADMIN_DASHBOARD_LAYOUT,
  type AdminDashboardSectionId,
  applyLayoutPreset,
  isSectionVisible,
  moveSection,
  sectionsByGroup,
  setLayoutDensity,
  setSectionVisible,
} from "@/lib/admin-dashboard-layout";
import {
  adminPortalPrimaryButtonClass,
  adminPortalSecondaryButtonClass,
} from "@/components/admin/admin-portal-styles";

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

  function applyPreset(presetId: AdminDashboardLayoutPresetId) {
    setDraft((prev) => applyLayoutPreset(prev, presetId));
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
        className="max-h-[min(92vh,44rem)] w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#12151C] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/[0.08] px-5 py-4">
          <h2 id="admin-layout-customizer-title" className="text-lg font-black text-white">
            Customize dashboard
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Pick a preset, choose visible sections, set density, and reorder. Collapse state is saved when you expand or
            collapse panels on the dashboard.
          </p>
        </div>

        <div className="max-h-[min(62vh,30rem)] overflow-y-auto px-5 py-4">
          <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF7E00]/70">Quick presets</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ADMIN_DASHBOARD_LAYOUT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.description}
                  onClick={() => applyPreset(preset.id)}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/70 transition hover:border-[#FF7E00]/35 hover:text-[#FFD34E]"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF7E00]/70">Density</p>
            <div className="mt-2 flex gap-2">
              {(["comfortable", "compact"] as const).map((density) => (
                <button
                  key={density}
                  type="button"
                  onClick={() => setDraft((prev) => setLayoutDensity(prev, density))}
                  className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition ${
                    draft.density === density
                      ? "border-[#FF7E00]/40 bg-[#FF7E00]/15 text-[#FFD34E]"
                      : "border-white/10 text-white/55 hover:bg-white/[0.05]"
                  }`}
                >
                  {density}
                </button>
              ))}
            </div>
          </div>

          {(["Overview", "Analytics", "Activity", "Operations"] as const).map((groupName) => (
            <div key={groupName} className="mb-5 last:mb-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF7E00]/60">{groupName}</p>
              <ul className="mt-2 space-y-2">
                {grouped[groupName].map((meta) => {
                  const visible = isSectionVisible(draft, meta.id);
                  const orderIndex = draft.order.indexOf(meta.id);
                  return (
                    <li
                      key={meta.id}
                      className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-[#0E1016]/90 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => toggle(meta.id)}
                          className="mt-0.5 size-4 shrink-0 rounded border-white/20 bg-[#050608] accent-[#FF7E00]"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold uppercase tracking-wide text-white">
                            {meta.label}
                          </span>
                          <span className="block text-[11px] leading-snug uppercase tracking-wide text-white/40">
                            {meta.description}
                          </span>
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
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDraft({ ...DEFAULT_ADMIN_DASHBOARD_LAYOUT })}
                className={adminPortalSecondaryButtonClass}
              >
                Reset Defaults
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    hidden: [],
                  }))
                }
                className={adminPortalSecondaryButtonClass}
              >
                Show All
              </button>
              <button
                type="button"
                disabled={props.saving}
                onClick={() => props.onSave(draft)}
                className={adminPortalPrimaryButtonClass}
              >
                {props.saving ? "Saving…" : "Save Layout"}
              </button>
            </div>
            <button type="button" onClick={props.onClose} className={adminPortalSecondaryButtonClass}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
