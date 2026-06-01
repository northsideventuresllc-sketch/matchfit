"use client";

import {
  ADMIN_DASHBOARD_SECTIONS,
  type AdminDashboardLayout,
  adminDashboardSectionDomId,
  visibleDashboardSections,
} from "@/lib/admin-dashboard-layout";

export function AdminDashboardSectionNav(props: { layout: AdminDashboardLayout }) {
  const visible = visibleDashboardSections(props.layout);
  if (visible.length === 0) return null;

  const labelById = Object.fromEntries(ADMIN_DASHBOARD_SECTIONS.map((s) => [s.id, s.label])) as Record<
    string,
    string
  >;

  return (
    <nav
      aria-label="Dashboard sections"
      className="sticky top-0 z-10 -mx-5 sm:-mx-8 border-b border-white/[0.06] bg-[#050608]/90 px-5 py-3 backdrop-blur-xl sm:px-8"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-1.5">
        <span className="mr-2 hidden text-[9px] font-black uppercase tracking-[0.2em] text-white/25 sm:block">
          Jump to
        </span>
        {visible.map((id) => (
          <a
            key={id}
            href={`#${adminDashboardSectionDomId(id)}`}
            className="rounded-lg px-2.5 py-1 text-[10px] font-medium text-white/50 transition hover:bg-white/[0.07] hover:text-white/90"
          >
            {labelById[id] ?? id}
          </a>
        ))}
      </div>
    </nav>
  );
}
