"use client";

import { useState } from "react";
import { adminLabelClass, adminPanelClass } from "@/components/admin/admin-portal-ui";
import type { OutreachHubLead, OutreachLane } from "@/lib/outreach-types";
import { LeadCard } from "./lead-card";
import { LEAD_PLATFORM_FILTERS, filterLeadsByPlatform, selectTodayLeads, type LeadPlatformFilter } from "./helpers";

type TodaySubFilter = "all" | "new" | "follow_ups";
const TODAY_SUB_FILTERS: { id: TodaySubFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New Leads" },
  { id: "follow_ups", label: "Follow Ups" },
];

function FilterBar(props: { 
  platform: LeadPlatformFilter; onPlatform: (p: LeadPlatformFilter) => void;
  subFilter?: TodaySubFilter; onSubFilter?: (s: TodaySubFilter) => void;
}) {
  const chip = (active: boolean) =>
    active
      ? "rounded-lg border border-[#FF7E00]/40 bg-[#FF7E00]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#FFD34E]"
      : "rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/[0.07]";
  return (
    <div className="flex flex-col gap-3">
      {props.subFilter && props.onSubFilter ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className={adminLabelClass}>Category</span>
          {TODAY_SUB_FILTERS.map((f) => (
            <button key={f.id} type="button" className={chip(props.subFilter === f.id)} onClick={() => props.onSubFilter!(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <span className={adminLabelClass}>Platform</span>
        {LEAD_PLATFORM_FILTERS.map((f) => (
          <button key={f.id} type="button" className={chip(props.platform === f.id)} onClick={() => props.onPlatform(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LeadsPanel(props: {
  variant: "today" | "past_due";
  grouped: Record<OutreachLane, OutreachHubLead[]>;
  focusLeadId: string | null;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [platform, setPlatform] = useState<LeadPlatformFilter>("both");
  const [subFilter, setSubFilter] = useState<TodaySubFilter>("all");
  
  const baseLeads = props.variant === "today" ? selectTodayLeads(props.grouped) : props.grouped.past_due;
  let filtered = filterLeadsByPlatform(baseLeads, platform);
  
  if (props.variant === "today") {
    if (subFilter === "new") {
      filtered = filtered.filter(l => l.lead.outreachLane === "today");
    } else if (subFilter === "follow_ups") {
      filtered = filtered.filter(l => l.lead.outreachLane === "follow_up_1" || l.lead.outreachLane === "follow_up_2");
    }
  }

  const intro =
    props.variant === "today"
      ? "Fresh leads generated Monday–Friday and topped up to 5 Instagram + 5 email. Manual Send or Agent Send moves a lead to the Send Queue; every edit saves itself."
      : "Today's leads that rolled past their queued day without being actioned. Same regenerate / copy / send flow — clear these first.";

  return (
    <div className="space-y-4">
      <div className={`${adminPanelClass} space-y-3 p-5`}>
        <p className="text-sm leading-relaxed text-white/60">{intro}</p>
        <FilterBar 
          platform={platform} 
          onPlatform={setPlatform} 
          subFilter={props.variant === "today" ? subFilter : undefined}
          onSubFilter={props.variant === "today" ? setSubFilter : undefined}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-white/55">No leads in this view.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <LeadCard
              key={`${entry.platform}-${entry.lead.id}`}
              entry={entry}
              stage={
                entry.lead.outreachLane === "follow_up_1"
                  ? "follow_up_1"
                  : entry.lead.outreachLane === "follow_up_2"
                    ? "follow_up_2"
                    : "primary"
              }
              focus={props.focusLeadId === entry.lead.id}
              showApprove
              onChanged={props.onChanged}
              onError={props.onError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
