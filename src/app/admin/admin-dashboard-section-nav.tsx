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
      className="sticky top-0 z-10 -mx-1 rounded-2xl border border-white/[0.08] bg-[#0B0C0F]/95 px-2 py-3 backdrop-blur-md"
    >
      <p className="px-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Jump to section</p>
      <div className="mt-2 flex flex-wrap gap-1.5 px-1">
        {visible.map((id) => (
          <a
            key={id}
            href={`#${adminDashboardSectionDomId(id)}`}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white/65 transition hover:border-[#FF7E00]/25 hover:bg-[#FF7E00]/10 hover:text-[#FFD34E]"
          >
            {labelById[id] ?? id}
          </a>
        ))}
      </div>
    </nav>
  );
}
