"use client";

import { useState } from "react";
import { adminLabelClass, adminPanelClass } from "@/components/admin/admin-portal-ui";
import type { OutreachHubLead, OutreachLane } from "@/lib/outreach-types";
import { LeadCard, type LeadStage } from "./lead-card";
import {
  FOLLOW_UP_STAGE_FILTERS,
  LEAD_PLATFORM_FILTERS,
  filterLeadsByPlatform,
  laneOf,
  selectFollowUpLeads,
  type FollowUpStageFilter,
  type LeadPlatformFilter,
} from "./helpers";

function FilterBar(props: {
  platform: LeadPlatformFilter;
  onPlatform: (p: LeadPlatformFilter) => void;
  stage?: FollowUpStageFilter;
  onStage?: (s: FollowUpStageFilter) => void;
}) {
  const chip = (active: boolean) =>
    active
      ? "rounded-lg border border-[#FF7E00]/40 bg-[#FF7E00]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#FFD34E]"
      : "rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/[0.07]";
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={adminLabelClass}>Platform</span>
        {LEAD_PLATFORM_FILTERS.map((f) => (
          <button key={f.id} type="button" className={chip(props.platform === f.id)} onClick={() => props.onPlatform(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      {props.stage && props.onStage ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className={adminLabelClass}>Stage</span>
          {FOLLOW_UP_STAGE_FILTERS.map((f) => (
            <button key={f.id} type="button" className={chip(props.stage === f.id)} onClick={() => props.onStage!(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function stageForLane(lane: OutreachLane): LeadStage {
  if (lane === "follow_up_1") return "follow_up_1";
  if (lane === "follow_up_2") return "follow_up_2";
  return "primary";
}

export function LeadsPanel(props: {
  variant: "today" | "past_due" | "follow_ups";
  grouped: Record<OutreachLane, OutreachHubLead[]>;
  focusLeadId: string | null;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [platform, setPlatform] = useState<LeadPlatformFilter>("both");
  const [stage, setStage] = useState<FollowUpStageFilter>("all");

  const base =
    props.variant === "follow_ups"
      ? selectFollowUpLeads(props.grouped, stage)
      : props.grouped[props.variant];
  const leads = filterLeadsByPlatform(base, platform);

  const intro =
    props.variant === "today"
      ? "Fresh leads generated Monday–Friday and pushed to Telegram for on-the-go approve / delete / rewrite. Approve batches each lead into the next 1pm or 4pm Dispatch run."
      : props.variant === "past_due"
        ? "Today's leads that rolled past their queued day without being actioned. Same approve / delete / rewrite flow — clear these first."
        : "Follow-ups that came due after a send. Reminders fire 24h after due and re-nudge every 24h until approved. Approve batches the follow-up into the next Dispatch run.";

  return (
    <div className="space-y-4">
      <div className={`${adminPanelClass} space-y-3 p-5`}>
        <p className="text-sm leading-relaxed text-white/60">{intro}</p>
        <FilterBar
          platform={platform}
          onPlatform={setPlatform}
          stage={props.variant === "follow_ups" ? stage : undefined}
          onStage={props.variant === "follow_ups" ? setStage : undefined}
        />
      </div>

      {leads.length === 0 ? (
        <p className="text-sm text-white/55">No leads in this view.</p>
      ) : (
        <div className="space-y-3">
          {leads.map((entry) => (
            <LeadCard
              key={`${entry.platform}-${entry.lead.id}`}
              entry={entry}
              stage={props.variant === "follow_ups" ? stageForLane(laneOf(entry)) : "primary"}
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
