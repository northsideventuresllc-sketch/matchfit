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
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/50">{props.group}</p>
      ) : null}
      {props.title ? (
        <div className="mb-4 border-l-2 border-cyan-500/40 pl-4">
          <h2 id={`${props.id}-heading`} className="text-sm font-bold text-white/70">
            {props.title}
          </h2>
          {props.description ? <p className="mt-0.5 text-xs leading-relaxed text-white/40">{props.description}</p> : null}
        </div>
      ) : null}
      {props.children}
    </section>
  );
}
