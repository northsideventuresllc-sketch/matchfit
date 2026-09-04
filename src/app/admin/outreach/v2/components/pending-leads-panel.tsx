"use client";

import { useState } from "react";
import {
  adminAccentButtonClass,
  adminLabelClass,
  adminPanelClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import { outreachIntentLabel } from "@/lib/outreach-cowork";
import type {
  EmailLeadRow,
  FacebookLeadRow,
  InstagramLeadRow,
  OutreachHubLead,
  OutreachLane,
} from "@/lib/outreach-types";
import { CollapsibleCard, ConfirmModal } from "./ui-bits";
import { deleteLead, markResponded, sendToFollowUps } from "./client-api";
import {
  followUpCount,
  followUpDueAt,
  formatOverdue,
  laneOf,
  leadContactUrl,
  leadDisplayName,
  selectPendingLeads,
} from "./helpers";

/** The message that was sent to this lead — the primary outbound copy, read-only. */
function sentMessageBlocks(entry: OutreachHubLead): { label: string; text: string }[] {
  const lead = entry.lead as InstagramLeadRow | FacebookLeadRow | EmailLeadRow;
  if (entry.platform === "instagram") {
    const ig = lead as InstagramLeadRow;
    return ig.dmText ? [{ label: "DM sent", text: ig.dmText }] : [];
  }
  if (entry.platform === "facebook") {
    const fb = lead as FacebookLeadRow;
    return fb.pagePostText ? [{ label: "Page post", text: fb.pagePostText }] : [];
  }
  const em = lead as EmailLeadRow;
  const out: { label: string; text: string }[] = [];
  if (em.emailSubject) out.push({ label: "Subject sent", text: em.emailSubject });
  if (em.emailBody) out.push({ label: "Body sent", text: em.emailBody });
  return out;
}

/** Follow-up count pill: 0 done = gray, 1 = amber, 2+ = orange. */
function followUpBadgeClass(count: number): string {
  if (count >= 2) return "border-[#FF7E00]/45 bg-[#FF7E00]/15 text-[#FFD34E]";
  if (count === 1) return "border-amber-400/40 bg-amber-500/15 text-amber-100";
  return "border-white/15 bg-white/[0.04] text-white/55";
}

function PendingLeadCard(props: {
  entry: OutreachHubLead;
  focus?: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const { entry } = props;
  const lead = entry.lead;
  const lane = laneOf(entry);
  const [busy, setBusy] = useState<null | "follow" | "responded">(null);
  const [showArchive, setShowArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const name = leadDisplayName(entry);
  const contact = leadContactUrl(entry);
  const contactLabel =
    entry.platform === "instagram"
      ? `@${(lead as InstagramLeadRow).handle}`
      : entry.platform === "email"
        ? (lead as EmailLeadRow).email
        : (lead as FacebookLeadRow).pageName;
  const count = followUpCount(lane);
  const dueInfo = formatOverdue(followUpDueAt(entry));
  const blocks = sentMessageBlocks(entry);

  async function sendFollowUp() {
    setBusy("follow");
    const result = await sendToFollowUps(lead.id, entry.platform);
    setBusy(null);
    if (!result.ok) return props.onError(result.error);
    props.onError("");
    props.onChanged();
  }

  async function responded() {
    setBusy("responded");
    const result = await markResponded(lead.id, entry.platform);
    setBusy(null);
    if (!result.ok) return props.onError(result.error);
    props.onError("");
    props.onChanged();
  }

  async function confirmArchive() {
    setArchiving(true);
    const result = await deleteLead(lead.id, entry.platform, "Archived from Pending Leads");
    setArchiving(false);
    if (!result.ok) return props.onError(result.error);
    setShowArchive(false);
    props.onError("");
    props.onChanged();
  }

  const header = (
    <>
      <p className="truncate text-base font-black text-white">
        {name}
        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-white/40">{entry.platform}</span>
      </p>
      <p className="mt-0.5 truncate text-xs text-white/50">
        {lead.niche ? `${lead.niche} · ` : ""}score {lead.likelihoodScore}% · {outreachIntentLabel(lead.outreachIntent)}
      </p>
    </>
  );

  const badges = (
    <>
      <span
        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${followUpBadgeClass(count)}`}
        title="Follow-ups already sent"
      >
        {count} follow-up{count === 1 ? "" : "s"}
      </span>
      {dueInfo.state === "overdue" ? (
        <span className="rounded-full border border-[#E32B2B]/40 bg-[#E32B2B]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4]">
          {dueInfo.label}
        </span>
      ) : dueInfo.state === "scheduled" ? (
        <span className="hidden rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/55 sm:inline">
          {dueInfo.label}
        </span>
      ) : null}
    </>
  );

  return (
    <>
      <CollapsibleCard header={header} badges={badges} focus={props.focus}>
        <div className="space-y-3">
          {contact ? (
            <a href={contact} target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-[#FFD34E] hover:underline">
              {contactLabel} ↗
            </a>
          ) : (
            <p className="text-sm text-white/60">{contactLabel}</p>
          )}

          {blocks.length > 0 ? (
            <div className="space-y-1.5">
              {blocks.map((b) => (
                <div key={b.label} className="space-y-1 rounded-lg border border-white/[0.06] bg-[#0E1016]/60 p-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-white/45">{b.label}</span>
                  <p className="whitespace-pre-wrap text-sm text-white/85">{b.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/45">No stored message copy for this lead.</p>
          )}

          <p className="text-[11px] text-white/40">
            {dueInfo.state === "none"
              ? "No follow-up scheduled."
              : `Follow-up ${dueInfo.label.toLowerCase()}. "Send To Follow Ups" overrides the clock and queues it now.`}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" className={adminAccentButtonClass} disabled={busy !== null} onClick={() => void sendFollowUp()}>
              {busy === "follow" ? "Queuing…" : "Send To Follow Ups"}
            </button>
            <button type="button" className={adminSecondaryButtonClass} disabled={busy !== null} onClick={() => void responded()}>
              {busy === "responded" ? "Moving…" : "Responded"}
            </button>
            <button
              type="button"
              className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/[0.08] px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-[#FFB4B4] transition hover:bg-[#E32B2B]/15"
              onClick={() => setShowArchive(true)}
            >
              Archive
            </button>
          </div>
        </div>
      </CollapsibleCard>
      {showArchive ? (
        <ConfirmModal
          title="Archive lead"
          danger
          confirmLabel="Archive lead"
          busy={archiving}
          message={
            <>
              Archive <span className="font-semibold text-white">{name}</span>? It moves to the Archives tab.
            </>
          }
          onCancel={() => setShowArchive(false)}
          onConfirm={() => void confirmArchive()}
        />
      ) : null}
    </>
  );
}

export function PendingLeadsPanel(props: {
  grouped: Record<OutreachLane, OutreachHubLead[]>;
  focusLeadId: string | null;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const leads = selectPendingLeads(props.grouped);
  return (
    <div className="space-y-4">
      <div className={`${adminPanelClass} p-5`}>
        <p className="text-sm leading-relaxed text-white/60">
          Leads already contacted, waiting on a reply. Each shows the message sent, when a follow-up is due, and how many
          follow-ups have gone out. Use <span className={adminLabelClass}>Send To Follow Ups</span> to send the next touch now,
          <span className={adminLabelClass}> Responded</span> when they reply, or <span className={adminLabelClass}>Archive</span>.
        </p>
      </div>
      {leads.length === 0 ? (
        <p className="text-sm text-white/55">No pending leads.</p>
      ) : (
        <div className="space-y-3">
          {leads.map((entry) => (
            <PendingLeadCard
              key={`${entry.platform}-${entry.lead.id}`}
              entry={entry}
              focus={props.focusLeadId === entry.lead.id}
              onChanged={props.onChanged}
              onError={props.onError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
