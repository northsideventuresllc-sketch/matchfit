"use client";

import { useState } from "react";
import { adminPanelClass, adminPrimaryButtonClass } from "@/components/admin/admin-portal-ui";
import type {
  EmailLeadRow,
  FacebookLeadRow,
  InstagramLeadRow,
  OutreachConversionLead,
  OutreachTouchLogEntry,
} from "@/lib/outreach-types";
import { markOutreachLeadConverted } from "./client-api";
import { AccountPickerModal, CollapsibleCard } from "./ui-bits";
import { leadContactUrl, leadDisplayName } from "./helpers";

const STAGE_LABELS: Record<string, string> = {
  initial: "Initial send",
  follow_up_1: "1st follow-up",
  follow_up_2: "2nd follow-up",
  reply: "Reply",
};

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

function sendModeLabel(sendMode: string): string {
  if (sendMode === "manual") return "Manual";
  if (sendMode === "agent") return "Agent";
  return "Unknown";
}

function TouchRow({ touch }: { touch: OutreachTouchLogEntry }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#0E1016]/60 p-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
        <span className="text-[#FFD34E]">{stageLabel(touch.stage)}</span>
        <span className="text-white/40">· {new Date(touch.sentAt).toLocaleString()}</span>
        <span className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-white/70">
          {sendModeLabel(touch.sendMode)}
        </span>
        {touch.reconstructed ? (
          <span className="text-white/35 normal-case tracking-normal">(reconstructed from current lead data)</span>
        ) : null}
      </div>
      {touch.messageFields.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {touch.messageFields.map((f, i) => (
            <p key={i} className="text-xs text-white/70">
              <span className="font-semibold text-white/50">{f.label}: </span>
              {f.text}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ConversionCard({ entry, onChanged }: { entry: OutreachConversionLead; onChanged: () => void }) {
  const lead = entry.lead as InstagramLeadRow | FacebookLeadRow | EmailLeadRow;
  const name = leadDisplayName(entry);
  const contact = leadContactUrl(entry);
  const [showPicker, setShowPicker] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function link(account: { type: "client" | "trainer"; id: string }) {
    setLinking(true);
    setError(null);
    const res = await markOutreachLeadConverted(lead.id, entry.platform, account);
    setLinking(false);
    setShowPicker(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onChanged();
  }

  const header = (
    <>
      <p className="truncate text-base font-black text-white">
        {name}
        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-white/40">{entry.platform}</span>
      </p>
      <p className="mt-0.5 truncate text-xs text-white/50">
        Converted {new Date(entry.convertedAt).toLocaleString()}
      </p>
    </>
  );

  return (
    <>
      <CollapsibleCard header={header}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {contact ? (
              <a href={contact} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#FFD34E] hover:underline">
                {entry.platform === "instagram" ? "Open profile ↗" : entry.platform === "email" ? "Open source ↗" : "Open page ↗"}
              </a>
            ) : entry.platform === "email" ? (
              <span className="text-sm text-white/60">{(lead as EmailLeadRow).email}</span>
            ) : null}

            {entry.matchedAccountType && entry.matchedAccountId ? (
              <a
                href={`/admin/support-tools?type=${entry.matchedAccountType}&id=${entry.matchedAccountId}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-[#FFD34E] hover:underline"
              >
                Open Match Fit account ↗
              </a>
            ) : (
              <button type="button" className={adminPrimaryButtonClass} disabled={linking} onClick={() => setShowPicker(true)}>
                {linking ? "Linking…" : "Link Match Fit account"}
              </button>
            )}
          </div>
          {error ? <p className="text-xs font-semibold text-[#FFB4B4]">{error}</p> : null}

          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/45">Conversation history</p>
            {entry.touches.length === 0 ? (
              <p className="text-xs text-white/45">
                No logged sends for this lead — it converted before send history tracking, and there was no current draft
                text left to reconstruct.
              </p>
            ) : (
              <div className="space-y-2">
                {entry.touches.map((t) => (
                  <TouchRow key={t.id} touch={t} />
                ))}
              </div>
            )}
          </div>
        </div>
      </CollapsibleCard>
      {showPicker ? (
        <AccountPickerModal
          onClose={() => setShowPicker(false)}
          onPick={(account) => void link(account)}
          onSkip={() => setShowPicker(false)}
        />
      ) : null}
    </>
  );
}

export function ConversionsPanel({
  entries,
  onChanged,
}: {
  entries: OutreachConversionLead[];
  onChanged: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className={`${adminPanelClass} space-y-3 p-5`}>
        <p className="text-sm leading-relaxed text-white/60">
          Leads marked Converted from Pending Responses — real Match Fit signups. Every logged send (initial, follow-ups,
          and replies) is here with when it went out and whether it was manual or agent, plus the contact source and, once
          linked, the real Match Fit account.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-white/55">No successful conversions yet.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <ConversionCard key={`${entry.platform}-${entry.lead.id}`} entry={entry} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}
