"use client";

import { useMemo, useState } from "react";
import {
  adminInputClassSm,
  adminLabelClass,
  adminPanelClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import type {
  EmailLeadRow,
  InstagramLeadRow,
  OutreachCoworkDispatchBatchRow,
  OutreachHubLead,
} from "@/lib/outreach-types";
import {
  briefLeadMessageFields,
  dispatchBriefLeads,
  formatDispatchSlot,
  leadContactUrl,
  leadDisplayName,
  type MessageField,
} from "./helpers";
import {
  cancelAgentSendToManual,
  deleteLead,
  patchLead,
  pullDispatch,
  regenerateCopy,
  regenerateResponse,
  saveResponseDraft,
  setManualSent,
} from "./client-api";
import {
  CollapsibleCard,
  ConfirmModal,
  CopyButton,
  ProgressBar,
  RegenerateModal,
  SaveIndicator,
  useAutosave,
} from "./ui-bits";
import {
  EmailClientPreview,
  RegenerateButtons,
  emailFieldKeys,
  fieldDescriptors,
  seedFields,
  type LeadStage,
} from "./lead-fields";

/** Read-only message text + a copy button — the same text queued to actually send. */
function MessageFieldBlock({ field }: { field: MessageField }) {
  return (
    <div className="space-y-1 rounded-lg border border-white/[0.06] bg-[#0E1016]/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-white/45">{field.label}</span>
        <CopyButton
          value={field.text}
          label="Copy"
          className="rounded-md border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
        />
      </div>
      <p className="whitespace-pre-wrap text-sm text-white/85 selection:bg-[#FF7E00]/30">{field.text}</p>
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    queued: "border-[#FF7E00]/40 bg-[#FF7E00]/10 text-[#FFD34E]",
    dispatched: "border-sky-400/40 bg-sky-500/10 text-sky-100",
    running: "border-sky-400/40 bg-sky-500/10 text-sky-100",
    complete: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
    failed: "border-[#E32B2B]/40 bg-[#E32B2B]/15 text-[#FFB4B4]",
  };
  return `rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[status] ?? "border-white/15 bg-white/[0.04] text-white/55"}`;
}

/**
 * Estimated agent progress for an Agent Send batch (WF2 item 4.2.3). The real percentage lands when
 * the local Chrome/desktop send agent is wired in; until then this reflects the batch's own status
 * so the bar shows roughly where the run is.
 */
function progressForStatus(status: string): number {
  switch (status) {
    case "queued":
      return 5;
    case "dispatched":
      return 25;
    case "running":
      return 60;
    case "complete":
      return 100;
    case "failed":
      return 100;
    default:
      return 0;
  }
}

/** dispatchPreviousLane -> the copy stage to edit in the Send Queue. */
function stageForPreviousLane(prev: string | null | undefined): LeadStage {
  if (prev === "follow_up_1") return "follow_up_1";
  if (prev === "follow_up_2") return "follow_up_2";
  return "primary";
}

function BatchCard(props: {
  batch: OutreachCoworkDispatchBatchRow;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const { batch } = props;
  const leads = dispatchBriefLeads(batch.brief);
  const pullable = batch.status === "queued";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [cancelingIds, setCancelingIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function pull() {
    if (selected.size === 0) return;
    setBusy(true);
    const result = await pullDispatch([...selected]);
    setBusy(false);
    if (!result.ok) return props.onError(result.error);
    setSelected(new Set());
    props.onError("");
    props.onChanged();
  }

  async function cancelToManual(leadId: string) {
    setCancelingIds((prev) => new Set(prev).add(leadId));
    const result = await cancelAgentSendToManual([leadId]);
    setCancelingIds((prev) => {
      const next = new Set(prev);
      next.delete(leadId);
      return next;
    });
    if (!result.ok) return props.onError(result.error);
    props.onError("");
    props.onChanged();
  }

  const resultSummary =
    batch.result && typeof batch.result === "object"
      ? (batch.result as { sent?: number; failed?: number })
      : null;
  const status = String(batch.status);
  const live = status === "queued" || status === "dispatched" || status === "running";

  return (
    <div className={`${adminPanelClass} space-y-3 p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base font-black text-white">
            <span className="mr-2 rounded-md border border-sky-400/40 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-sky-100">
              Agent
            </span>
            {formatDispatchSlot(batch.scheduledFor, batch.slot)}
          </p>
          <p className="text-xs text-white/45">
            {leads.length} lead{leads.length === 1 ? "" : "s"}
            {resultSummary ? ` · ${resultSummary.sent ?? 0} sent · ${resultSummary.failed ?? 0} failed` : ""}
          </p>
        </div>
        <span className={statusBadge(status)}>{status}</span>
      </div>

      {/* Agent progress — live estimate on the local send agent (wiring; real % when agent lands). */}
      {live ? <ProgressBar percent={progressForStatus(status)} label="Agent send progress (estimated)" /> : null}

      {leads.length === 0 ? (
        <p className="text-xs text-white/40">No leads in this batch.</p>
      ) : (
        <ul className="space-y-1.5">
          {leads.map((l) => {
            const messageFields = briefLeadMessageFields(l);
            return (
              <li
                key={`${l.platform}-${l.leadId}`}
                className="space-y-2 rounded-xl border border-white/[0.06] bg-[#0E1016]/70 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  {pullable ? (
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-[#FF7E00]"
                      checked={selected.has(l.leadId)}
                      onChange={() => toggle(l.leadId)}
                      aria-label={`Select ${l.displayName}`}
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold text-white">{l.displayName}</span>
                    <span className="text-white/40"> · {l.platform}</span>
                  </span>
                  {pullable ? (
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-white/70 transition hover:border-white/25 hover:text-white disabled:opacity-50"
                      disabled={cancelingIds.has(l.leadId)}
                      onClick={() => void cancelToManual(l.leadId)}
                    >
                      {cancelingIds.has(l.leadId) ? "Moving…" : "→ Manual"}
                    </button>
                  ) : null}
                </div>
                {messageFields.length > 0 ? (
                  <div className="space-y-1.5">
                    {messageFields.map((field) => (
                      <MessageFieldBlock key={field.label} field={field} />
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {pullable && leads.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={adminSecondaryButtonClass} disabled={busy || selected.size === 0} onClick={() => void pull()}>
            {busy ? "Pulling…" : `Pull ${selected.size || ""} from batch`.trim()}
          </button>
          <span className="text-[11px] text-white/40">Pulled leads return to their previous lane.</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Manual Send bubble — editable copy + the full manual button set (WF2 item 4.2). A reply queued
 * from Pending Responses (previousLane = pending_response) edits its reply draft instead of the
 * outbound copy. Everything autosaves.
 */
function ManualQueueCard(props: {
  entry: OutreachHubLead;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const { entry } = props;
  const platform = entry.platform;
  const lead = entry.lead as InstagramLeadRow | EmailLeadRow & { dispatchPreviousLane?: string | null };
  const prevLane = (lead as { dispatchPreviousLane?: string | null }).dispatchPreviousLane ?? null;
  const isReply = prevLane === "pending_response";
  const stage = stageForPreviousLane(prevLane);
  const sent = Boolean((lead as { manualSentAt?: string | null }).manualSentAt);
  const contactUrl = leadContactUrl(entry);

  const descs = useMemo(() => fieldDescriptors(platform, stage), [platform, stage]);
  const [fields, setFields] = useState<Record<string, string>>(() =>
    seedFields(lead as unknown as Record<string, unknown>, descs),
  );
  const [replyDraft, setReplyDraft] = useState((lead as { pendingResponseDraft?: string | null }).pendingResponseDraft ?? "");
  const [showPreview, setShowPreview] = useState(platform === "email");
  const [showRegenReply, setShowRegenReply] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [busy, setBusy] = useState<null | "sent" | "drafts" | "archive">(null);

  // Autosave copy edits (outbound) or the reply draft, whichever this bubble is showing.
  const saveStatus = useAutosave(isReply ? { replyDraft } : { fields }, async () => {
    if (isReply) {
      const r = await saveResponseDraft(lead.id, platform, replyDraft);
      if (!r.ok) props.onError(r.error);
      return { ok: r.ok };
    }
    const r = await patchLead(lead.id, { platform, ...fields, saveToHub: true });
    if (!r.ok) props.onError(r.error);
    return { ok: r.ok };
  });

  const setField = (key: string, value: string) => setFields((prev) => ({ ...prev, [key]: value }));

  async function regenerateOutbound(fieldKeys: string[], feedback: string): Promise<{ ok: boolean; error?: string }> {
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

  async function regenerateReply(feedback: string): Promise<{ ok: boolean; error?: string }> {
    const result = await regenerateResponse(lead.id, platform, feedback || undefined);
    if (!result.ok) return { ok: false, error: result.error };
    setReplyDraft(result.data.pendingResponseDraft ?? "");
    return { ok: true };
  }

  async function markSent() {
    setBusy("sent");
    const result = await setManualSent(lead.id, platform, true);
    setBusy(null);
    if (!result.ok) return props.onError(result.error);
    props.onError("");
    props.onChanged();
  }

  async function sendDrafts() {
    setBusy("drafts");
    const result = await pullDispatch([lead.id]);
    setBusy(null);
    if (!result.ok) return props.onError(result.error);
    props.onError("");
    props.onChanged();
  }

  async function confirmArchive() {
    setBusy("archive");
    const result = await deleteLead(lead.id, platform, "Archived from Send Queue");
    setBusy(null);
    if (!result.ok) return props.onError(result.error);
    setShowArchive(false);
    props.onError("");
    props.onChanged();
  }

  const { subjectKey, bodyKey } = emailFieldKeys(stage);
  const previewSubject = isReply ? `Re: ${(lead as EmailLeadRow).emailSubject ?? ""}` : fields[subjectKey] ?? "";
  const previewBody = isReply ? replyDraft : fields[bodyKey] ?? "";

  const header = (
    <>
      <p className="truncate text-base font-black text-white">
        <span className="mr-2 rounded-md border border-[#FF7E00]/40 bg-[#FF7E00]/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#FFD34E]">
          Manual{isReply ? " reply" : ""}
        </span>
        {leadDisplayName(entry)}
        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-white/40">{platform}</span>
      </p>
      {contactUrl ? (
        <a
          href={contactUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 inline-block text-xs text-white/45 underline decoration-white/30 underline-offset-2 hover:text-white"
        >
          Open contact ↗
        </a>
      ) : null}
    </>
  );

  return (
    <>
      <CollapsibleCard
        header={header}
        defaultOpen
        badges={<span className={sent ? statusBadge("complete") : statusBadge("queued")}>{sent ? "Sent" : "Not sent"}</span>}
      >
        <div className="space-y-3">
          {isReply ? (
            <label className="block space-y-1">
              <span className={adminLabelClass}>Reply</span>
              <textarea
                className={adminInputClassSm}
                rows={6}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
              />
            </label>
          ) : (
            descs.map((d) => (
              <label key={d.key} className="block space-y-1">
                <span className={adminLabelClass}>{d.label}</span>
                {d.rows === 1 ? (
                  <input className={adminInputClassSm} value={fields[d.key]} onChange={(e) => setField(d.key, e.target.value)} />
                ) : (
                  <textarea
                    className={adminInputClassSm}
                    rows={d.rows}
                    value={fields[d.key]}
                    onChange={(e) => setField(d.key, e.target.value)}
                  />
                )}
              </label>
            ))
          )}

          {platform === "email" && showPreview ? (
            <EmailClientPreview
              name={(lead as EmailLeadRow).name}
              email={(lead as EmailLeadRow).email}
              subject={previewSubject}
              body={previewBody}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {sent ? (
              <button type="button" className={adminSecondaryButtonClass} disabled={busy !== null} onClick={() => void setManualSent(lead.id, platform, false).then((r) => (r.ok ? props.onChanged() : props.onError(r.error)))}>
                Not Sent
              </button>
            ) : (
              <button type="button" className={adminSecondaryButtonClass} disabled={busy !== null} onClick={() => void markSent()}>
                {busy === "sent" ? "Updating…" : "Mark Sent"}
              </button>
            )}

            {isReply ? (
              <button type="button" className={adminSecondaryButtonClass} onClick={() => setShowRegenReply(true)}>
                Regenerate DM
              </button>
            ) : (
              <RegenerateButtons platform={platform} stage={stage} onRegenerate={regenerateOutbound} />
            )}

            {platform === "email" ? (
              <button type="button" className={adminSecondaryButtonClass} onClick={() => setShowPreview((v) => !v)}>
                {showPreview ? "Hide preview" : "Preview"}
              </button>
            ) : null}

            <button type="button" className={adminSecondaryButtonClass} disabled={busy !== null} onClick={() => void sendDrafts()}>
              {busy === "drafts" ? "Moving…" : "Send Drafts"}
            </button>
            <button
              type="button"
              className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/[0.08] px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-[#FFB4B4] transition hover:bg-[#E32B2B]/15"
              onClick={() => setShowArchive(true)}
            >
              Archive
            </button>
            <SaveIndicator status={saveStatus} />
          </div>
          <p className="text-[11px] text-white/40">
            Send Drafts returns this lead to Today&apos;s Leads / Past Due. Mark Sent moves it to Pending Leads.
          </p>
        </div>
      </CollapsibleCard>
      {showRegenReply ? (
        <RegenerateModal title="Regenerate reply" onClose={() => setShowRegenReply(false)} onRegenerate={regenerateReply} />
      ) : null}
      {showArchive ? (
        <ConfirmModal
          title="Archive lead"
          danger
          confirmLabel="Archive lead"
          busy={busy === "archive"}
          message={
            <>
              Archive <span className="font-semibold text-white">{leadDisplayName(entry)}</span>? It moves to the Archives tab.
            </>
          }
          onCancel={() => setShowArchive(false)}
          onConfirm={() => void confirmArchive()}
        />
      ) : null}
    </>
  );
}

export function DispatchPanel(props: {
  upcoming: OutreachCoworkDispatchBatchRow[];
  recentlyCompleted: OutreachCoworkDispatchBatchRow[];
  /** Leads queued via Manual Send (sendMode="manual", no Cowork batch) — see selectManualQueuedLeads. */
  manualQueued: OutreachHubLead[];
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className={adminLabelClass}>Manual send ({props.manualQueued.length})</p>
        {props.manualQueued.length === 0 ? (
          <p className="text-sm text-white/55">No leads queued for manual send.</p>
        ) : (
          props.manualQueued.map((entry) => (
            <ManualQueueCard key={`${entry.platform}-${entry.lead.id}`} entry={entry} onChanged={props.onChanged} onError={props.onError} />
          ))
        )}
      </section>

      <section className="space-y-3">
        <p className={adminLabelClass}>Agent scheduled</p>
        {props.upcoming.length === 0 ? (
          <p className="text-sm text-white/55">No upcoming dispatch batches. Agent Send queues leads into the next 1pm or 4pm run.</p>
        ) : (
          props.upcoming.map((b) => <BatchCard key={b.id} batch={b} onChanged={props.onChanged} onError={props.onError} />)
        )}
      </section>

      <section className="space-y-3">
        <p className={adminLabelClass}>Completed in the last 24 hours</p>
        {props.recentlyCompleted.length === 0 ? (
          <p className="text-sm text-white/55">No batches completed in the last 24 hours.</p>
        ) : (
          props.recentlyCompleted.map((b) => <BatchCard key={b.id} batch={b} onChanged={props.onChanged} onError={props.onError} />)
        )}
      </section>
    </div>
  );
}
