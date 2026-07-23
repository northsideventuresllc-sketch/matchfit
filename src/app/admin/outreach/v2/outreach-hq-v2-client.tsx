"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import {
  AdminPortalAlert,
  adminAccentButtonClass,
  adminCardClass,
  adminInputClassSm,
  adminLabelClass,
  adminLinkClass,
  adminPanelClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import type { AdminAiProviderStatus } from "@/lib/admin-analytics-ai";
import {
  MATCH_FIT_SIGNATURE_FROM_EMAIL,
  MATCH_FIT_SIGNATURE_LINES,
} from "@/lib/match-fit-signature";
import {
  OUTREACH_COWORK_DAILY_CAPS,
  OUTREACH_COWORK_EMAIL_BCC,
  OUTREACH_COWORK_EMAIL_FROM,
  OUTREACH_INTENT_OPTIONS,
  isOutreachIntent,
  outreachIntentLabel,
  type OutreachIntent,
} from "@/lib/outreach-cowork";
import { formatUserFacingError, readJsonResponse } from "@/lib/read-json-response";
import type {
  EmailLeadRow,
  InstagramLeadRow,
  OutreachHubLead,
} from "@/lib/outreach-types";

type V2Tab = "morning" | "followups" | "pipeline";

type BriefLeadIg = InstagramLeadRow;
type BriefLeadEmail = EmailLeadRow;

type CoworkBrief = {
  generatedAt: string;
  runnerPrompt: string;
  instructions: string;
  missingIntentCount: number;
  caps: typeof OUTREACH_COWORK_DAILY_CAPS;
  emailFrom: string;
  emailBcc: readonly string[];
  readyJoinFpOrBoth: {
    instagram: number;
    email: number;
    total: number;
    target: number;
    meetsTarget: boolean;
  };
  instagram: BriefLeadIg[];
  email: BriefLeadEmail[];
  facebook: unknown[];
};

type QueueState = "pending" | "approved" | "denied";

type PipelineStats = {
  totalInHub: number;
  archived: number;
  activeLeads: { all: number; instagram: number; facebook: number; email: number };
  followUpNeeded: { all: number; instagram: number; facebook: number; email: number };
  responses: { all: number; instagram: number; facebook: number; email: number };
};

function isIgLead(row: unknown): row is BriefLeadIg {
  return Boolean(row && typeof row === "object" && "handle" in row && "dmText" in row);
}

function isEmailLead(row: unknown): row is BriefLeadEmail {
  return Boolean(row && typeof row === "object" && "email" in row && "emailSubject" in row);
}

async function patchLead(
  id: string,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/admin/outreach/leads/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJsonResponse<{ error?: string }>(res);
  if (!res.ok) return { ok: false, error: formatUserFacingError(data.error, "Could not save lead.") };
  return { ok: true };
}

