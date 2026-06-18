"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminAlertGroup, AdminAlertItem, AdminAlertSeverity, AdminAlertsPanel } from "@/lib/admin-portal-types";
import { adminPortalSecondaryButtonClass } from "@/components/admin/admin-portal-styles";

type AlertCategoryId = AdminAlertGroup["id"];

type CategoryTheme = {
  icon: string;
  bubbleClass: string;
  panelClass: string;
  badgeClass: string;
  filingClass: string;
};

const CATEGORY_THEMES: Record<AlertCategoryId, CategoryTheme> = {
  failed_bg: {
    icon: "🛡️",
    bubbleClass: "border-[#E32B2B]/30 bg-gradient-to-br from-[#E32B2B]/[0.14] to-[#0E1016]/95",
    panelClass: "border-[#E32B2B]/20 bg-[#E32B2B]/[0.06]",
    badgeClass: "bg-[#E32B2B]/20 text-[#FFB4B4]",
    filingClass: "text-[#FFB4B4]/80",
  },
  bug_reports: {
    icon: "🐞",
    bubbleClass: "border-amber-400/25 bg-gradient-to-br from-amber-500/[0.12] to-[#0E1016]/95",
    panelClass: "border-amber-400/20 bg-amber-500/[0.06]",
    badgeClass: "bg-amber-500/20 text-amber-100",
    filingClass: "text-amber-200/70",
  },
  product_ideas: {
    icon: "💡",
    bubbleClass: "border-violet-400/25 bg-gradient-to-br from-violet-500/[0.12] to-[#0E1016]/95",
    panelClass: "border-violet-400/20 bg-violet-500/[0.06]",
    badgeClass: "bg-violet-500/20 text-violet-100",
    filingClass: "text-violet-200/70",
  },
  failed_payments: {
    icon: "💳",
    bubbleClass: "border-rose-400/25 bg-gradient-to-br from-rose-500/[0.12] to-[#0E1016]/95",
    panelClass: "border-rose-400/20 bg-rose-500/[0.06]",
    badgeClass: "bg-rose-500/20 text-rose-100",
    filingClass: "text-rose-200/70",
  },
  flagged_users: {
    icon: "🚩",
    bubbleClass: "border-[#FF7E00]/30 bg-gradient-to-br from-[#FF7E00]/[0.14] to-[#0E1016]/95",
    panelClass: "border-[#FF7E00]/20 bg-[#FF7E00]/[0.06]",
    badgeClass: "bg-[#FF7E00]/20 text-[#FFD34E]",
    filingClass: "text-[#FFD34E]/80",
  },
  chat_warnings: {
    icon: "💬",
    bubbleClass: "border-sky-400/25 bg-gradient-to-br from-sky-500/[0.12] to-[#0E1016]/95",
    panelClass: "border-sky-400/20 bg-sky-500/[0.06]",
    badgeClass: "bg-sky-500/20 text-sky-100",
    filingClass: "text-sky-200/70",
  },
  security: {
    icon: "🔒",
    bubbleClass: "border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.12] to-[#0E1016]/95",
    panelClass: "border-emerald-400/20 bg-emerald-500/[0.06]",
    badgeClass: "bg-emerald-500/20 text-emerald-100",
    filingClass: "text-emerald-200/70",
  },
};

function severityBadgeClass(severity: AdminAlertSeverity): string {
  if (severity === "critical") return "bg-[#E32B2B]/20 text-[#FFB4B4]";
  if (severity === "warning") return "bg-amber-500/20 text-amber-100";
  return "bg-white/10 text-white/60";
}

function severityLabel(severity: AdminAlertSeverity): string {
  if (severity === "critical") return "Critical";
  if (severity === "warning") return "Warning";
  return "Info";
}

function groupItemsByFiling(items: AdminAlertItem[]): { filingKey: string; items: AdminAlertItem[] }[] {
  const buckets = new Map<string, AdminAlertItem[]>();
  for (const item of items) {
    const filingKey = item.filingLabel.split("·")[0]?.trim() || "General";
    const bucket = buckets.get(filingKey) ?? [];
    bucket.push(item);
    buckets.set(filingKey, bucket);
  }
  return Array.from(buckets.entries()).map(([filingKey, bucketItems]) => ({
    filingKey,
    items: bucketItems,
  }));
}

