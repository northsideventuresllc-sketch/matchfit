"use client";

import { useState } from "react";
import { adminLabelClass, adminPanelClass, adminSecondaryButtonClass } from "@/components/admin/admin-portal-ui";
import type { OutreachCoworkDispatchBatchRow } from "@/lib/outreach-types";
import { dispatchBriefLeads, formatDispatchSlot } from "./helpers";
import { pullDispatch } from "./client-api";

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
          {leads.map((l) => (
            <li
              key={`${l.platform}-${l.leadId}`}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/70 px-3 py-2 text-sm"
            >
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
            </li>
          ))}
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

export function DispatchPanel(props: {
  upcoming: OutreachCoworkDispatchBatchRow[];
  recentlyCompleted: OutreachCoworkDispatchBatchRow[];
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className={adminLabelClass}>Upcoming batches</p>
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
