"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  type AdminDashboardLayout,
  type AdminDashboardSectionId,
  adminDashboardSectionDomId,
  visibleSectionsByGroup,
} from "@/lib/admin-dashboard-layout";
import { adminPortalSectionEyebrowClass } from "@/components/admin/admin-portal-styles";

export function AdminDashboardSectionNav(props: {
  layout: AdminDashboardLayout;
  activeSectionId?: AdminDashboardSectionId | null;
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
  variant?: "sidebar" | "mobile";
}) {
  const grouped = visibleSectionsByGroup(props.layout);
  const [scrollActiveId, setScrollActiveId] = useState<AdminDashboardSectionId | null>(null);
  const activeId = props.activeSectionId !== undefined ? props.activeSectionId : scrollActiveId;
  const variant = props.variant ?? "sidebar";

  useEffect(() => {
    if (props.activeSectionId !== undefined) return;

    const visibleIds = grouped.flatMap((g) => g.sections.map((s) => s.id));
    if (visibleIds.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top ?? 0) - (b.boundingClientRect.top ?? 0));
        const top = visible[0];
        if (!top?.target.id) return;
        const id = top.target.id.replace(/^admin-section-/, "");
        if (visibleIds.includes(id as AdminDashboardSectionId)) {
          setScrollActiveId(id as AdminDashboardSectionId);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: 0.05 },
    );

    for (const id of visibleIds) {
      const el = document.getElementById(adminDashboardSectionDomId(id));
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [grouped, props.activeSectionId]);

  if (grouped.length === 0) return null;

  const navInner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className={adminPortalSectionEyebrowClass}>On this page</p>
        {props.onCollapseAll && props.onExpandAll ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={props.onExpandAll}
              className="rounded-md border border-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/50 hover:bg-white/[0.05] hover:text-white/75"
            >
              Expand
            </button>
            <button
              type="button"
              onClick={props.onCollapseAll}
              className="rounded-md border border-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/50 hover:bg-white/[0.05] hover:text-white/75"
            >
              Collapse
            </button>
          </div>
        ) : null}
      </div>

      <div className={variant === "sidebar" ? "mt-3 space-y-4" : "mt-2 flex gap-2 overflow-x-auto pb-1"}>
        {grouped.map(({ group, sections }) => (
          <div key={group} className={variant === "sidebar" ? "space-y-1" : "shrink-0"}>
            {variant === "sidebar" ? (
              <p className="px-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/30">{group}</p>
            ) : (
              <p className="mb-1 px-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/30">{group}</p>
            )}
            <ul className={variant === "sidebar" ? "space-y-0.5" : "flex flex-wrap gap-1"}>
              {sections.map((section) => {
                const isActive = activeId === section.id;
                return (
                  <li key={section.id}>
                    <a
                      href={`#${adminDashboardSectionDomId(section.id)}`}
                      className={`block rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
                        isActive
                          ? "bg-[#FF7E00]/15 text-[#FFD34E]"
                          : "text-white/55 hover:bg-white/[0.05] hover:text-white/85"
                      }`}
                      onClick={() => setScrollActiveId(section.id)}
                    >
                      {section.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {variant === "sidebar" ? (
        <Link
          href="/admin/settings"
          className="mt-4 block rounded-lg border border-white/[0.08] px-2 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white/45 transition hover:border-[#FF7E00]/30 hover:text-[#FFD34E]"
        >
          Dashboard Settings →
        </Link>
      ) : null}
    </>
  );

  if (variant === "mobile") {
    return (
      <nav aria-label="Dashboard sections" className="mb-6 rounded-2xl border border-white/[0.08] bg-[#12151C]/60 p-3 lg:hidden">
        {navInner}
      </nav>
    );
  }

  return <nav aria-label="Dashboard sections">{navInner}</nav>;
}
