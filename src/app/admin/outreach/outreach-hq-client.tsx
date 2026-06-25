"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPortalNav } from "@/components/admin/admin-portal-nav";
import {
  AdminPortalAlert,
  AdminPortalBackdrop,
  AdminPortalBetaNotice,
  adminAccentButtonClass,
  adminCardClass,
  adminInputClass,
  adminInputClassSm,
  adminLabelClass,
  adminLinkClass,
  adminPanelClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import {
  classifyOutreachLead,
  facebookStatusTimestampsForUpdate,
  statusTimestampsForUpdate,
  classificationBadgeClass,
} from "@/lib/outreach-classification";
import type {
  EmailLeadRow,
  FacebookLeadRow,
  InstagramLeadRow,
  OutreachArchiveLead,
  OutreachCopyField,
  OutreachHubLead,
  OutreachPlatform,
} from "@/lib/outreach-types";
import {
  DEFAULT_OUTREACH_HUB_FILTERS,
  filterOutreachHubLeads,
  HUB_CLASSIFICATION_FILTER_OPTIONS,
  HUB_PLATFORM_FILTER_OPTIONS,
  HUB_TARGET_GROUP_FILTER_OPTIONS,
  hubStatusFilterOptions,
  outreachHubFiltersActive,
  type OutreachHubFilterState,
} from "@/lib/outreach-hub-filters";
import {
  EMAIL_COPY_FIELDS,
  FACEBOOK_COPY_FIELDS,
  INSTAGRAM_COPY_FIELDS,
  OUTREACH_ARCHIVE_RETENTION_DAYS,
  OUTREACH_CLASSIFICATION_LABELS,
  OUTREACH_DEAD_LEAD_ARCHIVE_HOURS,
  OUTREACH_PLATFORMS,
  outreachStatusOptionsForPlatform,
  statusLabelForPlatform,
  targetGroupLabel,
} from "@/lib/outreach-types";
import type { AdminAiProviderStatus } from "@/lib/admin-analytics-ai";
import { formatUserFacingError, readJsonResponse } from "@/lib/read-json-response";
import {
  OUTREACH_PLATFORM_UI,
  stageLabelForOutreachGenerate,
} from "@/lib/outreach-platform-ui";
import {
  computeOutreachHubStats,
  isOutreachHubMetricNotApplicable,
  OUTREACH_HUB_STAT_PLATFORM_BUTTONS,
  resolveOutreachHubMetricCount,
  type OutreachHubMetricCounts,
  type OutreachHubStats,
  type OutreachHubStatsPlatformFilter,
} from "@/lib/outreach-hub-stats";

type AnyLead = InstagramLeadRow | FacebookLeadRow | EmailLeadRow;
type OutreachView = OutreachPlatform | "hub" | "archive";

const EMPTY_HUB_STATS: OutreachHubStats = {
  totalInHub: 0,
  archived: 0,
  activeLeads: { all: 0, instagram: 0, facebook: 0, email: 0 },
  followUpNeeded: { all: 0, instagram: 0, facebook: 0, email: 0 },
  responses: { all: 0, instagram: 0, facebook: 0, email: 0 },
};

type DeleteReasonPromptState = {
  title: string;
  description: string;
  onConfirm: (reason: string) => Promise<void>;
};

function leadEntryKey(platform: string, id: string) {
  return `${platform}:${id}`;
}

function parseLeadDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function applyLeadPatch(
  lead: AnyLead,
  platform: OutreachPlatform,
  patch: Record<string, unknown>,
): AnyLead {
  const next = { ...lead, ...patch } as AnyLead;
  if (typeof patch.status !== "string") return next;

  const now = new Date();
  if (platform === "facebook") {
    const stamps = facebookStatusTimestampsForUpdate(
      patch.status,
      {
        outreachSentAt: parseLeadDate(lead.outreachSentAt),
        responseReceivedAt: parseLeadDate(lead.responseReceivedAt),
      },
      now,
    );
    next.outreachSentAt = stamps.outreachSentAt?.toISOString() ?? lead.outreachSentAt;
    next.responseReceivedAt = stamps.responseReceivedAt?.toISOString() ?? lead.responseReceivedAt;
  } else {
    const timelineLead = lead as InstagramLeadRow | EmailLeadRow;
    const stamps = statusTimestampsForUpdate(
      patch.status,
      {
        outreachSentAt: parseLeadDate(lead.outreachSentAt),
        followUp1SentAt: parseLeadDate(timelineLead.followUp1SentAt),
        followUp2SentAt: parseLeadDate(timelineLead.followUp2SentAt),
        responseReceivedAt: parseLeadDate(lead.responseReceivedAt),
      },
      now,
      lead.status,
    );
    next.outreachSentAt = stamps.outreachSentAt?.toISOString() ?? lead.outreachSentAt;
    (next as InstagramLeadRow | EmailLeadRow).followUp1SentAt =
      stamps.followUp1SentAt?.toISOString() ?? timelineLead.followUp1SentAt;
    (next as InstagramLeadRow | EmailLeadRow).followUp2SentAt =
      stamps.followUp2SentAt?.toISOString() ?? timelineLead.followUp2SentAt;
    next.responseReceivedAt = stamps.responseReceivedAt?.toISOString() ?? lead.responseReceivedAt;
  }

  if (patch.status === "DEAD_LEAD" && !lead.deadLeadAt) {
    next.deadLeadAt = now.toISOString();
  } else if (patch.status !== "DEAD_LEAD") {
    next.deadLeadAt = null;
  }

  next.autoClassification = classifyOutreachLead({
    status: patch.status,
    platform,
    outreachSentAt: parseLeadDate(next.outreachSentAt),
    followUp1SentAt:
      platform === "facebook"
        ? null
        : parseLeadDate((next as InstagramLeadRow | EmailLeadRow).followUp1SentAt),
    followUp2SentAt:
      platform === "facebook"
        ? null
        : parseLeadDate((next as InstagramLeadRow | EmailLeadRow).followUp2SentAt),
    responseReceivedAt: parseLeadDate(next.responseReceivedAt),
    createdAt: new Date(lead.createdAt),
  });

  return next;
}

function normalizeLeadFromApi(lead: AnyLead): AnyLead {
  const dateFields = [
    "createdAt",
    "deletedAt",
    "savedToHubAt",
    "deadLeadAt",
    "archivedAt",
    "archivePurgeAfterAt",
    "outreachSentAt",
    "followUp1SentAt",
    "followUp2SentAt",
    "responseReceivedAt",
  ] as const;

  const normalized = { ...lead } as Record<string, unknown>;
  for (const field of dateFields) {
    const value = normalized[field];
    if (value instanceof Date) {
      normalized[field] = value.toISOString();
    }
  }
  return normalized as AnyLead;
}

function LeadCollapseToggle(props: {
  expanded: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-[#0E1016]/80 text-white/70 transition hover:border-[#FF7E00]/30 hover:text-[#FFD34E]"
      onClick={props.onToggle}
      aria-expanded={props.expanded}
      aria-label={props.expanded ? `Collapse ${props.label}` : `Expand ${props.label}`}
    >
      <span className={`inline-block text-sm transition-transform ${props.expanded ? "rotate-90" : ""}`}>▸</span>
    </button>
  );
}

function OutreachHubMetricStatCard(props: {
  label: string;
  metric: "activeLeads" | "followUpNeeded" | "responses";
  counts: OutreachHubMetricCounts;
  platformFilter: OutreachHubStatsPlatformFilter;
  onPlatformFilter: (platform: OutreachHubStatsPlatformFilter) => void;
  valueClassName?: string;
}) {
  const notApplicable = isOutreachHubMetricNotApplicable(props.metric, props.platformFilter);
  const value = notApplicable ? null : resolveOutreachHubMetricCount(props.counts, props.platformFilter);

  return (
    <div className={`${adminPanelClass} p-4`}>
      <p className={adminLabelClass}>{props.label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${props.valueClassName ?? ""}`}>
        {notApplicable ? "N/A" : value}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {OUTREACH_HUB_STAT_PLATFORM_BUTTONS.map((button) => (
          <button
            key={button.id}
            type="button"
            className={
              props.platformFilter === button.id
                ? "rounded-md border border-[#FF7E00]/40 bg-[#FF7E00]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#FFD34E]"
                : "rounded-md border border-white/[0.08] bg-[#0E1016]/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/55 hover:border-white/15 hover:text-white/80"
            }
            onClick={() => props.onPlatformFilter(button.id)}
          >
            {button.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type OutreachBatchGroup = {
  batchId: string | null;
  label: string;
  leads: AnyLead[];
};

function formatOutreachBatchLabel(batchId: string | null, leads: AnyLead[]): string {
  if (!batchId) return `Manual / unknown batch (${leads.length})`;
  const match = /^batch_(\d+)_/.exec(batchId);
  if (match) {
    const date = new Date(Number(match[1]));
    if (!Number.isNaN(date.getTime())) {
      return `${date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })} · ${leads.length} lead${leads.length === 1 ? "" : "s"}`;
    }
  }
  return `${batchId} · ${leads.length} lead${leads.length === 1 ? "" : "s"}`;
}

function OutreachGenerateProgressBar(props: { percent: number; stage: string; footnote: string }) {
  return (
    <div
      className="space-y-2 rounded-xl border border-[#FF7E00]/25 bg-[#FF7E00]/[0.06] p-4"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={props.percent}
      aria-label="Lead generation progress"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#FFD34E]">{props.stage}</p>
        <p className="text-sm font-black tabular-nums text-white/85">{props.percent}%</p>
      </div>
      <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-[#0E1016]/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#FF7E00] via-[#FF9A2E] to-[#FFD34E] transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, props.percent))}%` }}
        />
      </div>
      <p className="text-[11px] text-white/45">{props.footnote}</p>
    </div>
  );
}

