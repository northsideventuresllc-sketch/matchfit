"use client";

import { useState } from "react";
import {
  adminAccentButtonClass,
  adminInputClassSm,
  adminLabelClass,
  adminPanelClass,
} from "@/components/admin/admin-portal-ui";
import type { EmailLeadRow, InstagramLeadRow, OutreachHubLead } from "@/lib/outreach-types";
import { CollapsibleCard, CopyButton } from "./ui-bits";
import { regenerateResponse, scanPendingResponses } from "./client-api";
import { leadContactUrl, leadDisplayName } from "./helpers";

function PendingResponseCard(props: {
  entry: OutreachHubLead;
  focus?: boolean;
  onError: (message: string) => void;
}) {
  const { entry } = props;
  const lead = entry.lead as InstagramLeadRow | EmailLeadRow;
  const [draft, setDraft] = useState(lead.pendingResponseDraft ?? "");
  const [incoming, setIncoming] = useState("");
  const [busy, setBusy] = useState(false);

  const name = leadDisplayName(entry);
  const contact = leadContactUrl(entry);

  async function regen() {
    setBusy(true);
    const result = await regenerateResponse(lead.id, entry.platform, incoming);
    setBusy(false);
    if (!result.ok) {
      props.onError(result.error);
      return;
    }
    setDraft(result.data.pendingResponseDraft ?? "");
    props.onError("");
  }

  const header = (
    <>
      <p className="truncate text-base font-black text-white">
        {name}
        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-white/40">{entry.platform}</span>
      </p>
      <p className="mt-0.5 truncate text-xs text-white/50">
        {lead.replyReceivedAt ? `Reply received ${new Date(lead.replyReceivedAt).toLocaleString()}` : "Reply pending response"}
      </p>
    </>
  );

  return (
    <CollapsibleCard
      header={header}
      badges={
        lead.hasUnrespondedReply ? (
          <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-100">
            Needs reply
          </span>
        ) : null
      }
      focus={props.focus}
    >
      <div className="space-y-3">
        {contact ? (
          <a href={contact} target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-[#FFD34E] hover:underline">
            {entry.platform === "instagram" ? "Open profile ↗" : "Open source ↗"}
          </a>
        ) : entry.platform === "email" ? (
          <p className="text-sm text-white/60">{(lead as EmailLeadRow).email}</p>
        ) : null}

        <label className="block space-y-1">
          <span className={adminLabelClass}>Their message (optional — improves the regenerated reply)</span>
          <textarea
            className={adminInputClassSm}
            rows={2}
            value={incoming}
            placeholder="Paste what they replied with…"
            onChange={(e) => setIncoming(e.target.value)}
          />
        </label>

        <label className="block space-y-1">
          <span className={adminLabelClass}>Suggested response</span>
          <textarea
            className={adminInputClassSm}
            rows={6}
            value={draft}
            placeholder="No draft yet — run Regenerate to generate one."
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={adminAccentButtonClass} disabled={busy} onClick={() => void regen()}>
            {busy ? "Regenerating…" : "Regenerate"}
          </button>
          <CopyButton value={draft} label="Copy response" />
        </div>
        <p className="text-[11px] text-white/40">
          Edits here are for copy-and-send only — the reply is sent manually, then this lead moves on at the next scan.
        </p>
      </div>
    </CollapsibleCard>
  );
}

export function PendingResponsesPanel(props: {
  leads: OutreachHubLead[];
  focusLeadId: string | null;
  onError: (message: string) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function scan() {
    setScanning(true);
    setResult(null);
    const res = await scanPendingResponses();
    setScanning(false);
    if (!res.ok) {
      props.onError(res.error);
      return;
    }
    const { email, instagram } = res.data;
    setResult(
      `Email: ${email.configured ? `${email.matched} matched` : "not configured"} · Instagram: scan job queued (${instagram.candidateCount} candidates).`,
    );
    props.onError("");
  }

  return (
    <div className="space-y-4">
      <div className={`${adminPanelClass} space-y-3 p-5`}>
        <p className="text-sm leading-relaxed text-white/60">
          Leads that replied and are waiting on a response. Scan checks email (inline) and queues an Instagram Cowork scan
          job; matches land here as draft responses you can regenerate and copy.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={adminAccentButtonClass} disabled={scanning} onClick={() => void scan()}>
            {scanning ? "Scanning…" : "Scan for replies"}
          </button>
          {result ? <span className="text-xs text-white/55">{result}</span> : null}
        </div>
      </div>

      {props.leads.length === 0 ? (
        <p className="text-sm text-white/55">No pending responses right now. Run a scan to check for new replies.</p>
      ) : (
        <div className="space-y-3">
          {props.leads.map((entry) => (
            <PendingResponseCard
              key={`${entry.platform}-${entry.lead.id}`}
              entry={entry}
              focus={props.focusLeadId === entry.lead.id}
              onError={props.onError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
