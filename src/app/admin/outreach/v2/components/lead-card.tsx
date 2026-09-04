"use client";

import { useMemo, useState } from "react";
import {
  adminAccentButtonClass,
  adminInputClassSm,
  adminLabelClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import {
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
} from "@/lib/outreach-types";
import { CollapsibleCard, ConfirmModal, SaveIndicator, useAutosave } from "./ui-bits";
import {
  CopyFieldButtons,
  EmailClientPreview,
  RegenerateButtons,
  emailFieldKeys,
  fieldDescriptors,
  seedFields,
  type LeadStage,
} from "./lead-fields";
import { deleteLead, patchLead, queueDispatch, regenerateCopy, sendManual } from "./client-api";
import { followUpDueAt, formatOverdue, laneOf, leadContactUrl, leadDisplayName } from "./helpers";

export type { LeadStage };

/**
 * Today's Leads / Past Due / Pending-follow-up lead bubble. Autosaves every edit (no Save button),
 * offers per-field Regenerate (feedback popup that loops) and per-field Copy, and the two send
 * actions (WF2 item 3). Delete stays so junk leads can be pruned (they otherwise count against the
 * daily top-up).
 */
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
  const [approving, setApproving] = useState(false);
  const [manualSending, setManualSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showPreview, setShowPreview] = useState(platform === "email");

  const name = leadDisplayName(entry);
  const contact = leadContactUrl(entry);
  const lane = laneOf(entry);
  const dueInfo = stage !== "primary" ? formatOverdue(followUpDueAt(entry)) : null;

  // Autosave every field/intent edit (WF2 item 5). Native cmd/ctrl+Z handles undo inside a field.
  const saveStatus = useAutosave({ fields, intent }, async ({ fields, intent }) => {
    const result = await patchLead(lead.id, { platform, ...fields, outreachIntent: intent, saveToHub: true });
    if (!result.ok) props.onError(result.error);
    else props.onError("");
    return { ok: result.ok };
  });

  const setField = (key: string, value: string) => setFields((prev) => ({ ...prev, [key]: value }));

  async function regenerate(fieldKeys: string[], feedback: string): Promise<{ ok: boolean; error?: string }> {
    const result = await regenerateCopy(lead.id, platform, fieldKeys, feedback);
    if (!result.ok) return { ok: false, error: result.error };
    const copy = result.data.copy ?? {};
    setFields((prev) => {
      const next = { ...prev };
      for (const key of fieldKeys) if (typeof copy[key] === "string") next[key] = copy[key];
      return next;
    });
    return { ok: true };
  }

  async function approve() {
    setApproving(true);
    const result = await queueDispatch([{ id: lead.id, platform }]);
    setApproving(false);
    if (!result.ok) return props.onError(result.error);
    if (result.data.queued.length === 0) return props.onError("Lead was already queued for dispatch.");
    props.onError("");
    props.onChanged();
  }

  async function manualSend() {
    setManualSending(true);
    const result = await sendManual([{ id: lead.id, platform }]);
    setManualSending(false);
    if (!result.ok) return props.onError(result.error);
    props.onError("");
    props.onChanged();
  }

  async function confirmDelete() {
    setDeleting(true);
    const result = await deleteLead(lead.id, platform, "Archived from Outreach HQ");
    setDeleting(false);
    if (!result.ok) return props.onError(result.error);
    setShowDelete(false);
    props.onError("");
    props.onChanged();
  }

  const { subjectKey, bodyKey } = emailFieldKeys(stage);

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

          <div className="flex flex-wrap items-center gap-2 pt-1">
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
            <RegenerateButtons platform={platform} stage={stage} onRegenerate={regenerate} />
            <CopyFieldButtons platform={platform} stage={stage} fields={fields} />
            {platform === "email" ? (
              <button type="button" className={adminSecondaryButtonClass} onClick={() => setShowPreview((v) => !v)}>
                {showPreview ? "Hide preview" : "Show preview"}
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/[0.08] px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-[#FFB4B4] transition hover:bg-[#E32B2B]/15"
              onClick={() => setShowDelete(true)}
            >
              Delete
            </button>
            <SaveIndicator status={saveStatus} />
          </div>
        </div>
      </CollapsibleCard>
      {showDelete ? (
        <ConfirmModal
          title="Delete lead"
          danger
          confirmLabel="Delete lead"
          busy={deleting}
          message={
            <>
              Delete <span className="font-semibold text-white">{name}</span>? It moves to Archives (kept 7 days).
            </>
          }
          onCancel={() => setShowDelete(false)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </>
  );
}