function groupLeadsByBatch(leads: AnyLead[]): OutreachBatchGroup[] {
  const active = leads.filter((l) => !l.deletedAt);
  const map = new Map<string, AnyLead[]>();

  for (const lead of active) {
    const key = lead.generationBatchId ?? "__none__";
    const group = map.get(key) ?? [];
    group.push(lead);
    map.set(key, group);
  }

  return Array.from(map.entries())
    .map(([key, batchLeads]) => {
      const batchId = key === "__none__" ? null : key;
      return {
        batchId,
        label: formatOutreachBatchLabel(batchId, batchLeads),
        leads: batchLeads.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      };
    })
    .sort((a, b) => new Date(b.leads[0]?.createdAt ?? 0).getTime() - new Date(a.leads[0]?.createdAt ?? 0).getTime());
}

function DeleteReasonModal(props: {
  open: boolean;
  title: string;
  description: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (props.open) queueMicrotask(() => setReason(""));
  }, [props.open]);

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className={`${adminCardClass} w-full max-w-lg space-y-4 p-5`} role="dialog" aria-modal="true">
        <div>
          <h2 className="text-lg font-black text-white">{props.title}</h2>
          <p className="mt-2 text-sm text-white/55">{props.description}</p>
        </div>
        <div>
          <label className={adminLabelClass} htmlFor="outreach-delete-reason">
            Why is this lead being deleted?
          </label>
          <textarea
            id="outreach-delete-reason"
            className={`${adminInputClassSm} mt-2`}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Not a fitness professional, wrong audience, duplicate profile…"
          />
          <p className="mt-2 text-xs text-white/40">
            This reason is saved to NI Brain so the AI learns what to avoid in future lead generation.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={adminSecondaryButtonClass} disabled={props.submitting} onClick={props.onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4] hover:bg-[#E32B2B]/20 disabled:opacity-40"
            disabled={props.submitting || reason.trim().length < 3}
            onClick={() => props.onConfirm(reason.trim())}
          >
            {props.submitting ? "Deleting…" : "Delete lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RegenerateFeedbackModal(props: {
  open: boolean;
  title: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (feedback: string) => void;
}) {
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (props.open) queueMicrotask(() => setFeedback(""));
  }, [props.open]);

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className={`${adminCardClass} w-full max-w-lg space-y-4 p-5`} role="dialog" aria-modal="true">
        <div>
          <h2 className="text-lg font-black text-white">{props.title}</h2>
          <p className="mt-2 text-sm text-white/55">
            Optional: tell the AI what to change. Feedback is saved to NI Brain for future generations.
          </p>
        </div>
        <div>
          <label className={adminLabelClass} htmlFor="outreach-regenerate-feedback">
            Regeneration feedback (optional)
          </label>
          <textarea
            id="outreach-regenerate-feedback"
            className={`${adminInputClassSm} mt-2`}
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Shorter opener, less emoji, mention virtual clients…"
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={adminSecondaryButtonClass} disabled={props.submitting} onClick={props.onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={adminAccentButtonClass}
            disabled={props.submitting}
            onClick={() => props.onConfirm(feedback.trim())}
          >
            {props.submitting ? "Regenerating…" : "Regenerate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/60 hover:border-[#FF7E00]/30 hover:text-[#FFD34E]"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CopyFieldBlock(props: {
  label: string;
  field: OutreachCopyField;
  value: string;
  rows?: number;
  generating: boolean;
  onSave: (v: string) => Promise<void>;
  onGenerate: (feedback?: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(props.value);
  const [saving, setSaving] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [localGenerating, setLocalGenerating] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setDraft(props.value));
  }, [props.value]);

  const hasText = draft.trim().length > 0;
  const busy = props.generating || localGenerating;

  const runGenerate = async (feedback?: string) => {
    setLocalGenerating(true);
    try {
      await props.onGenerate(feedback);
    } finally {
      setLocalGenerating(false);
      setRegenerateOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className={adminLabelClass}>{props.label}</p>
        <CopyButton text={draft} />
      </div>
      <textarea
        className={adminInputClassSm}
        rows={props.rows ?? 4}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {!hasText ? (
          <button
            type="button"
            disabled={busy}
            className={adminAccentButtonClass}
            onClick={() => void runGenerate()}
          >
            {busy ? "Generating…" : "Generate"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            className={adminSecondaryButtonClass}
            onClick={() => setRegenerateOpen(true)}
          >
            {busy ? "Regenerating…" : "Re-generate"}
          </button>
        )}
        {draft !== props.value ? (
          <button
            type="button"
            disabled={saving}
            className={adminAccentButtonClass}
            onClick={() => {
              setSaving(true);
              void props.onSave(draft).finally(() => setSaving(false));
            }}
          >
            {saving ? "Saving…" : "Save edit"}
          </button>
        ) : null}
      </div>
      <RegenerateFeedbackModal
        open={regenerateOpen}
        title={`Re-generate ${props.label}`}
        submitting={busy}
        onCancel={() => {
          if (!busy) setRegenerateOpen(false);
        }}
        onConfirm={(feedback) => {
          void runGenerate(feedback || undefined);
        }}
      />
    </div>
  );
}

function GenerationLeadCard(props: {
  lead: AnyLead;
  platform: OutreachPlatform;
  selected: boolean;
  onToggleSelect: () => void;
  onSaveToHub: () => Promise<void>;
  onDelete: () => void;
  title: string;
  linkHref?: string;
  linkLabel?: string;
  subtitle?: string;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const [savingToHub, setSavingToHub] = useState(false);
  const isSaved = Boolean(props.lead.savedToHubAt);

  return (
    <article className={`${adminPanelClass} overflow-hidden`}>
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <input
              type="checkbox"
              className="mt-1.5 h-4 w-4 shrink-0 accent-[#FF7E00]"
              checked={props.selected}
              onChange={props.onToggleSelect}
              aria-label={`Select ${props.title}`}
            />
            <LeadCollapseToggle
              expanded={props.expanded}
              onToggle={props.onToggleExpanded}
              label={props.title}
            />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">{props.title}</h3>
                {"targetGroup" in props.lead ? (
                  <span className="rounded-full border border-[#FF7E00]/25 bg-[#FF7E00]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FFD34E]">
                    {targetGroupLabel(props.lead.targetGroup)}
                  </span>
                ) : null}
              </div>
              {!props.expanded ? (
                <p className="text-xs text-white/45">
                  {statusLabelForPlatform(props.lead.status, props.platform)} · Likelihood{" "}
                  {props.lead.likelihoodScore}%
                </p>
              ) : null}
              {props.expanded && props.linkHref ? (
                <a
                  href={props.linkHref}
                  target="_blank"
                  rel="noreferrer"
                  className={`${adminLinkClass} text-sm`}
                >
                  {props.linkLabel ?? props.linkHref}
                </a>
              ) : null}
              {props.expanded && props.subtitle ? <p className="text-sm text-white/55">{props.subtitle}</p> : null}
              {props.expanded ? (
                <>
                  <p className="text-sm leading-relaxed text-[#FF7E00]/90">
                    <span className="font-semibold text-[#FF7E00]">Why Match Fit: </span>
                    {props.lead.whyMatchFit}
                  </p>
                  <p className="text-xs text-white/45">
                    Response likelihood:{" "}
                    <span className="font-bold tabular-nums text-white/80">{props.lead.likelihoodScore}%</span>
                  </p>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            <button
              type="button"
              disabled={savingToHub || isSaved}
              className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
              onClick={() => {
                setSavingToHub(true);
                void props.onSaveToHub().finally(() => setSavingToHub(false));
              }}
            >
              {isSaved ? "Saved to hub" : savingToHub ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4] hover:bg-[#E32B2B]/20"
              onClick={props.onDelete}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function HubLeadBubble(props: {
  platform: OutreachPlatform;
  lead: AnyLead;
  generatingFields: Set<string>;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
  onDelete: () => void;
  onGenerateCopy: (fields: OutreachCopyField[], feedback?: string) => Promise<void>;
  title: string;
  linkHref?: string;
  linkLabel?: string;
  subtitle?: string;
  copyFields: { key: OutreachCopyField; label: string; rows: number }[];
  hubMeta?: { platformLabel: string; savedToHubAt: string };
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const classification = props.lead.autoClassification as keyof typeof OUTREACH_CLASSIFICATION_LABELS;
  const statusOptions = outreachStatusOptionsForPlatform(props.platform);
  const isDeadLead = props.lead.status === "DEAD_LEAD";

  const fieldValues = props.copyFields.map((f) => String((props.lead as Record<string, unknown>)[f.key] ?? ""));
  const allEmpty = fieldValues.every((v) => v.trim().length === 0);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkRegenerateOpen, setBulkRegenerateOpen] = useState(false);

  const runBulk = async (feedback?: string) => {
    setBulkGenerating(true);
    try {
      await props.onGenerateCopy(
        props.copyFields.map((f) => f.key),
        feedback,
      );
    } finally {
      setBulkGenerating(false);
      setBulkRegenerateOpen(false);
    }
  };

  return (
    <article className={`${adminPanelClass} overflow-hidden`}>
      <div className="border-b border-white/[0.06] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <LeadCollapseToggle
              expanded={props.expanded}
              onToggle={props.onToggleExpanded}
              label={props.title}
            />
            <div className="min-w-0 space-y-2">
              {props.hubMeta ? (
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF7E00]/70">
                  {props.hubMeta.platformLabel}
                  {" · Saved "}
                  {new Date(props.hubMeta.savedToHubAt).toLocaleString()}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">{props.title}</h3>
                {"targetGroup" in props.lead ? (
                  <span className="rounded-full border border-[#FF7E00]/25 bg-[#FF7E00]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FFD34E]">
                    {targetGroupLabel(props.lead.targetGroup)}
                  </span>
                ) : null}
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${classificationBadgeClass(classification)}`}
                >
                  {OUTREACH_CLASSIFICATION_LABELS[classification] ?? classification}
                </span>
              </div>
              {!props.expanded ? (
                <p className="text-xs text-white/45">
                  {statusLabelForPlatform(props.lead.status, props.platform)}
                </p>
              ) : null}
              {props.expanded && props.linkHref ? (
                <a href={props.linkHref} target="_blank" rel="noreferrer" className={`${adminLinkClass} text-sm`}>
                  {props.linkLabel ?? props.linkHref}
                </a>
              ) : null}
              {props.expanded && props.subtitle ? <p className="text-sm text-white/55">{props.subtitle}</p> : null}
              {props.expanded ? (
                <p className="text-sm leading-relaxed text-[#FF7E00]/90">
                  <span className="font-semibold text-[#FF7E00]">Why Match Fit: </span>
                  {props.lead.whyMatchFit}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <select
              className={`${adminInputClassSm} w-full sm:w-auto`}
              value={props.lead.status}
              onChange={(e) => void props.onUpdate({ status: e.target.value })}
            >
              {statusOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {statusLabelForPlatform(s.id, props.platform)}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {props.expanded ? (
                allEmpty ? (
                  <button
                    type="button"
                    disabled={bulkGenerating}
                    className={adminAccentButtonClass}
                    onClick={() => void runBulk()}
                  >
                    {bulkGenerating ? "Generating…" : "Generate all"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={bulkGenerating}
                    className={adminSecondaryButtonClass}
                    onClick={() => setBulkRegenerateOpen(true)}
                  >
                    {bulkGenerating ? "Regenerating…" : "Re-generate all"}
                  </button>
                )
              ) : null}
              <button
                type="button"
                className="rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4] hover:bg-[#E32B2B]/20"
                onClick={props.onDelete}
              >
                Delete
              </button>
            </div>
            {props.expanded && isDeadLead && props.lead.deadLeadAt ? (
              <p className="text-[10px] text-white/40">
                Dead lead — moves to archive after {OUTREACH_DEAD_LEAD_ARCHIVE_HOURS}h (
                {new Date(
                  new Date(props.lead.deadLeadAt).getTime() + OUTREACH_DEAD_LEAD_ARCHIVE_HOURS * 3_600_000,
                ).toLocaleString()}
                ).
              </p>
            ) : null}
          </div>
        </div>
      </div>
      {props.expanded ? (
        <div className="space-y-4 p-4 sm:p-5">
          {props.copyFields.map((field) => (
            <CopyFieldBlock
              key={field.key}
              label={field.label}
              field={field.key}
              value={String((props.lead as Record<string, unknown>)[field.key] ?? "")}
              rows={field.rows}
              generating={props.generatingFields.has(field.key) || bulkGenerating}
              onSave={(value) => props.onUpdate({ [field.key]: value })}
              onGenerate={(feedback) => props.onGenerateCopy([field.key], feedback)}
            />
          ))}
          {"commentPostRef" in props.lead && (props.lead as InstagramLeadRow).commentPostRef ? (
            <p className="text-xs text-white/40">
              Comment on: {(props.lead as InstagramLeadRow).commentPostRef}
            </p>
          ) : null}
        </div>
      ) : null}
      <RegenerateFeedbackModal
        open={bulkRegenerateOpen}
        title="Re-generate all outreach copy"
        submitting={bulkGenerating}
        onCancel={() => {
          if (!bulkGenerating) setBulkRegenerateOpen(false);
        }}
        onConfirm={(feedback) => {
          void runBulk(feedback || undefined);
        }}
      />
    </article>
  );
}

function PlatformTabPanel(props: {
  platform: OutreachPlatform;
  leads: AnyLead[];
  loading: boolean;
  generating: boolean;
  generateProgress: number;
  generateStage: string;
  bulkDeleting: boolean;
  bulkSaving: boolean;
  leadCount: number;
  selectedIds: Set<string>;
  onLeadCount: (n: number) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onGenerate: () => void;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  onSaveToHub: (id: string) => Promise<void>;
  onBulkDelete: (
    input: { mode: "all" } | { mode: "batch"; generationBatchId: string } | { mode: "ids"; ids: string[] },
  ) => void;
  onBulkSave: (
    input: { mode: "all" } | { mode: "batch"; generationBatchId: string } | { mode: "ids"; ids: string[] },
  ) => Promise<void>;
}) {
  const activeLeads = props.leads.filter((l) => !l.deletedAt);
  const batches = useMemo(() => groupLeadsByBatch(props.leads), [props.leads]);
  const selectedActive = activeLeads.filter((l) => props.selectedIds.has(l.id));
  const allSelected = activeLeads.length > 0 && selectedActive.length === activeLeads.length;
  const hasSelection = selectedActive.length > 0;
  const [expandedLeadIds, setExpandedLeadIds] = useState<Set<string>>(new Set());

  const renderLead = (lead: AnyLead) => {
    const common = {
      key: lead.id,
      lead,
      platform: props.platform,
      selected: props.selectedIds.has(lead.id),
      onToggleSelect: () => props.onToggleSelect(lead.id),
      onDelete: () => props.onDelete(lead.id),
      onSaveToHub: () => props.onSaveToHub(lead.id),
      expanded: expandedLeadIds.has(leadEntryKey(props.platform, lead.id)),
      onToggleExpanded: () => {
        const key = leadEntryKey(props.platform, lead.id);
        setExpandedLeadIds((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
      },
    };

    if (props.platform === "instagram") {
      const ig = lead as InstagramLeadRow;
      return (
        <GenerationLeadCard
          {...common}
          title={ig.handle}
          linkHref={ig.profileUrl}
          linkLabel="Open Instagram profile"
        />
      );
    }
    if (props.platform === "facebook") {
      const fb = lead as FacebookLeadRow;
      return (
        <GenerationLeadCard
          {...common}
          title={fb.pageName}
          linkHref={fb.pageUrl}
          linkLabel="Open Facebook page"
        />
      );
    }
    if (props.platform === "email") {
      const em = lead as EmailLeadRow;
      return (
        <GenerationLeadCard
          {...common}
          title={em.name}
          linkHref={em.emailSourceUrl ?? undefined}
          linkLabel={em.emailSourceUrl ? "Where email was found" : em.email}
          subtitle={[em.email, em.businessName].filter(Boolean).join(" · ")}
        />
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <section className={`${adminCardClass} space-y-4`}>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Generate leads</p>
          <p className="mt-2 text-sm text-white/55">{OUTREACH_PLATFORM_UI[props.platform].generateDescription}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={adminLabelClass}>Lead count (US)</label>
            <input
              type="number"
              min={1}
              max={20}
              className={adminInputClass}
              value={props.leadCount}
              onChange={(e) => props.onLeadCount(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={props.generating}
            className={adminAccentButtonClass}
            onClick={props.onGenerate}
          >
            {props.generating ? "Generating…" : "Generate with AI"}
          </button>
          <button type="button" className={adminSecondaryButtonClass} onClick={props.onRefresh}>
            Refresh
          </button>
        </div>
        {props.generating || props.generateProgress > 0 ? (
          <OutreachGenerateProgressBar
            percent={props.generateProgress}
            stage={props.generateStage}
            footnote={OUTREACH_PLATFORM_UI[props.platform].progressFootnote}
          />
        ) : null}
      </section>

      {props.loading ? (
        <p className="text-sm text-white/45">Loading leads…</p>
      ) : activeLeads.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-8 text-center text-sm text-white/45">
          {OUTREACH_PLATFORM_UI[props.platform].emptyHint}
        </p>
      ) : (
        <div className="space-y-6">
          <section className={`${adminCardClass} space-y-3`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Active pulls</p>
                <p className="mt-1 text-sm text-white/55">
                  {activeLeads.length} lead{activeLeads.length === 1 ? "" : "s"} across {batches.length} pull
                  {batches.length === 1 ? "" : "s"} on this tab.
                  {hasSelection ? ` ${selectedActive.length} selected.` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-white/55">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#FF7E00]"
                    checked={allSelected}
                    onChange={() =>
                      props.onToggleSelectAll(allSelected ? [] : activeLeads.map((l) => l.id))
                    }
                  />
                  Select all
                </label>
                <button
                  type="button"
                  className={adminSecondaryButtonClass}
                  onClick={() =>
                    setExpandedLeadIds(new Set(activeLeads.map((lead) => leadEntryKey(props.platform, lead.id))))
                  }
                >
                  Expand all
                </button>
                <button
                  type="button"
                  className={adminSecondaryButtonClass}
                  onClick={() => setExpandedLeadIds(new Set())}
                >
                  Collapse all
                </button>
                <button
                  type="button"
                  disabled={props.bulkSaving || (hasSelection && selectedActive.length === 0)}
                  className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
                  onClick={() => {
                    if (hasSelection) {
                      void props.onBulkSave({ mode: "ids", ids: selectedActive.map((l) => l.id) });
                      return;
                    }
                    if (
                      !confirm(
                        `Save all ${activeLeads.length} active lead${activeLeads.length === 1 ? "" : "s"} on this tab to Outreach Hub?`,
                      )
                    ) {
                      return;
                    }
                    void props.onBulkSave({ mode: "all" });
                  }}
                >
                  {props.bulkSaving
                    ? "Saving…"
                    : hasSelection
                      ? `Save selected (${selectedActive.length})`
                      : `Save all ${activeLeads.length} leads`}
                </button>
                <button
                  type="button"
                  disabled={props.bulkDeleting}
                  className="rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4] hover:bg-[#E32B2B]/20 disabled:opacity-40"
                  onClick={() => {
                    if (hasSelection) {
                      props.onBulkDelete({ mode: "ids", ids: selectedActive.map((l) => l.id) });
                      return;
                    }
                    props.onBulkDelete({ mode: "all" });
                  }}
                >
                  {props.bulkDeleting
                    ? "Removing…"
                    : hasSelection
                      ? `Delete selected (${selectedActive.length})`
                      : `Delete all ${activeLeads.length} leads`}
                </button>
              </div>
            </div>
          </section>

          {batches.map((batch) => (
            <section key={batch.batchId ?? "__none__"} className="space-y-3">
              <div className="flex flex-col gap-2 border-b border-white/[0.06] pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#FF7E00]/80">Outreach pull</p>
                  <p className="mt-1 text-sm font-semibold text-white/85">{batch.label}</p>
                </div>
                {batch.batchId ? (
                  <button
                    type="button"
                    disabled={props.bulkDeleting}
                    className="rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4] hover:bg-[#E32B2B]/20 disabled:opacity-40"
                    onClick={() =>
                      props.onBulkDelete({ mode: "batch", generationBatchId: batch.batchId! })
                    }
                  >
                    {props.bulkDeleting ? "Removing…" : "Delete this pull"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={props.bulkDeleting}
                    className="rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4] hover:bg-[#E32B2B]/20 disabled:opacity-40"
                    onClick={() =>
                      props.onBulkDelete({ mode: "ids", ids: batch.leads.map((l) => l.id) })
                    }
                  >
                    {props.bulkDeleting ? "Removing…" : "Delete unbatched leads"}
                  </button>
                )}
              </div>
              <div className="space-y-4">{batch.leads.map((lead) => renderLead(lead))}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function archiveLeadTitle(entry: OutreachArchiveLead): string {
  if (entry.platform === "instagram") return (entry.lead as InstagramLeadRow).handle;
  if (entry.platform === "facebook") return (entry.lead as FacebookLeadRow).pageName;
  return (entry.lead as EmailLeadRow).name;
}

function OutreachArchivePanel(props: {
  entries: OutreachArchiveLead[];
  loading: boolean;
  revivingId: string | null;
  onRefresh: () => void;
  onRevive: (platform: OutreachPlatform, id: string) => Promise<void>;
  onOpenHub: () => void;
}) {
  return (
    <div className="space-y-6">
      <section className={`${adminCardClass} space-y-3`}>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Dead lead archive</p>
        <p className="text-sm text-white/55">
          Leads deleted from Outreach Hub or marked Dead Lead appear here. Dead leads marked in the status dropdown
          also move here after {OUTREACH_DEAD_LEAD_ARCHIVE_HOURS} hours. Archived rows are cleared every{" "}
          {OUTREACH_ARCHIVE_RETENTION_DAYS} days per account. Revived leads return to Outreach Hub — not the generation
          pages.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={adminSecondaryButtonClass} onClick={props.onRefresh}>
            Refresh archive
          </button>
          <button type="button" className={adminAccentButtonClass} onClick={props.onOpenHub}>
            Open Outreach Hub
          </button>
        </div>
      </section>

      {props.loading ? (
        <p className="text-sm text-white/45">Loading archive…</p>
      ) : props.entries.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-8 text-center text-sm text-white/45">
          No archived leads yet. Delete a contact from Outreach Hub or mark a lead as Dead Lead and it will appear here.
        </p>
      ) : (
        <div className="space-y-4">
          {props.entries.map((entry) => (
            <article key={`${entry.platform}-${entry.lead.id}`} className={`${adminPanelClass} p-4 sm:p-5`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF7E00]/70">
                    {OUTREACH_PLATFORMS.find((p) => p.id === entry.platform)?.label ?? entry.platform}
                  </p>
                  <h3 className="text-lg font-black text-white">{archiveLeadTitle(entry)}</h3>
                  <p className="text-sm text-white/55">{entry.lead.whyMatchFit}</p>
                  <p className="text-xs text-white/40">
                    Archived {entry.archivedAt ? new Date(entry.archivedAt).toLocaleString() : "—"}
                    {entry.archivePurgeAfterAt
                      ? ` · Purges ${new Date(entry.archivePurgeAfterAt).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={props.revivingId === entry.lead.id}
                  className={adminAccentButtonClass}
                  onClick={() => void props.onRevive(entry.platform, entry.lead.id)}
                >
                  {props.revivingId === entry.lead.id ? "Reviving…" : "Revive to hub"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function OutreachHubPanel(props: {
  entries: OutreachHubLead[];
  loading: boolean;
  purging: boolean;
  schemaRepairing: boolean;
  generatingFields: Record<string, Set<string>>;
  onRefresh: () => void;
  onOpenArchive: () => void;
  onPurgeStale: () => void;
  onRepairSchema: () => void;
  onUpdate: (platform: OutreachPlatform, id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (platform: OutreachPlatform, id: string) => void;
  onGenerateCopy: (
    platform: OutreachPlatform,
    id: string,
    fields: OutreachCopyField[],
    feedback?: string,
  ) => Promise<void>;
}) {
  const [filters, setFilters] = useState<OutreachHubFilterState>(DEFAULT_OUTREACH_HUB_FILTERS);
  const [expandedLeadIds, setExpandedLeadIds] = useState<Set<string>>(new Set());

  const statusOptions = useMemo(() => hubStatusFilterOptions(filters.platform), [filters.platform]);

  const filteredEntries = useMemo(
    () => filterOutreachHubLeads(props.entries, filters),
    [props.entries, filters],
  );

  const filtersActive = outreachHubFiltersActive(filters);

  const updateFilter = <K extends keyof OutreachHubFilterState>(key: K, value: OutreachHubFilterState[K]) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "platform") {
        const validStatuses = new Set(hubStatusFilterOptions(value as OutreachHubFilterState["platform"]).map((o) => o.id));
        if (!validStatuses.has(next.status)) {
          next.status = "all";
        }
      }
      return next;
    });
  };

  const fieldKey = (platform: OutreachPlatform, id: string) => `${platform}:${id}`;

  const toggleLeadExpanded = (platform: OutreachPlatform, id: string) => {
    const key = leadEntryKey(platform, id);
    setExpandedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderEntry = (entry: OutreachHubLead) => {
    const { platform, lead, savedToHubAt } = entry;
    const genSet = props.generatingFields[fieldKey(platform, lead.id)] ?? new Set<string>();
    const platformLabel = OUTREACH_PLATFORMS.find((p) => p.id === platform)?.label ?? platform;
    const hubMeta = { platformLabel, savedToHubAt };
    const expanded = expandedLeadIds.has(leadEntryKey(platform, lead.id));
    const toggleExpanded = () => toggleLeadExpanded(platform, lead.id);

    if (platform === "instagram") {
      const ig = lead as InstagramLeadRow;
      return (
        <HubLeadBubble
          key={`${platform}-${ig.id}`}
          platform="instagram"
          lead={ig}
          title={ig.handle}
          linkHref={ig.profileUrl}
          linkLabel="Open Instagram profile"
          copyFields={INSTAGRAM_COPY_FIELDS}
          generatingFields={genSet}
          hubMeta={hubMeta}
          expanded={expanded}
          onToggleExpanded={toggleExpanded}
          onUpdate={(patch) => props.onUpdate(platform, ig.id, patch)}
          onDelete={() => props.onDelete(platform, ig.id)}
          onGenerateCopy={(fields, feedback) => props.onGenerateCopy(platform, ig.id, fields, feedback)}
        />
      );
    }

    if (platform === "facebook") {
      const fb = lead as FacebookLeadRow;
      return (
        <HubLeadBubble
          key={`${platform}-${fb.id}`}
          platform="facebook"
          lead={fb}
          title={fb.pageName}
          linkHref={fb.pageUrl}
          linkLabel="Open Facebook page"
          copyFields={FACEBOOK_COPY_FIELDS}
          generatingFields={genSet}
          hubMeta={hubMeta}
          expanded={expanded}
          onToggleExpanded={toggleExpanded}
          onUpdate={(patch) => props.onUpdate(platform, fb.id, patch)}
          onDelete={() => props.onDelete(platform, fb.id)}
          onGenerateCopy={(fields, feedback) => props.onGenerateCopy(platform, fb.id, fields, feedback)}
        />
      );
    }

    if (platform === "email") {
      const em = lead as EmailLeadRow;
      return (
        <HubLeadBubble
          key={`${platform}-${em.id}`}
          platform="email"
          lead={em}
          title={em.name}
          linkHref={em.emailSourceUrl ?? undefined}
          linkLabel={em.emailSourceUrl ? "Where email was found" : em.email}
          subtitle={[em.email, em.businessName].filter(Boolean).join(" · ")}
          copyFields={EMAIL_COPY_FIELDS}
          generatingFields={genSet}
          hubMeta={hubMeta}
          expanded={expanded}
          onToggleExpanded={toggleExpanded}
          onUpdate={(patch) => props.onUpdate(platform, em.id, patch)}
          onDelete={() => props.onDelete(platform, em.id)}
          onGenerateCopy={(fields, feedback) => props.onGenerateCopy(platform, em.id, fields, feedback)}
        />
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <section className={`${adminCardClass} space-y-3`}>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Outreach Hub</p>
        <p className="text-sm text-white/55">
          Saved contacts from every platform — generate outreach copy here, track status, and follow up. Download a CSV
          anytime for spreadsheets or external tools.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/outreach/hub/export" className={adminAccentButtonClass}>
            Download CSV
          </a>
          <button type="button" className={adminSecondaryButtonClass} onClick={props.onRefresh}>
            Refresh hub
          </button>
          <button type="button" className={adminSecondaryButtonClass} onClick={props.onOpenArchive}>
            View archive
          </button>
        </div>
      </section>

      <section className={`${adminCardClass} space-y-3`}>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Housekeeping</p>
        <p className="text-sm text-white/55">
          Clear soft-deleted fake batches from earlier runs. Dead leads marked in the status dropdown move to the archive
          after {OUTREACH_DEAD_LEAD_ARCHIVE_HOURS} hours.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={props.purging}
            className={adminSecondaryButtonClass}
            onClick={props.onPurgeStale}
          >
            {props.purging ? "Purging…" : "Purge deleted stale leads"}
          </button>
          <button type="button" className={adminSecondaryButtonClass} onClick={props.onOpenArchive}>
            Open dead lead archive
          </button>
          <button
            type="button"
            disabled={props.schemaRepairing}
            className={adminSecondaryButtonClass}
            onClick={props.onRepairSchema}
          >
            {props.schemaRepairing ? "Repairing schema…" : "Repair Outreach Hub schema"}
          </button>
        </div>
      </section>

      <section className={`${adminCardClass} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Filters</p>
          {filtersActive ? (
            <button
              type="button"
              className={adminSecondaryButtonClass}
              onClick={() => setFilters(DEFAULT_OUTREACH_HUB_FILTERS)}
            >
              Clear filters
            </button>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1.5">
            <span className={adminLabelClass}>Platform</span>
            <select
              className={`${adminInputClassSm} w-full`}
              value={filters.platform}
              onChange={(e) => updateFilter("platform", e.target.value as OutreachHubFilterState["platform"])}
            >
              {HUB_PLATFORM_FILTER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className={adminLabelClass}>Status</span>
            <select
              className={`${adminInputClassSm} w-full`}
              value={filters.status}
              onChange={(e) => updateFilter("status", e.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className={adminLabelClass}>Classification</span>
            <select
              className={`${adminInputClassSm} w-full`}
              value={filters.classification}
              onChange={(e) =>
                updateFilter("classification", e.target.value as OutreachHubFilterState["classification"])
              }
            >
              {HUB_CLASSIFICATION_FILTER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className={adminLabelClass}>Audience</span>
            <select
              className={`${adminInputClassSm} w-full`}
              value={filters.targetGroup}
              onChange={(e) => updateFilter("targetGroup", e.target.value as OutreachHubFilterState["targetGroup"])}
            >
              {HUB_TARGET_GROUP_FILTER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className={adminLabelClass}>Saved from</span>
            <input
              type="date"
              className={`${adminInputClassSm} w-full`}
              value={filters.savedFrom}
              onChange={(e) => updateFilter("savedFrom", e.target.value)}
            />
          </label>
          <label className="space-y-1.5">
            <span className={adminLabelClass}>Saved through</span>
            <input
              type="date"
              className={`${adminInputClassSm} w-full`}
              value={filters.savedTo}
              onChange={(e) => updateFilter("savedTo", e.target.value)}
            />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className={adminLabelClass}>Search</span>
          <input
            type="search"
            className={`${adminInputClass} w-full`}
            placeholder="Search handle, page, name, email, or niche…"
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={adminSecondaryButtonClass}
            onClick={() =>
              setExpandedLeadIds(new Set(filteredEntries.map((entry) => leadEntryKey(entry.platform, entry.lead.id))))
            }
          >
            Expand all leads
          </button>
          <button
            type="button"
            className={adminSecondaryButtonClass}
            onClick={() => setExpandedLeadIds(new Set())}
          >
            Collapse all leads
          </button>
          <button
            type="button"
            className={adminSecondaryButtonClass}
            onClick={() =>
              setFilters({
                ...DEFAULT_OUTREACH_HUB_FILTERS,
                classification: "FOLLOW_UP_NEEDED",
              })
            }
          >
            Needs follow-up
          </button>
          <button
            type="button"
            className={adminSecondaryButtonClass}
            onClick={() =>
              setFilters({
                ...DEFAULT_OUTREACH_HUB_FILTERS,
                status: "RESPONSE_RECEIVED",
              })
            }
          >
            Responses received
          </button>
          <button
            type="button"
            className={adminSecondaryButtonClass}
            onClick={() => {
              const today = new Date();
              const weekAgo = new Date(today);
              weekAgo.setDate(weekAgo.getDate() - 7);
              setFilters({
                ...DEFAULT_OUTREACH_HUB_FILTERS,
                savedFrom: weekAgo.toISOString().slice(0, 10),
                savedTo: today.toISOString().slice(0, 10),
              });
            }}
          >
            Saved last 7 days
          </button>
        </div>
      </section>

      {props.loading ? (
        <p className="text-sm text-white/45">Loading saved contacts…</p>
      ) : props.entries.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-8 text-center text-sm text-white/45">
          No saved contacts yet. Use Save on any lead bubble to add them here.
        </p>
      ) : filteredEntries.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-8 text-center text-sm text-white/45">
          No contacts match the current filters. Try clearing filters or broadening your search.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-white/55">
            {filtersActive
              ? `Showing ${filteredEntries.length} of ${props.entries.length} saved contact${props.entries.length === 1 ? "" : "s"}.`
              : `${props.entries.length} saved contact${props.entries.length === 1 ? "" : "s"} across all platforms.`}
          </p>
          {filteredEntries.map((entry) => (
            <div key={`${entry.platform}-${entry.lead.id}`}>{renderEntry(entry)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OutreachHqClient(props: { aiStatus: AdminAiProviderStatus }) {
  const [tab, setTab] = useState<OutreachView>("instagram");
  const [leads, setLeads] = useState<AnyLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [generateStage, setGenerateStage] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [leadCount, setLeadCount] = useState(8);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hubEntries, setHubEntries] = useState<OutreachHubLead[]>([]);
  const [generatingFields, setGeneratingFields] = useState<Record<string, Set<string>>>({});
  const [archiveEntries, setArchiveEntries] = useState<OutreachArchiveLead[]>([]);
  const [pipelineStats, setPipelineStats] = useState<OutreachHubStats>(EMPTY_HUB_STATS);
  const [activeLeadsPlatform, setActiveLeadsPlatform] = useState<OutreachHubStatsPlatformFilter>("all");
  const [followUpPlatform, setFollowUpPlatform] = useState<OutreachHubStatsPlatformFilter>("all");
  const [responsesPlatform, setResponsesPlatform] = useState<OutreachHubStatsPlatformFilter>("all");
  const [schemaRepairing, setSchemaRepairing] = useState(false);
  const [schemaRepairMessage, setSchemaRepairMessage] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [revivingId, setRevivingId] = useState<string | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<DeleteReasonPromptState | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const coldTab = tab === "hub" || tab === "archive" ? "instagram" : tab;

  const repairOutreachSchema = useCallback(async () => {
    setSchemaRepairing(true);
    setSchemaRepairMessage(null);
    try {
      const res = await fetch("/api/admin/outreach/hub/schema-repair", {
        method: "POST",
        credentials: "include",
      });
      const data = await readJsonResponse<{ error?: string; message?: string }>(res);
      if (!res.ok) {
        throw new Error(formatUserFacingError(data.error, "Schema repair failed."));
      }
      setSchemaRepairMessage(data.message ?? "Outreach Hub schema repaired.");
      return true;
    } catch (e) {
      setError(formatUserFacingError(e, "Could not repair Outreach Hub schema."));
      return false;
    } finally {
      setSchemaRepairing(false);
    }
  }, []);

  const loadPipelineStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/outreach/stats", { credentials: "include" });
      const data = await readJsonResponse<{ error?: string; stats?: OutreachHubStats }>(res);
      if (!res.ok) {
        if (res.status === 503) {
          const repaired = await repairOutreachSchema();
          if (repaired) {
            const retry = await fetch("/api/admin/outreach/stats", { credentials: "include" });
            const retryData = await readJsonResponse<{ stats?: OutreachHubStats }>(retry);
            if (retry.ok && retryData.stats) {
              setPipelineStats(retryData.stats);
              return;
            }
          }
        }
        return;
      }
      if (data.stats) setPipelineStats(data.stats);
    } catch {
      // Stats are supplementary — tab loads surface hard errors.
    }
  }, [repairOutreachSchema]);

  const loadLeads = useCallback(async (platform: OutreachPlatform, options?: { clearAlerts?: boolean; silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    if (options?.clearAlerts) {
      setError(null);
      setSuccessMessage(null);
    }
    try {
      const res = await fetch(`/api/admin/outreach/leads?platform=${platform}`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load leads.");
      const data = await readJsonResponse<{ leads?: AnyLead[] }>(res);
      setLeads(data.leads ?? []);
    } catch {
      if (options?.clearAlerts) {
        setError("Could not load outreach leads. The database may still be updating — refresh in a moment.");
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  const loadArchiveEntries = useCallback(async (options?: { clearAlerts?: boolean; silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    if (options?.clearAlerts) {
      setError(null);
      setSuccessMessage(null);
    }
    try {
      const res = await fetch("/api/admin/outreach/archive", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load archive.");
      const data = await readJsonResponse<{ entries?: OutreachArchiveLead[] }>(res);
      setArchiveEntries(data.entries ?? []);
    } catch {
      if (options?.clearAlerts) {
        setError("Could not load dead lead archive.");
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  const loadHubEntries = useCallback(
    async (options?: { clearAlerts?: boolean; allowSchemaRepair?: boolean; silent?: boolean }) => {
      async function fetchHubEntries(fetchOptions?: {
        clearAlerts?: boolean;
        allowSchemaRepair?: boolean;
        silent?: boolean;
      }) {
        if (!fetchOptions?.silent) {
          setLoading(true);
        }
        if (fetchOptions?.clearAlerts) {
          setError(null);
          setSuccessMessage(null);
        }
        try {
          const res = await fetch("/api/admin/outreach/hub", { credentials: "include" });
          const data = await readJsonResponse<{ error?: string; entries?: OutreachHubLead[]; leads?: OutreachHubLead[] }>(
            res,
          );
          if (!res.ok) {
            if (res.status === 503 && fetchOptions?.allowSchemaRepair !== false) {
              const repaired = await repairOutreachSchema();
              if (repaired) {
                await fetchHubEntries({ ...fetchOptions, allowSchemaRepair: false });
                return;
              }
            }
            throw new Error(formatUserFacingError(data.error, "Could not load outreach hub."));
          }
          setHubEntries(data.leads ?? data.entries ?? []);
          void loadPipelineStats();
        } catch (e) {
          if (fetchOptions?.clearAlerts) {
            setError(formatUserFacingError(e, "Could not load Outreach Hub saved contacts."));
          }
        } finally {
          if (!fetchOptions?.silent) {
            setLoading(false);
          }
        }
      }

      await fetchHubEntries(options);
    },
    [loadPipelineStats, repairOutreachSchema],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void loadPipelineStats();
      if (tab === "archive") {
        void loadArchiveEntries({ clearAlerts: true });
        void loadHubEntries({ silent: true });
      } else if (tab === "hub") {
        void loadHubEntries({ clearAlerts: true });
      } else {
        void loadLeads(tab, { clearAlerts: true });
        void loadHubEntries({ silent: true });
      }
    });
  }, [tab, loadLeads, loadHubEntries, loadArchiveEntries, loadPipelineStats]);

  useEffect(() => {
    queueMicrotask(() => setSelectedIds(new Set()));
  }, [tab, leads]);

  const hubStats = useMemo(
    () => computeOutreachHubStats(hubEntries, pipelineStats.archived),
    [hubEntries, pipelineStats.archived],
  );

  useEffect(() => {
    if (!generating || tab === "hub" || tab === "archive") return;

    const totalLeads = leadCount;
    const estimatedMs =
      coldTab === "instagram"
        ? 18_000 + totalLeads * 3_500 * 2
        : coldTab === "facebook"
          ? 12_000 + totalLeads * 900 * 2
          : 10_000 + totalLeads * 700 * 2;
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const next = Math.min(92, Math.round((elapsed / estimatedMs) * 92));
      setGenerateProgress(next);
      setGenerateStage(stageLabelForOutreachGenerate(coldTab, next));
    }, 120);

    return () => window.clearInterval(timer);
  }, [generating, tab, coldTab, leadCount]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setSuccessMessage(null);
    setGenerateProgress(0);
    setGenerateStage(stageLabelForOutreachGenerate(coldTab, 0));
    try {
      const res = await fetch("/api/admin/outreach/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: coldTab, leadCount }),
      });
      const data = await readJsonResponse<{
        error?: unknown;
        message?: unknown;
        leads?: unknown[];
        verification?: {
          parsed: number;
          saved: number;
          rejected: number;
          rejectedSamples?: { handle: string; reason: string }[];
        };
      }>(res);
      if (!res.ok) {
        throw new Error(formatUserFacingError(data.error, "Generation failed."));
      }

      const savedLeadCount = data.leads?.length ?? 0;
      if (savedLeadCount === 0) {
        const rejectionHint =
          data.verification?.parsed && data.verification.rejected > 0
            ? `No leads saved. ${data.verification.rejected} candidate(s) failed verification.${
                data.verification.rejectedSamples?.length
                  ? ` Examples: ${data.verification.rejectedSamples
                      .slice(0, 3)
                      .map((sample) => `${sample.handle}: ${sample.reason}`)
                      .join("; ")}`
                  : ""
              }`
            : "No leads were generated. Try again.";
        setError(formatUserFacingError(data.message, rejectionHint));
        setSuccessMessage(null);
      } else if (data.message) {
        setSuccessMessage(formatUserFacingError(data.message, "Generation completed."));
        setError(null);
      } else if (data.verification) {
        setSuccessMessage(
          `Saved ${data.verification.saved} verified lead(s)${
            data.verification.rejected > 0 ? ` (${data.verification.rejected} skipped)` : ""
          }.`,
        );
        setError(null);
      } else {
        setSuccessMessage(`Saved ${savedLeadCount} new lead${savedLeadCount === 1 ? "" : "s"}.`);
        setError(null);
      }

      setGenerateProgress(96);
      setGenerateStage("Refreshing leads…");
      await loadLeads(coldTab);
      void loadPipelineStats();
      setGenerateProgress(100);
      setGenerateStage("Complete");
    } catch (e) {
      setError(formatUserFacingError(e, "Generation failed."));
    } finally {
      setGenerating(false);
      window.setTimeout(() => {
        setGenerateProgress(0);
        setGenerateStage("");
      }, 700);
    }
  };

  const updateLead = async (id: string, patch: Record<string, unknown>, platform: OutreachPlatform = coldTab) => {
    let rollbackHubEntries: OutreachHubLead[] | null = null;
    let rollbackLeads: AnyLead[] | null = null;

    if (tab === "hub") {
      setHubEntries((entries) => {
        rollbackHubEntries = entries;
        return entries.map((entry) =>
          entry.platform === platform && entry.lead.id === id
            ? { ...entry, lead: applyLeadPatch(entry.lead, platform, patch) }
            : entry,
        );
      });
    } else {
      setLeads((current) => {
        rollbackLeads = current;
        return current.map((lead) => (lead.id === id ? applyLeadPatch(lead, platform, patch) : lead));
      });
    }

    try {
      const res = await fetch(`/api/admin/outreach/leads/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, ...patch }),
      });
      const data = await readJsonResponse<{ error?: string; lead?: AnyLead }>(res);
      if (!res.ok) throw new Error(formatUserFacingError(data.error, "Update failed."));

      if (data.lead) {
        const updated = normalizeLeadFromApi(data.lead);
        if (tab === "hub") {
          setHubEntries((entries) =>
            entries.map((entry) =>
              entry.platform === platform && entry.lead.id === id ? { ...entry, lead: updated } : entry,
            ),
          );
        } else {
          setLeads((current) => current.map((lead) => (lead.id === id ? updated : lead)));
        }
      }

      void loadPipelineStats();
    } catch (e) {
      if (tab === "hub" && rollbackHubEntries) {
        setHubEntries(rollbackHubEntries);
      } else if (rollbackLeads) {
        setLeads(rollbackLeads);
      }
      throw e;
    }
  };

  const deleteLeadWithReason = async (
    id: string,
    platform: OutreachPlatform,
    deleteReason: string,
  ) => {
    const res = await fetch(`/api/admin/outreach/leads/${id}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, deleteReason }),
    });
    const data = await readJsonResponse<{ error?: string }>(res);
    if (!res.ok) throw new Error(formatUserFacingError(data.error, "Delete failed."));
    if (tab === "hub") {
      await loadHubEntries({ silent: true });
      void loadPipelineStats();
    } else if (tab === "archive") {
      await loadArchiveEntries({ silent: true });
      void loadPipelineStats();
    } else {
      await loadLeads(platform, { silent: true });
      void loadPipelineStats();
    }
  };

  const promptDeleteLead = (id: string, platform: OutreachPlatform = coldTab) => {
    const fromHub = tab === "hub";
    setDeletePrompt({
      title: fromHub ? "Remove from Outreach Hub" : "Delete lead",
      description: fromHub
        ? "This removes the contact from Outreach Hub and moves it to the archive. Tell the AI why this lead should not have been pursued."
        : "Tell the AI why this lead should not have been generated. This helps Match Fit avoid similar profiles.",
      onConfirm: async (reason) => {
        setDeleteSubmitting(true);
        try {
          await deleteLeadWithReason(id, platform, reason);
          setSuccessMessage(
            fromHub
              ? "Removed from Outreach Hub and moved to archive."
              : "Lead deleted. Reason saved for AI learning.",
          );
          setDeletePrompt(null);
        } catch (e) {
          setError(formatUserFacingError(e, "Delete failed."));
        } finally {
          setDeleteSubmitting(false);
        }
      },
    });
  };

  const saveLeadToHub = async (id: string, platform: OutreachPlatform = coldTab) => {
    const res = await fetch(`/api/admin/outreach/leads/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, saveToHub: true }),
    });
    if (!res.ok) throw new Error("Save failed.");
    setSuccessMessage("Saved to Outreach Hub.");
    await loadHubEntries({ silent: true });
    if (tab !== "hub") {
      await loadLeads(coldTab, { silent: true });
    }
  };

  const bulkSaveLeads = async (
    input: { mode: "all" } | { mode: "batch"; generationBatchId: string } | { mode: "ids"; ids: string[] },
  ) => {
    setBulkSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/admin/outreach/leads/bulk-save", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: coldTab, ...input }),
      });
      const data = await readJsonResponse<{ error?: string; savedCount?: number }>(res);
      if (!res.ok) throw new Error(formatUserFacingError(data.error, "Bulk save failed."));
      setSuccessMessage(
        `Saved ${data.savedCount ?? 0} lead${data.savedCount === 1 ? "" : "s"} to Outreach Hub.`,
      );
      await loadLeads(coldTab, { silent: true });
      await loadHubEntries({ silent: true });
    } catch (e) {
      setError(formatUserFacingError(e, "Bulk save failed."));
    } finally {
      setBulkSaving(false);
    }
  };

  const bulkDeleteLeads = (
    input: { mode: "all" } | { mode: "batch"; generationBatchId: string } | { mode: "ids"; ids: string[] },
  ) => {
    const countLabel =
      input.mode === "all"
        ? "all active leads on this tab"
        : input.mode === "batch"
          ? "this outreach pull"
          : `${input.ids.length} selected lead${input.ids.length === 1 ? "" : "s"}`;

    setDeletePrompt({
      title: "Delete leads",
      description: `Why are you deleting ${countLabel}? The reason is saved for each lead so the AI learns what to avoid.`,
      onConfirm: async (reason) => {
        setBulkDeleting(true);
        setDeleteSubmitting(true);
        setError(null);
        setSuccessMessage(null);
        try {
          const res = await fetch("/api/admin/outreach/leads/bulk-delete", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: coldTab, ...input, deleteReason: reason }),
          });
          const data = await readJsonResponse<{ error?: string; deletedCount?: number }>(res);
          if (!res.ok) throw new Error(formatUserFacingError(data.error, "Bulk delete failed."));
          setSuccessMessage(
            `Deleted ${data.deletedCount ?? 0} lead${data.deletedCount === 1 ? "" : "s"}. Reasons saved for AI learning.`,
          );
          setDeletePrompt(null);
          await loadLeads(coldTab, { silent: true });
          void loadPipelineStats();
        } catch (e) {
          setError(formatUserFacingError(e, "Bulk delete failed."));
        } finally {
          setBulkDeleting(false);
          setDeleteSubmitting(false);
        }
      },
    });
  };

  const reviveArchivedLead = async (platform: OutreachPlatform, id: string) => {
    setRevivingId(id);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/admin/outreach/archive/revive", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, id }),
      });
      const data = await readJsonResponse<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(formatUserFacingError(data.error, "Revive failed."));
      setSuccessMessage(data.message ?? "Lead revived to Outreach Hub.");
      await loadArchiveEntries();
      void loadPipelineStats();
    } catch (e) {
      setError(formatUserFacingError(e, "Revive failed."));
    } finally {
      setRevivingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: string[]) => {
    setSelectedIds(new Set(ids));
  };

  const generateLeadCopy = async (
    platform: OutreachPlatform,
    id: string,
    fields: OutreachCopyField[],
    feedback?: string,
  ) => {
    const key = `${platform}:${id}`;
    setGeneratingFields((prev) => ({
      ...prev,
      [key]: new Set([...(prev[key] ?? []), ...fields]),
    }));
    setError(null);
    try {
      const res = await fetch(`/api/admin/outreach/leads/${id}/generate-copy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, fields, feedback }),
      });
      const data = await readJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(formatUserFacingError(data.error, "Copy generation failed."));
      await loadHubEntries({ silent: true });
      setSuccessMessage(`Generated ${fields.length} outreach field${fields.length === 1 ? "" : "s"}.`);
    } catch (e) {
      setError(formatUserFacingError(e, "Copy generation failed."));
    } finally {
      setGeneratingFields((prev) => {
        const next = { ...prev };
        const current = new Set(next[key] ?? []);
        for (const field of fields) current.delete(field);
        if (current.size === 0) delete next[key];
        else next[key] = current;
        return next;
      });
    }
  };

  const purgeStaleLeads = async () => {
    if (
      !confirm(
        "Permanently remove archived (soft-deleted) outreach rows? Active leads stay untouched. This clears fake/stale batches from the archive.",
      )
    ) {
      return;
    }
    setPurging(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/admin/outreach/purge", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "archived" }),
      });
      const data = await readJsonResponse<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(formatUserFacingError(data.error, "Purge failed."));
      setSuccessMessage(data.message ?? "Archived outreach rows removed.");
      if (tab === "hub") {
        await loadHubEntries({ silent: true });
      } else {
        await loadLeads(coldTab);
        void loadPipelineStats();
      }
    } catch (e) {
      setError(formatUserFacingError(e, "Purge failed."));
    } finally {
      setPurging(false);
    }
  };

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] px-5 py-10 text-white sm:px-8 sm:py-12">
      <AdminPortalBackdrop />
      <div className="relative mx-auto max-w-5xl space-y-8">
        <header className="space-y-4">
          <AdminPortalNav current="outreach" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]">Match Fit</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Outreach HQ</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                Daily trainer outreach by platform — AI lead discovery, editable copy, status tracking, and a saved
                Outreach Hub. Data lives in your Match Fit database (Supabase Postgres).
              </p>
            </div>
            <Link href="/admin" className={adminSecondaryButtonClass}>
              Back to dashboard
            </Link>
          </div>
        </header>

        {!props.aiStatus.configured ? (
          <AdminPortalAlert variant="info">
            {props.aiStatus.message} Lead generation needs the AI Vault keys (ANTHROPIC_API_KEY and GEMINI_API_KEY) on the server.
          </AdminPortalAlert>
        ) : null}

        {error ? <AdminPortalAlert variant="error">{error}</AdminPortalAlert> : null}
        {successMessage ? <AdminPortalAlert variant="success">{successMessage}</AdminPortalAlert> : null}
        {schemaRepairMessage ? <AdminPortalAlert variant="info">{schemaRepairMessage}</AdminPortalAlert> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <OutreachHubMetricStatCard
            label="Active leads"
            metric="activeLeads"
            counts={hubStats.activeLeads}
            platformFilter={activeLeadsPlatform}
            onPlatformFilter={setActiveLeadsPlatform}
          />
          <OutreachHubMetricStatCard
            label="Follow-up needed"
            metric="followUpNeeded"
            counts={hubStats.followUpNeeded}
            platformFilter={followUpPlatform}
            onPlatformFilter={setFollowUpPlatform}
            valueClassName="text-amber-200"
          />
          <OutreachHubMetricStatCard
            label="Responses"
            metric="responses"
            counts={hubStats.responses}
            platformFilter={responsesPlatform}
            onPlatformFilter={setResponsesPlatform}
            valueClassName="text-emerald-200"
          />
          <div className={`${adminPanelClass} p-4`}>
            <p className={adminLabelClass}>Total currently in Outreach Hub</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#FFD34E]">{hubStats.totalInHub}</p>
            <p className="mt-1 text-[11px] text-white/40">{hubStats.archived} archived</p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2" aria-label="Outreach platform">
          {OUTREACH_PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={
                tab === p.id
                  ? "rounded-lg border border-[#FF7E00]/40 bg-[#FF7E00]/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#FFD34E]"
                  : adminSecondaryButtonClass
              }
              onClick={() => setTab(p.id)}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            className={
              tab === "hub"
                ? "rounded-lg border border-[#FF7E00]/40 bg-[#FF7E00]/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#FFD34E]"
                : adminSecondaryButtonClass
            }
            onClick={() => setTab("hub")}
          >
            OUTREACH HUB
          </button>
          <button
            type="button"
            className={
              tab === "archive"
                ? "rounded-lg border border-[#FF7E00]/40 bg-[#FF7E00]/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#FFD34E]"
                : adminSecondaryButtonClass
            }
            onClick={() => setTab("archive")}
          >
            Archive
          </button>
        </nav>

        {tab === "hub" ? (
          <OutreachHubPanel
            entries={hubEntries}
            loading={loading}
            purging={purging}
            schemaRepairing={schemaRepairing}
            generatingFields={generatingFields}
            onRefresh={() => void loadHubEntries()}
            onOpenArchive={() => setTab("archive")}
            onPurgeStale={() => void purgeStaleLeads()}
            onRepairSchema={() => void repairOutreachSchema()}
            onUpdate={async (platform, id, patch) => {
              try {
                await updateLead(id, patch, platform);
              } catch (e) {
                setError(formatUserFacingError(e, "Could not update lead."));
              }
            }}
            onDelete={(platform, id) => promptDeleteLead(id, platform)}
            onGenerateCopy={generateLeadCopy}
          />
        ) : tab === "archive" ? (
          <OutreachArchivePanel
            entries={archiveEntries}
            loading={loading}
            revivingId={revivingId}
            onRefresh={() => void loadArchiveEntries()}
            onRevive={reviveArchivedLead}
            onOpenHub={() => setTab("hub")}
          />
        ) : (
          <PlatformTabPanel
            platform={tab}
            leads={leads}
            loading={loading}
            generating={generating}
            generateProgress={generateProgress}
            generateStage={generateStage}
            bulkDeleting={bulkDeleting}
            bulkSaving={bulkSaving}
            leadCount={leadCount}
            selectedIds={selectedIds}
            onLeadCount={setLeadCount}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onGenerate={() => void generate()}
            onRefresh={() => void loadLeads(tab)}
            onDelete={(id) => promptDeleteLead(id, tab)}
            onSaveToHub={saveLeadToHub}
            onBulkDelete={bulkDeleteLeads}
            onBulkSave={bulkSaveLeads}
          />
        )}

        <DeleteReasonModal
          open={deletePrompt != null}
          title={deletePrompt?.title ?? "Delete lead"}
          description={deletePrompt?.description ?? ""}
          submitting={deleteSubmitting}
          onCancel={() => {
            if (!deleteSubmitting) setDeletePrompt(null);
          }}
          onConfirm={(reason) => {
            void deletePrompt?.onConfirm(reason);
          }}
        />

        <AdminPortalBetaNotice />
      </div>
    </main>
  );
}
