"use client";

import { useMemo, useState } from "react";
import {
  adminAccentButtonClass,
  adminInputClassSm,
  adminLabelClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import {
  MATCH_FIT_SIGNATURE_FROM_EMAIL,
  MATCH_FIT_SIGNATURE_LINES,
} from "@/lib/match-fit-signature";
import {
  OUTREACH_COWORK_EMAIL_BCC,
  OUTREACH_INSTAGRAM_PROCEDURE_STEPS,
  OUTREACH_INTENT_OPTIONS,
  isOutreachIntent,
  outreachIntentLabel,
  type OutreachIntent,
} from "@/lib/outreach-cowork";
import type {
  EmailLeadRow,
  FacebookLeadRow,
  InstagramLeadRow,
  OutreachHubLead,
  OutreachPlatform,
} from "@/lib/outreach-types";
import { CollapsibleCard, CopyButton, Modal } from "./ui-bits";
import { deleteLead, patchLead, queueDispatch, regenerateCopy, sendManual } from "./client-api";
import { followUpDueAt, formatOverdue, laneOf, leadContactUrl, leadDisplayName } from "./helpers";

export type LeadStage = "primary" | "follow_up_1" | "follow_up_2";

type FieldDesc = { key: string; label: string; rows: number };

function fieldDescriptors(platform: OutreachPlatform, stage: LeadStage): FieldDesc[] {
  if (platform === "instagram") {
    if (stage === "follow_up_1") return [{ key: "followUp1DmText", label: "First follow-up DM", rows: 5 }];
    if (stage === "follow_up_2") return [{ key: "followUp2DmText", label: "Second follow-up DM", rows: 5 }];
    return [
      { key: "dmText", label: "First DM", rows: 5 },
      { key: "commentText", label: "Comment", rows: 3 },
    ];
  }
  if (platform === "email") {
    if (stage === "follow_up_1")
      return [
        { key: "followUp1EmailSubject", label: "First follow-up subject", rows: 1 },
        { key: "followUp1EmailBody", label: "First follow-up email", rows: 6 },
      ];
    if (stage === "follow_up_2")
      return [
        { key: "followUp2EmailSubject", label: "Second follow-up subject", rows: 1 },
        { key: "followUp2EmailBody", label: "Second follow-up email", rows: 6 },
      ];
    return [
      { key: "emailSubject", label: "Subject", rows: 1 },
      { key: "emailBody", label: "Body", rows: 8 },
    ];
  }
  return [{ key: "pagePostText", label: "Page post", rows: 6 }];
}

function seedFields(lead: Record<string, unknown>, descs: FieldDesc[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of descs) out[d.key] = typeof lead[d.key] === "string" ? (lead[d.key] as string) : "";
  return out;
}

function EmailClientPreview(props: { name: string; email: string; subject: string; body: string }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.1] bg-white text-[#0B0C0F] shadow-lg">
      <div className="flex items-center gap-2 border-b border-black/10 bg-[#F3F4F6] px-4 py-2">
        <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
        <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
        <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        <span className="ml-2 text-xs font-semibold text-black/50">New Message — Match Fit</span>
      </div>
      <div className="space-y-1 border-b border-black/10 px-4 py-3 text-sm">
        <p>
          <span className="font-semibold text-black/50">From:</span> Match Fit &lt;
          {MATCH_FIT_SIGNATURE_FROM_EMAIL}&gt;
        </p>
        <p>
          <span className="font-semibold text-black/50">To:</span> {props.name} &lt;{props.email}&gt;
        </p>
        <p>
          <span className="font-semibold text-black/50">BCC:</span> {OUTREACH_COWORK_EMAIL_BCC.join(" · ")}
        </p>
        <p>
          <span className="font-semibold text-black/50">Subject:</span>{" "}
          <span className="font-semibold">{props.subject}</span>
        </p>
      </div>
      <div className="px-4 py-4 text-sm leading-relaxed text-[#111]">
        <p className="whitespace-pre-wrap">{props.body}</p>
        <div className="mt-5 border-t border-black/10 pt-3">
          <div className="text-[13px] leading-snug">
            {MATCH_FIT_SIGNATURE_LINES.map((line, i) => (
              <p key={line} className={i <= 1 ? "font-semibold" : "text-black/70"}>
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteModal(props: {
  name: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 3;
  return (
    <Modal title="Delete lead" onClose={props.onCancel}>
      <p className="text-sm text-white/70">
        Deleting <span className="font-semibold text-white">{props.name}</span> archives it (kept 7 days in
        Archives). A reason is required so the model can learn from it.
      </p>
      <label className="mt-4 block space-y-1">
        <span className={adminLabelClass}>Delete reason (min 3 characters)</span>
        <textarea
          className={adminInputClassSm}
          rows={3}
          value={reason}
          placeholder="Not a fit — chain gym, no independent Fitness Pro angle…"
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-[#E32B2B]/50 bg-[#E32B2B]/15 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#FFB4B4] transition hover:bg-[#E32B2B]/25 disabled:opacity-40"
          disabled={!valid || props.busy}
          onClick={() => props.onConfirm(reason.trim())}
        >
          {props.busy ? "Deleting…" : "Delete lead"}
        </button>
        <button type="button" className={adminSecondaryButtonClass} disabled={props.busy} onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

export function LeadCard(props: {
  entry: OutreachHubLead;
  stage: LeadStage;
  focus?: boolean;
  showApprove?: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const { entry, stage } = props;
  const platform = entry.platform;
  const lead = entry.lead as InstagramLeadRow | FacebookLeadRow | EmailLeadRow;
  const descs = useMemo(() => fieldDescriptors(platform, stage), [platform, stage]);

  const [fields, setFields] = useState<Record<string, string>>(() =>
    seedFields(lead as unknown as Record<string, unknown>, descs),
  );
  const [intent, setIntent] = useState<string | null>(lead.outreachIntent);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [manualSending, setManualSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showPreview, setShowPreview] = useState(platform === "email");

  const name = leadDisplayName(entry);
  const contact = leadContactUrl(entry);
  const lane = laneOf(entry);
  const dueInfo = stage !== "primary" ? formatOverdue(followUpDueAt(entry)) : null;

  const dirty =
    descs.some((d) => fields[d.key] !== ((lead as unknown as Record<string, unknown>)[d.key] ?? "")) ||
    intent !== lead.outreachIntent;

  const setField = (key: string, value: string) => setFields((prev) => ({ ...prev, [key]: value }));

  async function save() {
    setSaving(true);
    const result = await patchLead(lead.id, {
      platform,
      ...fields,
      outreachIntent: intent,
      saveToHub: true,
    });
    setSaving(false);
    if (!result.ok) {
      props.onError(result.error);
      return;
    }
    props.onError("");
    props.onChanged();
  }

  async function regen() {
    setRegenBusy(true);
    const result = await regenerateCopy(
      lead.id,
      platform,
      descs.map((d) => d.key),
      feedback,
    );
    setRegenBusy(false);
    if (!result.ok) {
      props.onError(result.error);
      return;
    }
    const copy = result.data.copy ?? {};
    setFields((prev) => {
      const next = { ...prev };
      for (const d of descs) if (typeof copy[d.key] === "string") next[d.key] = copy[d.key];
      return next;
    });
    setFeedback("");
  }

  async function approve() {
    setApproving(true);
    const result = await queueDispatch([{ id: lead.id, platform }]);
    setApproving(false);
    if (!result.ok) {
      props.onError(result.error);
      return;
    }
    if (result.data.queued.length === 0) {
      props.onError("Lead was already queued for dispatch.");
      return;
    }
    props.onError("");
    props.onChanged();
  }

  async function manualSend() {
    setManualSending(true);
    const result = await sendManual([{ id: lead.id, platform }]);
    setManualSending(false);
    if (!result.ok) {
      props.onError(result.error);
      return;
    }
    props.onError("");
    props.onChanged();
  }

  async function confirmDelete(reason: string) {
    setDeleting(true);
    const result = await deleteLead(lead.id, platform, reason);
    setDeleting(false);
    if (!result.ok) {
      props.onError(result.error);
      return;
    }
    setShowDelete(false);
    props.onError("");
    props.onChanged();
  }

  const subjectKey = stage === "primary" ? "emailSubject" : stage === "follow_up_1" ? "followUp1EmailSubject" : "followUp2EmailSubject";
  const bodyKey = stage === "primary" ? "emailBody" : stage === "follow_up_1" ? "followUp1EmailBody" : "followUp2EmailBody";

  const header = (
    <>
      <p className="truncate text-base font-black text-white">
        {name}
        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-white/40">{platform}</span>
      </p>
      <p className="mt-0.5 truncate text-xs text-white/50">
        {lead.niche ? `${lead.niche} · ` : ""}score {lead.likelihoodScore}% · {outreachIntentLabel(intent)}
      </p>
    </>
  );

  const badges = (
    <>
      {dueInfo && dueInfo.state === "overdue" ? (
        <span className="rounded-full border border-[#E32B2B]/40 bg-[#E32B2B]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4]">
          {dueInfo.label}
        </span>
      ) : dueInfo && dueInfo.state === "scheduled" ? (
        <span className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/55">
          {dueInfo.label}
        </span>
      ) : null}
      <span className="hidden rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/45 sm:inline">
        {lane.replaceAll("_", " ")}
      </span>
    </>
  );

  return (
    <>
      <CollapsibleCard header={header} badges={badges} focus={props.focus}>
        <div className="space-y-3">
          {contact ? (
            <a
              href={contact}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-sm font-semibold text-[#FFD34E] hover:underline"
            >
              {platform === "instagram" ? "Open profile ↗" : platform === "facebook" ? "Open page ↗" : "Source ↗"}
            </a>
          ) : null}
          {lead.whyMatchFit ? <p className="text-sm text-white/70">{lead.whyMatchFit}</p> : null}

          <label className="block space-y-1">
            <span className={adminLabelClass}>Intent (required before live send)</span>
            <select
              className={adminInputClassSm}
              value={intent ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                setIntent(raw && isOutreachIntent(raw) ? (raw as OutreachIntent) : null);
              }}
            >
              <option value="">Unset</option>
              {OUTREACH_INTENT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {descs.map((d) => (
            <label key={d.key} className="block space-y-1">
              <span className={adminLabelClass}>{d.label}</span>
              {d.rows === 1 ? (
                <input
                  className={adminInputClassSm}
                  value={fields[d.key]}
                  onChange={(e) => setField(d.key, e.target.value)}
                />
              ) : (
                <textarea
                  className={adminInputClassSm}
                  rows={d.rows}
                  value={fields[d.key]}
                  onChange={(e) => setField(d.key, e.target.value)}
                />
              )}
            </label>
          ))}

          {platform === "instagram" ? (
            <div className="space-y-1">
              <span className={adminLabelClass}>Send checklist</span>
              <ol className="list-decimal space-y-0.5 pl-4 text-xs text-white/55">
                {OUTREACH_INSTAGRAM_PROCEDURE_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {platform === "email" && showPreview ? (
            <EmailClientPreview
              name={(lead as EmailLeadRow).name}
              email={(lead as EmailLeadRow).email}
              subject={fields[subjectKey] ?? (lead as EmailLeadRow).emailSubject}
              body={fields[bodyKey] ?? (lead as EmailLeadRow).emailBody}
            />
          ) : null}

          <label className="block space-y-1">
            <span className={adminLabelClass}>Rewrite feedback (optional)</span>
            <input
              className={adminInputClassSm}
              value={feedback}
              placeholder="Shorter opener, lead with founding promo…"
              onChange={(e) => setFeedback(e.target.value)}
            />
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            {props.showApprove ? (
              <button
                type="button"
                className={adminAccentButtonClass}
                disabled={approving || manualSending}
                onClick={() => void approve()}
              >
                {approving ? "Queuing…" : "Agent Send"}
              </button>
            ) : null}
            {props.showApprove ? (
              <button
                type="button"
                className={adminSecondaryButtonClass}
                disabled={approving || manualSending}
                onClick={() => void manualSend()}
              >
                {manualSending ? "Sending…" : "Manual Send"}
              </button>
            ) : null}
            <button
              type="button"
              className={adminSecondaryButtonClass}
              disabled={saving || !dirty}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : dirty ? "Save edits" : "Saved"}
            </button>
            <button type="button" className={adminSecondaryButtonClass} disabled={regenBusy} onClick={() => void regen()}>
              {regenBusy ? "Regenerating…" : "Regenerate copy"}
            </button>
            {platform === "email" ? (
              <button type="button" className={adminSecondaryButtonClass} onClick={() => setShowPreview((v) => !v)}>
                {showPreview ? "Hide preview" : "Show preview"}
              </button>
            ) : null}
            <CopyButton value={descs.map((d) => fields[d.key]).filter(Boolean).join("\n\n")} label="Copy" />
            <button
              type="button"
              className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/[0.08] px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-[#FFB4B4] transition hover:bg-[#E32B2B]/15"
              onClick={() => setShowDelete(true)}
            >
              Delete
            </button>
          </div>
        </div>
      </CollapsibleCard>
      {showDelete ? (
        <DeleteModal name={name} busy={deleting} onCancel={() => setShowDelete(false)} onConfirm={(r) => void confirmDelete(r)} />
      ) : null}
    </>
  );
}
