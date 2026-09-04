"use client";

import { useState } from "react";
import {
  MATCH_FIT_SIGNATURE_FROM_EMAIL,
  MATCH_FIT_SIGNATURE_LINES,
} from "@/lib/match-fit-signature";
import { OUTREACH_COWORK_EMAIL_BCC } from "@/lib/outreach-cowork";
import { adminSecondaryButtonClass } from "@/components/admin/admin-portal-ui";
import type { OutreachPlatform } from "@/lib/outreach-types";
import { CopyButton, RegenerateModal } from "./ui-bits";

export type LeadStage = "primary" | "follow_up_1" | "follow_up_2";

export type FieldDesc = { key: string; label: string; rows: number };

/**
 * Editable copy fields per platform + stage. Instagram is DM-only now (WF2 item 3.4 removed the
 * comment step). Email is Subject + Body.
 */
export function fieldDescriptors(platform: OutreachPlatform, stage: LeadStage): FieldDesc[] {
  if (platform === "instagram") {
    if (stage === "follow_up_1") return [{ key: "followUp1DmText", label: "First follow-up DM", rows: 5 }];
    if (stage === "follow_up_2") return [{ key: "followUp2DmText", label: "Second follow-up DM", rows: 5 }];
    return [{ key: "dmText", label: "DM", rows: 5 }];
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

export function seedFields(lead: Record<string, unknown>, descs: FieldDesc[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of descs) out[d.key] = typeof lead[d.key] === "string" ? (lead[d.key] as string) : "";
  return out;
}

/** The subject / body field keys for the given email stage. */
export function emailFieldKeys(stage: LeadStage): { subjectKey: string; bodyKey: string } {
  if (stage === "follow_up_1") return { subjectKey: "followUp1EmailSubject", bodyKey: "followUp1EmailBody" };
  if (stage === "follow_up_2") return { subjectKey: "followUp2EmailSubject", bodyKey: "followUp2EmailBody" };
  return { subjectKey: "emailSubject", bodyKey: "emailBody" };
}

export function instagramFieldKey(stage: LeadStage): string {
  if (stage === "follow_up_1") return "followUp1DmText";
  if (stage === "follow_up_2") return "followUp2DmText";
  return "dmText";
}

export function EmailClientPreview(props: { name: string; email: string; subject: string; body: string }) {
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

/** Result shape the card's regenerate handler returns so buttons can surface a failure. */
export type RegenResult = { ok: boolean; error?: string };

/**
 * The per-field Regenerate buttons for the card's platform + stage, each opening a feedback popup
 * that loops (WF2 item 3): email -> Regenerate Subject / Body / All; Instagram -> Regenerate DM.
 * `onRegenerate(fieldKeys, feedback)` does the actual call and merges the result into the card.
 */
export function RegenerateButtons(props: {
  platform: OutreachPlatform;
  stage: LeadStage;
  onRegenerate: (fieldKeys: string[], feedback: string) => Promise<RegenResult>;
}) {
  const [open, setOpen] = useState<null | { title: string; keys: string[] }>(null);

  const buttons: { title: string; label: string; keys: string[] }[] = [];
  if (props.platform === "email") {
    const { subjectKey, bodyKey } = emailFieldKeys(props.stage);
    buttons.push(
      { title: "Regenerate subject", label: "Regenerate Subject", keys: [subjectKey] },
      { title: "Regenerate body", label: "Regenerate Body", keys: [bodyKey] },
      { title: "Regenerate all", label: "Regenerate All", keys: [subjectKey, bodyKey] },
    );
  } else if (props.platform === "instagram") {
    buttons.push({ title: "Regenerate DM", label: "Regenerate DM", keys: [instagramFieldKey(props.stage)] });
  } else {
    buttons.push({ title: "Regenerate post", label: "Regenerate Post", keys: ["pagePostText"] });
  }

  return (
    <>
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          className={adminSecondaryButtonClass}
          onClick={() => setOpen({ title: b.title, keys: b.keys })}
        >
          {b.label}
        </button>
      ))}
      {open ? (
        <RegenerateModal
          title={open.title}
          onClose={() => setOpen(null)}
          onRegenerate={(feedback) => props.onRegenerate(open.keys, feedback)}
        />
      ) : null}
    </>
  );
}

/** Per-field Copy buttons: email -> Copy Subject / Copy Body; Instagram -> Copy DM (WF2 item 3). */
export function CopyFieldButtons(props: {
  platform: OutreachPlatform;
  stage: LeadStage;
  fields: Record<string, string>;
}) {
  if (props.platform === "email") {
    const { subjectKey, bodyKey } = emailFieldKeys(props.stage);
    return (
      <>
        <CopyButton value={props.fields[subjectKey] ?? ""} label="Copy Subject" />
        <CopyButton value={props.fields[bodyKey] ?? ""} label="Copy Body" />
      </>
    );
  }
  if (props.platform === "instagram") {
    return <CopyButton value={props.fields[instagramFieldKey(props.stage)] ?? ""} label="Copy DM" />;
  }
  return <CopyButton value={props.fields.pagePostText ?? ""} label="Copy Post" />;
}
