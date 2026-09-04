"use client";

import { useState } from "react";
import { adminLabelClass, adminPanelClass } from "@/components/admin/admin-portal-ui";
import type { OutreachHubLead, OutreachLane } from "@/lib/outreach-types";
import { LeadCard } from "./lead-card";
import { LEAD_PLATFORM_FILTERS, filterLeadsByPlatform, type LeadPlatformFilter } from "./helpers";

function FilterBar(props: { platform: LeadPlatformFilter; onPlatform: (p: LeadPlatformFilter) => void }) {
  const chip = (active: boolean) =>
    active
      ? "rounded-lg border border-[#FF7E00]/40 bg-[#FF7E00]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#FFD34E]"
      : "rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/[0.07]";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={adminLabelClass}>Platform</span>
      {LEAD_PLATFORM_FILTERS.map((f) => (
        <button key={f.id} type="button" className={chip(props.platform === f.id)} onClick={() => props.onPlatform(f.id)}>
          {f.label}
        </button>
      ))}
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
  const leads = filterLeadsByPlatform(props.grouped[props.variant], platform);

  const intro =
    props.variant === "today"
      ? "Fresh leads generated Monday–Friday and topped up to 5 Instagram + 5 email. Manual Send or Agent Send moves a lead to the Send Queue; every edit saves itself."
      : "Today's leads that rolled past their queued day without being actioned. Same regenerate / copy / send flow — clear these first.";

  return (
    <div className="space-y-4">
      <div className={`${adminPanelClass} space-y-3 p-5`}>
        <p className="text-sm leading-relaxed text-white/60">{intro}</p>
        <FilterBar platform={platform} onPlatform={setPlatform} />
      </div>

      {leads.length === 0 ? (
        <p className="text-sm text-white/55">No leads in this view.</p>
      ) : (
        <div className="space-y-3">
          {leads.map((entry) => (
            <LeadCard
              key={`${entry.platform}-${entry.lead.id}`}
              entry={entry}
              stage="primary"
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