function IntentSelect(props: {
  value: string | null;
  disabled?: boolean;
  onChange: (intent: OutreachIntent | null) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className={adminLabelClass}>Intent (required before send)</span>
      <select
        className={adminInputClassSm}
        value={props.value ?? ""}
        disabled={props.disabled}
        onChange={(e) => {
          const raw = e.target.value;
          props.onChange(raw && isOutreachIntent(raw) ? raw : null);
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
  );
}

function QueueControls(props: {
  state: QueueState;
  busy?: boolean;
  canApprove: boolean;
  onApprove: () => void;
  onDeny: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={props.busy || !props.canApprove}
        className={
          props.state === "approved"
            ? "rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100"
            : adminAccentButtonClass
        }
        onClick={props.onApprove}
        title={props.canApprove ? "Approve for send" : "Set intent before approve"}
      >
        {props.state === "approved" ? "✓ Approved" : "Approve"}
      </button>
      <button
        type="button"
        disabled={props.busy}
        className={
          props.state === "denied"
            ? "rounded-lg border border-[#E32B2B]/50 bg-[#E32B2B]/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4]"
            : adminSecondaryButtonClass
        }
        onClick={props.onDeny}
      >
        {props.state === "denied" ? "✕ Denied" : "Deny"}
      </button>
      {props.state === "pending" ? (
        <span className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/55">
          Pending review
        </span>
      ) : null}
    </div>
  );
}

function EmailClientPreview(props: {
  name: string;
  email: string;
  subject: string;
  body: string;
}) {
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
          <span className="font-semibold text-black/50">BCC:</span>{" "}
          {OUTREACH_COWORK_EMAIL_BCC.join(" · ")}
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

function InstagramLeadCard(props: {
  lead: BriefLeadIg;
  queue: QueueState;
  busy: boolean;
  onQueue: (state: QueueState) => void;
  onSaved: (lead: BriefLeadIg) => void;
  onError: (message: string) => void;
}) {
  const { lead } = props;
  const [dmText, setDmText] = useState(lead.dmText);
  const [commentText, setCommentText] = useState(lead.commentText);
  const [intent, setIntent] = useState<string | null>(lead.outreachIntent);
  const [saving, setSaving] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const persist = async (extra?: Record<string, unknown>) => {
    setSaving(true);
    const result = await patchLead(lead.id, {
      platform: "instagram",
      dmText,
      commentText,
      outreachIntent: intent,
      saveToHub: true,
      ...extra,
    });
    setSaving(false);
    if (!result.ok) {
      props.onError(result.error);
      return false;
    }
    props.onSaved({
      ...lead,
      dmText,
      commentText,
      outreachIntent: intent,
      savedToHubAt: lead.savedToHubAt ?? new Date().toISOString(),
    });
    return true;
  };

  const onApprove = async () => {
    if (!intent || !isOutreachIntent(intent)) {
      props.onError("Set intent before approving an Instagram lead.");
      return;
    }
    const ok = await persist();
    if (ok) props.onQueue("approved");
  };

  const onRegen = async () => {
    setRegenBusy(true);
    try {
      const res = await fetch(`/api/admin/outreach/leads/${lead.id}/generate-copy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "instagram",
          fields: ["dmText", "commentText"],
          feedback: feedback.trim() || undefined,
        }),
      });
      const data = await readJsonResponse<{
        error?: string;
        copy?: { dmText?: string; commentText?: string };
      }>(res);
      if (!res.ok) throw new Error(formatUserFacingError(data.error, "Could not regenerate copy."));
      if (data.copy?.dmText) setDmText(data.copy.dmText);
      if (data.copy?.commentText) setCommentText(data.copy.commentText);
      setFeedback("");
    } catch (e) {
      props.onError(formatUserFacingError(e, "Could not regenerate copy."));
    } finally {
      setRegenBusy(false);
    }
  };

  return (
    <article className={`${adminCardClass} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <a
            href={lead.profileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-lg font-black text-[#FFD34E] hover:underline"
          >
            {lead.handle}
          </a>
          <p className="mt-1 text-sm text-white/55">
            {lead.niche} · score {lead.likelihoodScore}% · {outreachIntentLabel(intent)}
          </p>
          <p className="mt-2 text-sm text-white/70">{lead.whyMatchFit}</p>
        </div>
        <QueueControls
          state={props.queue}
          busy={props.busy || saving}
          canApprove={Boolean(intent && isOutreachIntent(intent))}
          onApprove={() => void onApprove()}
          onDeny={() => props.onQueue("denied")}
        />
      </div>

      <IntentSelect value={intent} disabled={saving} onChange={setIntent} />

      <label className="block space-y-1">
        <span className={adminLabelClass}>First DM</span>
        <textarea
          className={adminInputClassSm}
          rows={5}
          value={dmText}
          onChange={(e) => setDmText(e.target.value)}
        />
      </label>

      <label className="block space-y-1">
        <span className={adminLabelClass}>
          Comment{lead.commentPostRef ? ` · ${lead.commentPostRef}` : ""}
        </span>
        <textarea
          className={adminInputClassSm}
          rows={3}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={adminSecondaryButtonClass}
          disabled={saving}
          onClick={() => void persist()}
        >
          {saving ? "Saving…" : "Save edits"}
        </button>
        <button
          type="button"
          className={adminSecondaryButtonClass}
          disabled={regenBusy}
          onClick={() => void onRegen()}
        >
          {regenBusy ? "Regenerating…" : "Regenerate copy"}
        </button>
        {props.queue === "approved" ? (
          <button
            type="button"
            className={adminAccentButtonClass}
            disabled={saving}
            onClick={() =>
              void (async () => {
                const ok = await persist({ status: "OUTREACH_SENT" });
                if (ok) props.onError("");
              })()
            }
          >
            Mark sent (after Cowork DM)
          </button>
        ) : null}
      </div>

      <label className="block space-y-1">
        <span className={adminLabelClass}>Adjust feedback (optional)</span>
        <input
          className={adminInputClassSm}
          value={feedback}
          placeholder="Shorter opener, lead with founding promo…"
          onChange={(e) => setFeedback(e.target.value)}
        />
      </label>
    </article>
  );
}

function EmailLeadCard(props: {
  lead: BriefLeadEmail;
  queue: QueueState;
  busy: boolean;
  onQueue: (state: QueueState) => void;
  onSaved: (lead: BriefLeadEmail) => void;
  onError: (message: string) => void;
}) {
  const { lead } = props;
  const [subject, setSubject] = useState(lead.emailSubject);
  const [body, setBody] = useState(lead.emailBody);
  const [intent, setIntent] = useState<string | null>(lead.outreachIntent);
  const [scheduleAt, setScheduleAt] = useState("");
  const [openPreview, setOpenPreview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const persist = async (extra?: Record<string, unknown>) => {
    setSaving(true);
    const result = await patchLead(lead.id, {
      platform: "email",
      emailSubject: subject,
      emailBody: body,
      outreachIntent: intent,
      saveToHub: true,
      ...extra,
    });
    setSaving(false);
    if (!result.ok) {
      props.onError(result.error);
      return false;
    }
    props.onSaved({
      ...lead,
      emailSubject: subject,
      emailBody: body,
      outreachIntent: intent,
      savedToHubAt: lead.savedToHubAt ?? new Date().toISOString(),
    });
    return true;
  };

  const onApprove = async () => {
    if (!intent || !isOutreachIntent(intent)) {
      props.onError("Set intent before approving an email lead.");
      return;
    }
    const ok = await persist();
    if (ok) props.onQueue("approved");
  };

  const onRegen = async () => {
    setRegenBusy(true);
    try {
      const res = await fetch(`/api/admin/outreach/leads/${lead.id}/generate-copy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "email",
          fields: ["emailSubject", "emailBody"],
          feedback: feedback.trim() || undefined,
        }),
      });
      const data = await readJsonResponse<{
        error?: string;
        copy?: { emailSubject?: string; emailBody?: string };
      }>(res);
      if (!res.ok) throw new Error(formatUserFacingError(data.error, "Could not regenerate copy."));
      if (data.copy?.emailSubject) setSubject(data.copy.emailSubject);
      if (data.copy?.emailBody) setBody(data.copy.emailBody);
      setFeedback("");
    } catch (e) {
      props.onError(formatUserFacingError(e, "Could not regenerate copy."));
    } finally {
      setRegenBusy(false);
    }
  };

  return (
    <article className={`${adminCardClass} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white">{lead.name}</h3>
          <p className="mt-1 text-sm text-white/55">
            {lead.email}
            {lead.businessName ? ` · ${lead.businessName}` : ""} · score {lead.likelihoodScore}% ·{" "}
            {outreachIntentLabel(intent)}
          </p>
          <p className="mt-2 text-sm text-white/70">{lead.whyMatchFit}</p>
          {lead.emailSourceUrl ? (
            <a
              href={lead.emailSourceUrl}
              target="_blank"
              rel="noreferrer"
              className={`${adminLinkClass} mt-1 inline-block text-sm`}
            >
              Source
            </a>
          ) : null}
        </div>
        <QueueControls
          state={props.queue}
          busy={props.busy || saving}
          canApprove={Boolean(intent && isOutreachIntent(intent))}
          onApprove={() => void onApprove()}
          onDeny={() => props.onQueue("denied")}
        />
      </div>

      <IntentSelect value={intent} disabled={saving} onChange={setIntent} />

      <label className="block space-y-1">
        <span className={adminLabelClass}>Subject</span>
        <input className={adminInputClassSm} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>

      <label className="block space-y-1">
        <span className={adminLabelClass}>Body</span>
        <textarea
          className={adminInputClassSm}
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>

      <label className="block space-y-1">
        <span className={adminLabelClass}>Schedule send (local — Outlook path ships with fire)</span>
        <input
          type="datetime-local"
          className={adminInputClassSm}
          value={scheduleAt}
          onChange={(e) => setScheduleAt(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={adminSecondaryButtonClass}
          disabled={saving}
          onClick={() => void persist()}
        >
          {saving ? "Saving…" : "Save edits"}
        </button>
        <button
          type="button"
          className={adminSecondaryButtonClass}
          disabled={regenBusy}
          onClick={() => void onRegen()}
        >
          {regenBusy ? "Regenerating…" : "Regenerate copy"}
        </button>
        <button
          type="button"
          className={adminSecondaryButtonClass}
          onClick={() => setOpenPreview((v) => !v)}
        >
          {openPreview ? "Hide preview" : "Show email preview"}
        </button>
        {props.queue === "approved" ? (
          <button
            type="button"
            className={adminAccentButtonClass}
            disabled={saving}
            onClick={() =>
              void (async () => {
                const ok = await persist({ status: "OUTREACH_SENT" });
                if (ok) props.onError("");
              })()
            }
          >
            Mark sent
          </button>
        ) : null}
      </div>

      {openPreview ? (
        <EmailClientPreview name={lead.name} email={lead.email} subject={subject} body={body} />
      ) : null}

      <label className="block space-y-1">
        <span className={adminLabelClass}>Adjust feedback (optional)</span>
        <input
          className={adminInputClassSm}
          value={feedback}
          placeholder="More founding promo, less formal…"
          onChange={(e) => setFeedback(e.target.value)}
        />
      </label>
    </article>
  );
}

function MorningPackPanel(props: {
  brief: CoworkBrief | null;
  loading: boolean;
  queue: Record<string, QueueState>;
  setQueue: (id: string, state: QueueState) => void;
  onIgSaved: (lead: BriefLeadIg) => void;
  onEmailSaved: (lead: BriefLeadEmail) => void;
  onError: (message: string) => void;
  onReload: () => void;
}) {
  const brief = props.brief;
  const approvedCount = useMemo(
    () => Object.values(props.queue).filter((s) => s === "approved").length,
    [props.queue],
  );

  if (props.loading && !brief) {
    return <p className="text-sm text-white/55">Loading morning pack…</p>;
  }

  if (!brief) {
    return (
      <div className={`${adminPanelClass} space-y-3 p-5`}>
        <p className="text-sm text-white/55">Could not load the morning pack yet.</p>
        <button type="button" className={adminAccentButtonClass} onClick={props.onReload}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={`${adminPanelClass} space-y-3 p-5`}>
        <p className={adminLabelClass}>Workflow 2 · Morning pack</p>
        <p className="text-sm text-white/70">
          Caps {brief.caps.instagram} Instagram + {brief.caps.email} email · From{" "}
          <span className="text-white/90">{brief.emailFrom || OUTREACH_COWORK_EMAIL_FROM}</span> · BCC{" "}
          {(brief.emailBcc?.length ? brief.emailBcc : OUTREACH_COWORK_EMAIL_BCC).join(" · ")} · Generated{" "}
          {new Date(brief.generatedAt).toLocaleString()}
        </p>
        <p className="text-sm text-white/55">
          Queue ready: {brief.instagram.length} IG · {brief.email.length} email · Approved in session:{" "}
          {approvedCount} ·{" "}
          {brief.missingIntentCount > 0
            ? `${brief.missingIntentCount} missing intent`
            : "All packed leads have intent"}
        </p>
        <p className="text-sm text-white/55">
          Ready Join-as-Fitness-Pro / Both floor: {brief.readyJoinFpOrBoth.total}/
          {brief.readyJoinFpOrBoth.target}
          {brief.readyJoinFpOrBoth.meetsTarget ? " ✓" : " (agents refill to floor)"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={adminSecondaryButtonClass} onClick={props.onReload}>
            Refresh pack
          </button>
          <button
            type="button"
            className={adminSecondaryButtonClass}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(brief.runnerPrompt);
              } catch {
                props.onError("Could not copy Cowork runner prompt.");
              }
            }}
          >
            Copy Cowork runner prompt
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">
          Instagram · {brief.instagram.length} leads
        </h2>
        {brief.instagram.length === 0 ? (
          <p className="text-sm text-white/55">No Instagram leads in today&apos;s pack.</p>
        ) : (
          brief.instagram.map((lead) => (
            <InstagramLeadCard
              key={`${lead.id}-${brief.generatedAt}`}
              lead={lead}
              queue={props.queue[lead.id] ?? "pending"}
              busy={false}
              onQueue={(state) => props.setQueue(lead.id, state)}
              onSaved={props.onIgSaved}
              onError={props.onError}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">
          Email · {brief.email.length} leads
        </h2>
        {brief.email.length === 0 ? (
          <p className="text-sm text-white/55">No email leads in today&apos;s pack.</p>
        ) : (
          brief.email.map((lead) => (
            <EmailLeadCard
              key={`${lead.id}-${brief.generatedAt}`}
              lead={lead}
              queue={props.queue[lead.id] ?? "pending"}
              busy={false}
              onQueue={(state) => props.setQueue(lead.id, state)}
              onSaved={props.onEmailSaved}
              onError={props.onError}
            />
          ))
        )}
      </section>
    </div>
  );
}

function FollowUpsPanel(props: { entries: OutreachHubLead[]; loading: boolean }) {
  const followUps = props.entries.filter((e) => {
    if (e.platform === "facebook") return false;
    const status = e.lead.status;
    return (
      e.lead.autoClassification === "FOLLOW_UP_NEEDED" ||
      status === "OUTREACH_SENT" ||
      status === "FOLLOW_UP_1"
    );
  });

  if (props.loading) return <p className="text-sm text-white/55">Loading follow-ups…</p>;

  return (
    <div className="space-y-4">
      <div className={`${adminPanelClass} p-5`}>
        <p className={adminLabelClass}>Workflow 2 · Follow-ups</p>
        <p className="mt-2 text-sm text-white/55">
          Due and in-flight follow-ups from Outreach Hub. Edit/send from the morning pack or live HQ until
          full schedule automation fires.
        </p>
      </div>
      {followUps.length === 0 ? (
        <p className="text-sm text-white/55">No follow-up leads in Hub right now.</p>
      ) : (
        <ul className="space-y-3">
          {followUps.map((entry) => {
            const lead = entry.lead;
            const title =
              entry.platform === "instagram"
                ? (lead as InstagramLeadRow).handle
                : entry.platform === "email"
                  ? (lead as EmailLeadRow).name
                  : "Lead";
            return (
              <li key={`${entry.platform}-${lead.id}`} className={`${adminCardClass} space-y-2`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-white">
                    {title}{" "}
                    <span className="text-xs font-bold uppercase tracking-wide text-white/40">
                      {entry.platform}
                    </span>
                  </p>
                  <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-100">
                    {lead.status}
                  </span>
                </div>
                <p className="text-sm text-white/55">{lead.whyMatchFit}</p>
                <p className="text-xs text-white/40">
                  Intent {outreachIntentLabel(lead.outreachIntent)} · saved{" "}
                  {new Date(entry.savedToHubAt).toLocaleString()}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PipelinePanel(props: {
  brief: CoworkBrief | null;
  stats: PipelineStats | null;
  entries: OutreachHubLead[];
  loading: boolean;
}) {
  const ready = props.entries.filter((e) => {
    if (e.lead.status !== "LEAD") return false;
    const intent = e.lead.outreachIntent;
    if (intent !== "JOIN_AS_FP" && intent !== "BOTH") return false;
    if (e.platform === "instagram") return Boolean((e.lead as InstagramLeadRow).dmText?.trim());
    if (e.platform === "email") {
      const em = e.lead as EmailLeadRow;
      return Boolean(em.emailSubject?.trim() && em.emailBody?.trim());
    }
    return false;
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${adminPanelClass} p-4`}>
          <p className={adminLabelClass}>In Hub</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-[#FFD34E]">
            {props.stats?.totalInHub ?? "—"}
          </p>
        </div>
        <div className={`${adminPanelClass} p-4`}>
          <p className={adminLabelClass}>Active</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-white">
            {props.stats?.activeLeads.all ?? "—"}
          </p>
        </div>
        <div className={`${adminPanelClass} p-4`}>
          <p className={adminLabelClass}>Follow-up needed</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-amber-200">
            {props.stats?.followUpNeeded.all ?? "—"}
          </p>
        </div>
        <div className={`${adminPanelClass} p-4`}>
          <p className={adminLabelClass}>Ready Join-as-Fitness-Pro / Both</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-emerald-200">
            {props.brief?.readyJoinFpOrBoth.total ?? ready.length}
            <span className="text-sm font-bold text-white/40">
              /{props.brief?.readyJoinFpOrBoth.target ?? 15}
            </span>
          </p>
        </div>
      </div>

      <div className={`${adminPanelClass} space-y-2 p-5`}>
        <p className={adminLabelClass}>Automation</p>
        <p className="text-sm text-white/55">
          Workflow 2 Automation On/Off stays synced with AXON Match Fit Outreach when the fire job ships.
          Live send remains JB-only (IG via Cowork Chrome path · email From{" "}
          {OUTREACH_COWORK_EMAIL_FROM}).
        </p>
        <p className="text-sm text-white/40">
          Daily caps locked: {OUTREACH_COWORK_DAILY_CAPS.instagram} IG · {OUTREACH_COWORK_DAILY_CAPS.email}{" "}
          email.
        </p>
      </div>

      {props.loading ? (
        <p className="text-sm text-white/55">Loading pipeline…</p>
      ) : (
        <ul className="space-y-2">
          {ready.slice(0, 20).map((entry) => {
            const lead = entry.lead;
            const title =
              entry.platform === "instagram"
                ? (lead as InstagramLeadRow).handle
                : (lead as EmailLeadRow).name;
            return (
              <li
                key={`${entry.platform}-${lead.id}`}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm"
              >
                <span className="font-bold text-white">{title}</span>
                <span className="text-white/40"> · {entry.platform} · </span>
                <span className="text-white/55">{outreachIntentLabel(lead.outreachIntent)}</span>
              </li>
            );
          })}
          {ready.length === 0 ? (
            <p className="text-sm text-white/55">No ready Join-as-Fitness-Pro / Both leads in Hub.</p>
          ) : null}
        </ul>
      )}
    </div>
  );
}

export function OutreachHqV2Client(props: { aiStatus: AdminAiProviderStatus }) {
  const [tab, setTab] = useState<V2Tab>("morning");
  const [brief, setBrief] = useState<CoworkBrief | null>(null);
  const [hubEntries, setHubEntries] = useState<OutreachHubLead[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [queue, setQueueState] = useState<Record<string, QueueState>>({});
  const [briefLoading, setBriefLoading] = useState(false);
  const [hubLoading, setHubLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBrief = useCallback(async () => {
    setBriefLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/outreach/cowork-brief", { credentials: "include" });
      const data = await readJsonResponse<Partial<CoworkBrief> & { error?: string }>(res);
      if (!res.ok) throw new Error(formatUserFacingError(data.error, "Could not load morning pack."));
      setBrief({
        generatedAt: data.generatedAt ?? new Date().toISOString(),
        runnerPrompt: data.runnerPrompt ?? "",
        instructions: data.instructions ?? "",
        missingIntentCount: data.missingIntentCount ?? 0,
        caps: data.caps ?? OUTREACH_COWORK_DAILY_CAPS,
        emailFrom: data.emailFrom ?? OUTREACH_COWORK_EMAIL_FROM,
        emailBcc: data.emailBcc ?? OUTREACH_COWORK_EMAIL_BCC,
        readyJoinFpOrBoth: data.readyJoinFpOrBoth ?? {
          instagram: 0,
          email: 0,
          total: 0,
          target: 15,
          meetsTarget: false,
        },
        instagram: (data.instagram ?? []).filter(isIgLead),
        email: (data.email ?? []).filter(isEmailLead),
        facebook: data.facebook ?? [],
      });
    } catch (e) {
      setError(formatUserFacingError(e, "Could not load morning pack."));
    } finally {
      setBriefLoading(false);
    }
  }, []);

  const loadHub = useCallback(async () => {
    setHubLoading(true);
    try {
      const [hubRes, statsRes] = await Promise.all([
        fetch("/api/admin/outreach/hub", { credentials: "include" }),
        fetch("/api/admin/outreach/stats", { credentials: "include" }),
      ]);
      const hubData = await readJsonResponse<{ leads?: OutreachHubLead[]; error?: string }>(hubRes);
      const statsData = await readJsonResponse<{ stats?: PipelineStats; error?: string }>(statsRes);
      if (hubRes.ok) setHubEntries(hubData.leads ?? []);
      if (statsRes.ok && statsData.stats) setStats(statsData.stats);
    } catch {
      /* soft-fail — morning pack is primary */
    } finally {
      setHubLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadBrief();
      void loadHub();
    });
  }, [loadBrief, loadHub]);

  const setQueue = (id: string, state: QueueState) => {
    setQueueState((prev) => ({
      ...prev,
      [id]: prev[id] === state ? "pending" : state,
    }));
  };

  const tabs: { id: V2Tab; label: string }[] = [
    { id: "morning", label: "Morning Pack" },
    { id: "followups", label: "Follow-ups" },
    { id: "pipeline", label: "Pipeline" },
  ];

  return (
    <AdminPortalShell
      current="outreach"
      maxWidth="full"
      title="Outreach HQ v2"
      description={
        <>
          Workflow 2 finished product — morning Instagram + email pack, follow-ups, and pipeline. Live{" "}
          <Link href="/admin/outreach" className={adminLinkClass}>
            Outreach HQ
          </Link>{" "}
          stays until cutover. Approve requires intent; JB still owns live send.
        </>
      }
      headerActions={
        <>
          <Link href="/admin/outreach" className={adminSecondaryButtonClass}>
            Live Outreach HQ
          </Link>
          <Link href="/admin" className={adminSecondaryButtonClass}>
            Dashboard
          </Link>
        </>
      }
    >
      {!props.aiStatus.configured ? (
        <AdminPortalAlert variant="info">{props.aiStatus.message}</AdminPortalAlert>
      ) : null}
      {error ? <AdminPortalAlert variant="error">{error}</AdminPortalAlert> : null}

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-white/[0.06] pb-1" aria-label="Outreach HQ v2 tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={
              tab === t.id
                ? "rounded-lg border border-[#FF7E00]/40 bg-[#FF7E00]/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#FFD34E]"
                : adminSecondaryButtonClass
            }
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "morning" ? (
        <MorningPackPanel
          brief={brief}
          loading={briefLoading}
          queue={queue}
          setQueue={setQueue}
          onIgSaved={(lead) =>
            setBrief((prev) =>
              prev
                ? {
                    ...prev,
                    instagram: prev.instagram.map((row) => (row.id === lead.id ? lead : row)),
                  }
                : prev,
            )
          }
          onEmailSaved={(lead) =>
            setBrief((prev) =>
              prev
                ? {
                    ...prev,
                    email: prev.email.map((row) => (row.id === lead.id ? lead : row)),
                  }
                : prev,
            )
          }
          onError={(message) => setError(message || null)}
          onReload={() => void loadBrief()}
        />
      ) : null}

      {tab === "followups" ? <FollowUpsPanel entries={hubEntries} loading={hubLoading} /> : null}

      {tab === "pipeline" ? (
        <PipelinePanel brief={brief} stats={stats} entries={hubEntries} loading={hubLoading} />
      ) : null}
    </AdminPortalShell>
  );
}
