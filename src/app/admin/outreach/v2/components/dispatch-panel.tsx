"use client";

import { useState } from "react";
import { adminLabelClass, adminPanelClass, adminSecondaryButtonClass } from "@/components/admin/admin-portal-ui";
import type { OutreachCoworkDispatchBatchRow, OutreachHubLead } from "@/lib/outreach-types";
import {
  briefLeadMessageFields,
  dispatchBriefLeads,
  formatDispatchSlot,
  leadContactUrl,
  leadDisplayName,
  manualQueueMessageFields,
  type MessageField,
} from "./helpers";
import { cancelAgentSendToManual, pullDispatch, setManualSent } from "./client-api";
import { CopyButton } from "./ui-bits";

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
    if (!result.ok) {
      props.onError(result.error);
      return;
    }
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
    if (!result.ok) {
      props.onError(result.error);
      return;
    }
    props.onError("");
    props.onChanged();
  }

  const resultSummary =
    batch.result && typeof batch.result === "object"
      ? (batch.result as { sent?: number; failed?: number })
      : null;

  return (
    <div className={`${adminPanelClass} space-y-3 p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base font-black text-white">{formatDispatchSlot(batch.scheduledFor, batch.slot)}</p>
          <p className="text-xs text-white/45">
            {leads.length} lead{leads.length === 1 ? "" : "s"}
            {resultSummary ? ` · ${resultSummary.sent ?? 0} sent · ${resultSummary.failed ?? 0} failed` : ""}
          </p>
        </div>
        <span className={statusBadge(String(batch.status))}>{String(batch.status)}</span>
      </div>

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
          <button
            type="button"
            className={adminSecondaryButtonClass}
            disabled={busy || selected.size === 0}
            onClick={() => void pull()}
          >
            {busy ? "Pulling…" : `Pull ${selected.size || ""} from batch`.trim()}
          </button>
          <span className="text-[11px] text-white/40">Pulled leads return to their previous lane.</span>
        </div>
      ) : null}
    </div>
  );
}

function ManualQueueCard(props: {
  entry: OutreachHubLead;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const { entry } = props;
  const { lead } = entry;
  const [busy, setBusy] = useState(false);
  const sent = Boolean(lead.manualSentAt);
  const contactUrl = leadContactUrl(entry);
  const messageFields = manualQueueMessageFields(entry);

  async function toggleSent(nextSent: boolean) {
    setBusy(true);
    const result = await setManualSent(lead.id, entry.platform, nextSent);
    setBusy(false);
    if (!result.ok) {
      props.onError(result.error);
      return;
    }
    props.onError("");
    props.onChanged();
  }

  return (
    <div className={`${adminPanelClass} space-y-3 p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-white">{leadDisplayName(entry)}</p>
          <p className="text-xs text-white/45">
            {entry.platform}
            {contactUrl ? (
              <>
                {" · "}
                <a
                  href={contactUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-white/30 underline-offset-2 hover:text-white"
                >
                  Open contact
                </a>
              </>
            ) : null}
          </p>
        </div>
        <span className={sent ? statusBadge("complete") : statusBadge("queued")}>
          {sent ? "Sent" : "Not sent"}
        </span>
      </div>

      {messageFields.length > 0 ? (
        <div className="space-y-1.5">
          {messageFields.map((field) => (
            <MessageFieldBlock key={field.label} field={field} />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {sent ? (
          <>
            <span className="text-[11px] text-white/40">
              Marked sent {new Date(lead.manualSentAt as string).toLocaleString()}
            </span>
            <button
              type="button"
              className={adminSecondaryButtonClass}
              disabled={busy}
              onClick={() => void toggleSent(false)}
            >
              {busy ? "Updating…" : "Not Sent"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={adminSecondaryButtonClass}
            disabled={busy}
            onClick={() => void toggleSent(true)}
          >
            {busy ? "Updating…" : "Mark Sent"}
          </button>
        )}
      </div>
    </div>
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
        <p className={adminLabelClass}>Manual ({props.manualQueued.length})</p>
        {props.manualQueued.length === 0 ? (
          <p className="text-sm text-white/55">No leads queued for manual send.</p>
        ) : (
          props.manualQueued.map((entry) => (
            <ManualQueueCard
              key={`${entry.platform}-${entry.lead.id}`}
              entry={entry}
              onChanged={props.onChanged}
              onError={props.onError}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <p className={adminLabelClass}>Agent scheduled</p>
        {props.upcoming.length === 0 ? (
          <p className="text-sm text-white/55">No upcoming dispatch batches. Approve leads to queue the next 1pm or 4pm run.</p>
        ) : (
          props.upcoming.map((b) => (
            <BatchCard key={b.id} batch={b} onChanged={props.onChanged} onError={props.onError} />
          ))
        )}
      </section>

      <section className="space-y-3">
        <p className={adminLabelClass}>Completed in the last 24 hours</p>
        {props.recentlyCompleted.length === 0 ? (
          <p className="text-sm text-white/55">No batches completed in the last 24 hours.</p>
        ) : (
          props.recentlyCompleted.map((b) => (
            <BatchCard key={b.id} batch={b} onChanged={props.onChanged} onError={props.onError} />
          ))
        )}
      </section>
    </div>
  );
}
