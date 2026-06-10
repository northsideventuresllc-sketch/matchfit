"use client";

import type { ReactNode } from "react";
import {
  type AdminDashboardDensity,
  type AdminDashboardSectionId,
  adminDashboardSectionDomId,
} from "@/lib/admin-dashboard-layout";
import { adminPortalCardClass, adminPortalSecondaryButtonClass } from "@/components/admin/admin-portal-styles";

function ChevronIcon(props: { expanded: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={`size-5 shrink-0 text-white/50 transition-transform ${props.expanded ? "rotate-180" : ""}`}
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function AdminDashboardSectionPanel(props: {
  id: AdminDashboardSectionId;
  title: string;
  description?: string;
  collapsed: boolean;
  density: AdminDashboardDensity;
  onToggleCollapsed: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
}) {
  const bodyId = `${adminDashboardSectionDomId(props.id)}-body`;

  return (
    <section
      id={adminDashboardSectionDomId(props.id)}
      className={`scroll-mt-28 ${props.density === "compact" ? "scroll-mt-24" : "scroll-mt-28"}`}
      aria-labelledby={`${props.id}-heading`}
    >
      <div className={`${adminPortalCardClass} overflow-hidden`}>
        <div className="flex items-start gap-2 px-4 py-3.5 sm:gap-3 sm:px-5 sm:py-4">
          <button
            type="button"
            id={`${props.id}-heading`}
            aria-expanded={!props.collapsed}
            aria-controls={bodyId}
            onClick={props.onToggleCollapsed}
            className="flex min-w-0 flex-1 items-start gap-3 text-left transition hover:opacity-90"
          >
            <ChevronIcon expanded={!props.collapsed} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black uppercase tracking-[0.14em] text-white/85">
                {props.title}
              </span>
              {props.description ? (
                <span className="mt-1 block text-xs leading-snug text-white/45">{props.description}</span>
              ) : null}
              {props.collapsed ? (
                <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[#FF7E00]/70">
                  Collapsed — click to expand
                </span>
              ) : null}
            </span>
          </button>
          {props.onRefresh ? (
            <button
              type="button"
              onClick={() => props.onRefresh?.()}
              disabled={props.refreshing}
              className={`${adminPortalSecondaryButtonClass} shrink-0 px-3 py-2 text-[10px] tracking-[0.12em]`}
            >
              {props.refreshing ? "Refreshing…" : "Refresh Stats"}
            </button>
          ) : null}
        </div>

        <div
          id={bodyId}
          role="region"
          aria-labelledby={`${props.id}-heading`}
          hidden={props.collapsed}
          className={props.collapsed ? "hidden" : "border-t border-white/[0.06] px-4 py-4 sm:px-5 sm:py-5"}
        >
          {props.collapsed ? null : props.children}
        </div>
      </div>
    </section>
  );
}
