"use client";

import {
  ADMIN_DASHBOARD_SECTIONS,
  type AdminDashboardLayout,
  adminDashboardSectionDomId,
  visibleDashboardSections,
} from "@/lib/admin-dashboard-layout";
import { adminAccentButtonClass, adminSecondaryButtonClass } from "@/components/admin/admin-portal-ui";

function sectionNavLabel(label: string): string {
  return label.toUpperCase();
}

export function AdminDashboardSectionNav(props: {
  layout: AdminDashboardLayout;
  variant?: "mobile" | "sidebar";
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
}) {
  const visible = visibleDashboardSections(props.layout);
  if (visible.length === 0) return null;

  const labelById = Object.fromEntries(ADMIN_DASHBOARD_SECTIONS.map((s) => [s.id, s.label])) as Record<
    string,
    string
  >;

  const isSidebar = props.variant === "sidebar";

  return (
    <nav
      aria-label="Dashboard sections"
      className={
        isSidebar
          ? "space-y-3"
          : "sticky top-0 z-10 -mx-1 rounded-2xl border border-white/[0.08] bg-[#0B0C0F]/95 px-2 py-3 backdrop-blur-md"
      }
    >
      <p
        className={
          isSidebar
            ? "text-[10px] font-black uppercase tracking-[0.18em] text-white/35"
            : "px-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/35"
        }
      >
        On this page
      </p>
      <div className={isSidebar ? "flex flex-col gap-1" : "mt-2 flex flex-wrap gap-1.5 px-1"}>
        {visible.map((id) => (
          <a
            key={id}
            href={`#${adminDashboardSectionDomId(id)}`}
            className={
              isSidebar
                ? "rounded-lg border border-transparent px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/55 transition hover:border-[#FF7E00]/20 hover:bg-[#FF7E00]/10 hover:text-[#FFD34E]"
                : "rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/75 transition hover:border-[#FF7E00]/25 hover:bg-[#FF7E00]/10 hover:text-[#FFD34E]"
            }
          >
            {sectionNavLabel(labelById[id] ?? id)}
          </a>
        ))}
      </div>
      {props.onCollapseAll && props.onExpandAll ? (
        <div className={`flex flex-wrap gap-1.5 ${isSidebar ? "pt-1" : "px-1 pt-2"}`}>
          <button type="button" onClick={props.onCollapseAll} className={adminSecondaryButtonClass}>
            Collapse All
          </button>
          <button type="button" onClick={props.onExpandAll} className={adminAccentButtonClass}>
            Expand All
          </button>
        </div>
      ) : null}
    </nav>
  );
}
