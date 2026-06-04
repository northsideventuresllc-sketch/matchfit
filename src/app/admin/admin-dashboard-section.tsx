"use client";

import type { ReactNode } from "react";
import {
  type AdminDashboardSectionGroup,
  type AdminDashboardSectionId,
  adminDashboardSectionDomId,
} from "@/lib/admin-dashboard-layout";

export function AdminDashboardSection(props: {
  id: AdminDashboardSectionId;
  group?: AdminDashboardSectionGroup;
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={adminDashboardSectionDomId(props.id)}
      className="scroll-mt-28"
      aria-labelledby={props.title ? `${props.id}-heading` : undefined}
    >
      {props.group ? (
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#FF7E00]/50">{props.group}</p>
      ) : null}
      {props.title ? (
        <div className="mb-4">
          <h2 id={`${props.id}-heading`} className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">
            {props.title}
          </h2>
          {props.description ? <p className="mt-1 text-sm text-white/50">{props.description}</p> : null}
        </div>
      ) : null}
      {props.children}
    </section>
  );
}
