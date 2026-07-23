"use client";

import { useState } from "react";
import { adminLabelClass, adminPanelClass } from "@/components/admin/admin-portal-ui";
import type {
  EmailLeadRow,
  FacebookLeadRow,
  InstagramLeadRow,
  OutreachArchiveLead,
} from "@/lib/outreach-types";
import { CollapsibleCard } from "./ui-bits";
import { archiveOrigin, leadContactUrl, leadDisplayName } from "./helpers";

type ArchiveFilter = "all" | "manual" | "dead_lead";

const ARCHIVE_FILTERS: { id: ArchiveFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "manual", label: "Manually deleted" },
  { id: "dead_lead", label: "Dead leads" },
];

function ArchiveCard({ entry }: { entry: OutreachArchiveLead }) {
  const origin = archiveOrigin(entry);
  const lead = entry.lead as InstagramLeadRow | FacebookLeadRow | EmailLeadRow;
  const name = leadDisplayName(entry);
  const contact = leadContactUrl(entry);

  const header = (
    <>
      <p className="truncate text-base font-black text-white">
        {name}
        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-white/40">{entry.platform}</span>
      </p>
      <p className="mt-0.5 truncate text-xs text-white/50">
        Archived {entry.archivedAt ? new Date(entry.archivedAt).toLocaleDateString() : "—"}
      </p>
    </>
  );

  return (
    <CollapsibleCard
      header={header}
      badges={
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            origin === "manual"
              ? "border-white/15 bg-white/[0.04] text-white/55"
              : "border-[#E32B2B]/40 bg-[#E32B2B]/12 text-[#FFB4B4]"
          }`}
        >
          {origin === "manual" ? "Deleted" : "Dead lead"}
        </span>
      }
    >
      <div className="space-y-2 text-sm">
        {contact ? (
          <a href={contact} target="_blank" rel="noreferrer" className="inline-block font-semibold text-[#FFD34E] hover:underline">
            Open ↗
          </a>
        ) : null}
        {lead.whyMatchFit ? <p className="text-white/70">{lead.whyMatchFit}</p> : null}
        {lead.notes ? <p className="text-xs text-white/45">Notes: {lead.notes}</p> : null}
        <p className="text-[11px] text-white/40">
          {entry.deadLeadAt ? `Dead-lead marked ${new Date(entry.deadLeadAt).toLocaleString()}` : ""}
        </p>
      </div>
    </CollapsibleCard>
  );
}

export function ArchivesPanel({ entries }: { entries: OutreachArchiveLead[] }) {
  const [filter, setFilter] = useState<ArchiveFilter>("all");
  const shown = filter === "all" ? entries : entries.filter((e) => archiveOrigin(e) === filter);

  const chip = (active: boolean) =>
    active
      ? "rounded-lg border border-[#FF7E00]/40 bg-[#FF7E00]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#FFD34E]"
      : "rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/[0.07]";

  return (
    <div className="space-y-4">
      <div className={`${adminPanelClass} space-y-3 p-5`}>
        <p className="text-sm leading-relaxed text-white/60">
          Leads that were manually deleted or became dead leads. Rows stay here for 7 days before dropping out of view (the
          record is preserved server-side for learning history).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className={adminLabelClass}>Origin</span>
          {ARCHIVE_FILTERS.map((f) => (
            <button key={f.id} type="button" className={chip(filter === f.id)} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-white/55">No archived leads in this view.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((entry) => (
            <ArchiveCard key={`${entry.platform}-${entry.lead.id}`} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