function AlertDetailModal(props: {
  group: AdminAlertGroup;
  item: AdminAlertItem;
  onClose: () => void;
}) {
  const theme = CATEGORY_THEMES[props.group.id as AlertCategoryId] ?? CATEGORY_THEMES.security;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`alert-detail-${props.item.id}`}
      onClick={props.onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") props.onClose();
      }}
    >
      <div
        className="flex max-h-[min(calc(100dvh-1rem),44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#12151C] shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className={`shrink-0 border-b border-white/[0.08] px-5 py-4 ${theme.panelClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${theme.filingClass}`}>
                {props.item.filingLabel}
              </p>
              <h3 id={`alert-detail-${props.item.id}`} className="mt-1 text-lg font-black text-white">
                {props.item.title}
              </h3>
              <p className="mt-1 text-sm text-white/55">{props.group.label}</p>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-white/70 transition hover:border-white/20 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${severityBadgeClass(props.item.severity)}`}>
              {severityLabel(props.item.severity)}
            </span>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${theme.badgeClass}`}>
              {theme.icon} {props.group.label}
            </span>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#0E1016]/80 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Full report</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/80">{props.item.fullDetail}</p>
          </div>

          {props.item.fields.length > 0 ? (
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Filing details</p>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {props.item.fields.map((field) => (
                  <div key={`${props.item.id}-${field.label}`} className="rounded-lg border border-white/[0.06] bg-[#0E1016]/70 px-3 py-2.5">
                    <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-white/35">{field.label}</dt>
                    <dd className="mt-1 break-words text-sm font-medium text-white/80">{field.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-white/[0.08] px-5 py-4">
          <div className="flex flex-wrap justify-end gap-2">
            {props.item.href ? (
              <Link
                href={props.item.href}
                className={`${adminPortalSecondaryButtonClass} px-3 py-2 text-[10px] tracking-[0.08em]`}
              >
                Open Related Area
              </Link>
            ) : null}
            <button
              type="button"
              onClick={props.onClose}
              className={`${adminPortalSecondaryButtonClass} px-3 py-2 text-[10px] tracking-[0.08em]`}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertCategoryBubble(props: {
  group: AdminAlertGroup;
  expanded: boolean;
  onToggle: () => void;
  onOpenItem: (item: AdminAlertItem) => void;
}) {
  const theme = CATEGORY_THEMES[props.group.id as AlertCategoryId] ?? CATEGORY_THEMES.security;
  const filingBuckets = useMemo(() => groupItemsByFiling(props.group.items), [props.group.items]);
  const hiddenCount = Math.max(0, props.group.total - props.group.items.length);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12151C]/90 shadow-[0_24px_70px_-50px_rgba(255,126,0,0.45)]">
      <button
        type="button"
        onClick={props.onToggle}
        aria-expanded={props.expanded}
        className={`flex w-full items-start gap-3 p-4 text-left transition hover:bg-white/[0.02] ${theme.bubbleClass}`}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-xl">
          {theme.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-white">{props.group.label}</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${severityBadgeClass(props.group.severity)}`}>
              {severityLabel(props.group.severity)}
            </span>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${theme.badgeClass}`}>
              {props.group.total} open
            </span>
          </span>
          <span className="mt-1 block text-xs text-white/55">{props.group.description}</span>
        </span>
        <span
          className={`mt-1 shrink-0 text-white/45 transition-transform ${props.expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {props.expanded ? (
        <div className={`border-t border-white/[0.08] px-4 py-4 ${theme.panelClass}`}>
          {props.group.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-center text-sm text-white/45">
              No open items in this queue right now.
            </p>
          ) : (
            <div className="space-y-4">
              {filingBuckets.map((bucket) => (
                <div key={`${props.group.id}-${bucket.filingKey}`}>
                  <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${theme.filingClass}`}>
                    {bucket.filingKey}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {bucket.items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => props.onOpenItem(item)}
                          className="group flex w-full items-start gap-3 rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-3 py-3 text-left transition hover:border-white/20 hover:bg-[#0E1016]"
                        >
                          <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${severityBadgeClass(item.severity).split(" ")[0]}`} />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-white group-hover:text-[#FFD34E]">{item.title}</span>
                              <span className="text-[10px] uppercase tracking-wide text-white/35">{item.filingLabel}</span>
                            </span>
                            {item.detail ? (
                              <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-white/50">{item.detail}</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-white/30 group-hover:text-white/60">
                            View
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {hiddenCount > 0 ? (
                <p className="text-xs text-white/40">
                  Showing {props.group.items.length} of {props.group.total} reports in this queue.
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

function MetricsSection(props: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4 shadow-[0_34px_90px_-48px_rgba(227,43,43,0.35)] backdrop-blur-xl sm:p-5">
      <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">{props.title}</h2>
      {props.description ? <p className="mt-1 text-sm text-white/50">{props.description}</p> : null}
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

export function OperationalAlertsSection({ alerts }: { alerts: AdminAlertsPanel }) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ group: AdminAlertGroup; item: AdminAlertItem } | null>(null);

  const totalOpen = useMemo(
    () => alerts.groups.reduce((sum, group) => sum + group.total, 0),
    [alerts.groups],
  );

  const criticalCount = useMemo(
    () => alerts.groups.filter((group) => group.severity === "critical").reduce((sum, group) => sum + group.total, 0),
    [alerts.groups],
  );

  return (
    <MetricsSection
      title="Operational alerts"
      description="Trust, safety, billing, and product feedback queues. Expand a category to browse every report, then open any item for the full filing."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-[#0E1016]/80 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Open reports</p>
          <p className="mt-1 text-2xl font-black text-white">{totalOpen}</p>
        </div>
        <div className="rounded-xl border border-[#E32B2B]/20 bg-[#E32B2B]/[0.08] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FFB4B4]/70">Critical queues</p>
          <p className="mt-1 text-2xl font-black text-[#FFB4B4]">{criticalCount}</p>
        </div>
        <div className="rounded-xl border border-[#FF7E00]/20 bg-[#FF7E00]/[0.08] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FFD34E]/70">Categories</p>
          <p className="mt-1 text-2xl font-black text-[#FFD34E]">{alerts.groups.length}</p>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.groups.map((group) => (
          <AlertCategoryBubble
            key={group.id}
            group={group}
            expanded={expandedGroupId === group.id}
            onToggle={() => setExpandedGroupId((current) => (current === group.id ? null : group.id))}
            onOpenItem={(item) => setSelected({ group, item })}
          />
        ))}
      </div>

      {selected ? (
        <AlertDetailModal group={selected.group} item={selected.item} onClose={() => setSelected(null)} />
      ) : null}
    </MetricsSection>
  );
}
