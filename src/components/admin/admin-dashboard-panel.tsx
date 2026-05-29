"use client";

import type { ReactNode } from "react";

export function AdminDashboardPanel(props: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details
      open={props.defaultOpen}
      className="group rounded-2xl border border-white/[0.08] bg-[#0c0f14]/90 backdrop-blur-md"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 sm:px-5 sm:py-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300/85">{props.title}</h2>
          {props.subtitle ? <p className="mt-1 text-sm text-white/50">{props.subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {props.badge}
          <span
            aria-hidden
            className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/45 transition group-open:rotate-180"
          >
            ▼
          </span>
        </div>
      </summary>
      <div className="border-t border-white/[0.06] px-4 pb-5 pt-4 sm:px-5">{props.children}</div>
    </details>
  );
}

export function AdminMetricTile(props: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#07080c]/80 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">{props.label}</p>
      <p className="mt-2 text-2xl font-black tabular-nums text-white">{props.value}</p>
      {props.hint ? <p className="mt-1 text-[11px] text-white/40">{props.hint}</p> : null}
    </div>
  );
}

export function AdminSeverityBadge(props: { severity: "critical" | "warning" | "info" }) {
  const styles =
    props.severity === "critical"
      ? "border-[#E32B2B]/40 bg-[#E32B2B]/15 text-[#FFB4B4]"
      : props.severity === "warning"
        ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
        : "border-cyan-400/25 bg-cyan-500/10 text-cyan-100";
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${styles}`}>
      {props.severity}
    </span>
  );
}
