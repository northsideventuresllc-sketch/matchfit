"use client";

import { useState } from "react";
import {
  adminAccentButtonClass,
  adminInputClassSm,
  adminLabelClass,
  adminPanelClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import type { EmailLeadRow, InstagramLeadRow, OutreachHubLead } from "@/lib/outreach-types";
import { CollapsibleCard, CopyButton, RegenerateModal, SaveIndicator, useAutosave } from "./ui-bits";
import {
  queueDispatch,
  regenerateResponse,
  saveResponseDraft,
  scanPendingResponses,
  sendManual,
} from "./client-api";
import { leadContactUrl, leadDisplayName } from "./helpers";

function PendingResponseCard(props: {
  entry: OutreachHubLead;
  focus?: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const { entry } = props;
  const lead = entry.lead as InstagramLeadRow | EmailLeadRow;
  const [draft, setDraft] = useState(lead.pendingResponseDraft ?? "");
  const [incoming, setIncoming] = useState("");
  const [showRegen, setShowRegen] = useState(false);
  const [sending, setSending] = useState<null | "manual" | "agent">(null);

  const name = leadDisplayName(entry);
  const contact = leadContactUrl(entry);

  // Autosave the edited reply (WF2 item 5/8) — draft-only route, never moves the lead.
  const saveStatus = useAutosave({ draft }, async ({ draft }) => {
    const result = await saveResponseDraft(lead.id, entry.platform, draft);
    if (!result.ok) props.onError(result.error);
    return { ok: result.ok };
  });

  async function regenerate(feedback: string): Promise<{ ok: boolean; error?: string }> {
    const steer = [incoming.trim(), feedback ? `Rewrite note: ${feedback}` : ""].filter(Boolean).join("\n\n");
    const result = await regenerateResponse(lead.id, entry.platform, steer || undefined);
    if (!result.ok) return { ok: false, error: result.error };
    setDraft(result.data.pendingResponseDraft ?? "");
    return { ok: true };
  }

  async function send(mode: "manual" | "agent") {
    setSending(mode);
    const ref = [{ id: lead.id, platform: entry.platform }];
    const result = mode === "manual" ? await sendManual(ref) : await queueDispatch(ref);
    setSending(null);
    if (!result.ok) return props.onError(result.error);
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
        {lead.replyReceivedAt ? `Reply received ${new Date(lead.replyReceivedAt).toLocaleString()}` : "Reply pending response"}
      </p>
    </>
  );

  return (
    <>
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
            <span className={adminLabelClass}>{entry.platform === "email" ? "Reply" : "Reply DM"}</span>
            <textarea
              className={adminInputClassSm}
              rows={6}
              value={draft}
              placeholder="No draft yet — run Regenerate to generate one."
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              className={adminAccentButtonClass}
              disabled={sending !== null}
              onClick={() => void send("agent")}
            >
              {sending === "agent" ? "Queuing…" : "Agent Send"}
            </button>
            <button
              type="button"
              className={adminSecondaryButtonClass}
              disabled={sending !== null}
              onClick={() => void send("manual")}
            >
              {sending === "manual" ? "Sending…" : "Manual Send"}
            </button>
            <button type="button" className={adminSecondaryButtonClass} onClick={() => setShowRegen(true)}>
              Regenerate
            </button>
            <CopyButton value={draft} label="Copy" />
            <SaveIndicator status={saveStatus} />
          </div>
          <p className="text-[11px] text-white/40">
            Send queues the reply to the Send Queue tab. Marking it sent there moves the lead back to Pending Leads.
          </p>
        </div>
      </CollapsibleCard>
      {showRegen ? (
        <RegenerateModal title="Regenerate reply" onClose={() => setShowRegen(false)} onRegenerate={regenerate} />
      ) : null}
    </>
  );
}

export function PendingResponsesPanel(props: {
  leads: OutreachHubLead[];
  focusLeadId: string | null;
  onChanged: () => void;
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
    props.onChanged();
  }

  return (
    <div className="space-y-4">
      <div className={`${adminPanelClass} space-y-3 p-5`}>
        <p className="text-sm leading-relaxed text-white/60">
          Leads that replied and are waiting on a response. The agent drafts a reply you can edit (auto-saved), regenerate,
          copy, or send. Scan checks email (jb@match-fit.net) and queues an Instagram DM scan.
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
              onChanged={props.onChanged}
              onError={props.onError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
