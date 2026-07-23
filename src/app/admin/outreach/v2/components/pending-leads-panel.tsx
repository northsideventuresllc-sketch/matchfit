"use client";

import { useState } from "react";
import {
  adminAccentButtonClass,
  adminInputClassSm,
  adminLabelClass,
  adminPanelClass,
} from "@/components/admin/admin-portal-ui";
import { outreachIntentLabel } from "@/lib/outreach-cowork";
import type { OutreachHubLead } from "@/lib/outreach-types";
import { CollapsibleCard } from "./ui-bits";
import { sendAnother } from "./client-api";
import { leadContactUrl, leadDisplayName } from "./helpers";

function PendingLeadCard(props: {
  entry: OutreachHubLead;
  focus?: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const { entry } = props;
  const lead = entry.lead;
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const name = leadDisplayName(entry);
  const contact = leadContactUrl(entry);

  async function send() {
    setBusy(true);
    setDone(null);
    const result = await sendAnother(lead.id, entry.platform, feedback);
    setBusy(false);
    if (!result.ok) {
      props.onError(result.error);
      return;
    }
    setFeedback("");
    setDone(`Queued to ${result.data.dispatch.slot ?? "next"} dispatch run.`);
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

  return (
    <CollapsibleCard header={header} focus={props.focus}>
      <div className="space-y-3">
        {contact ? (
          <a href={contact} target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-[#FFD34E] hover:underline">
            Open ↗
          </a>
        ) : null}
        {lead.whyMatchFit ? <p className="text-sm text-white/70">{lead.whyMatchFit}</p> : null}
        <p className="text-xs text-white/45">No action needed — outreach was already sent. Send another touch if you want to re-engage.</p>

        <label className="block space-y-1">
          <span className={adminLabelClass}>Feedback for the new message (optional)</span>
          <input
            className={adminInputClassSm}
            value={feedback}
            placeholder="Reference their latest post, softer ask…"
            onChange={(e) => setFeedback(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={adminAccentButtonClass} disabled={busy} onClick={() => void send()}>
            {busy ? "Queuing…" : "Send another message"}
          </button>
          {done ? <span className="text-xs font-semibold text-emerald-300">{done}</span> : null}
        </div>
      </div>
    </CollapsibleCard>
  );
}

export function PendingLeadsPanel(props: {
  leads: OutreachHubLead[];
  focusLeadId: string | null;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className={`${adminPanelClass} p-5`}>
        <p className="text-sm leading-relaxed text-white/60">
          Leads already contacted with no action currently needed. Use the send-another action to generate a fresh touch and
          queue it straight into the next Dispatch run.
        </p>
      </div>
      {props.leads.length === 0 ? (
        <p className="text-sm text-white/55">No pending leads.</p>
      ) : (
        <div className="space-y-3">
          {props.leads.map((entry) => (
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
