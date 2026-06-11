"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { classificationBadgeClass } from "@/lib/outreach-classification";
import type {
  EmailLeadRow,
  FacebookLeadRow,
  InstagramLeadRow,
  OutreachArchiveLead,
  OutreachHubLead,
  OutreachPlatform,
} from "@/lib/outreach-types";
import {
  OUTREACH_ARCHIVE_RETENTION_DAYS,
  OUTREACH_CLASSIFICATION_LABELS,
  OUTREACH_DEAD_LEAD_ARCHIVE_HOURS,
  OUTREACH_PLATFORMS,
  outreachStatusOptionsForPlatform,
  statusLabelForPlatform,
  targetGroupLabel,
} from "@/lib/outreach-types";
import type { AdminAiProviderStatus } from "@/lib/admin-analytics-ai";
import { readJsonResponse } from "@/lib/read-json-response";
import {
  OUTREACH_PLATFORM_UI,
  stageLabelForOutreachGenerate,
} from "@/lib/outreach-platform-ui";

type AnyLead = InstagramLeadRow | FacebookLeadRow | EmailLeadRow;
type OutreachView = OutreachPlatform | "hub" | "archive";

type DeleteReasonPromptState = {
  title: string;
  description: string;
  onConfirm: (reason: string) => Promise<void>;
};

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

function EditableBlock({
  label,
  value,
  onSave,
  rows = 4,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
  rows?: number;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setDraft(value));
  }, [value]);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className={adminLabelClass}>{label}</p>
        <CopyButton text={draft} />
      </div>
      <textarea
        className={adminInputClassSm}
        rows={rows}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      {draft !== value ? (
        <button
          type="button"
          disabled={saving}
          className={adminAccentButtonClass}
          onClick={() => {
            setSaving(true);
            void onSave(draft).finally(() => setSaving(false));
          }}
        >
          {saving ? "Saving…" : "Save edit"}
        </button>
      ) : null}
    </div>
  );
}

function LeadBubble(props: {
  platform: OutreachPlatform;
  lead: AnyLead;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
  onDelete: () => void;
  onSaveToHub: () => Promise<void>;
  children: ReactNode;
  title: string;
  linkHref?: string;
  linkLabel?: string;
  hideSave?: boolean;
}) {
  const [savingToHub, setSavingToHub] = useState(false);
  const isSaved = Boolean(props.lead.savedToHubAt);
  const classification = props.lead.autoClassification as keyof typeof OUTREACH_CLASSIFICATION_LABELS;
  const statusOptions = outreachStatusOptionsForPlatform(props.platform);
  const isDeadLead = props.lead.status === "DEAD_LEAD";

  return (
    <article className={`${adminPanelClass} overflow-hidden`}>
      <div className="border-b border-white/[0.06] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
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
            {props.linkHref ? (
              <a
                href={props.linkHref}
                target="_blank"
                rel="noreferrer"
                className={`${adminLinkClass} text-sm`}
              >
                {props.linkLabel ?? props.linkHref}
              </a>
            ) : null}
            <p className="text-sm leading-relaxed text-[#FF7E00]/90">
              <span className="font-semibold text-[#FF7E00]">Why Match Fit: </span>
              {props.lead.whyMatchFit}
            </p>
            <p className="text-xs text-white/45">
              Response likelihood:{" "}
              <span className="font-bold tabular-nums text-white/80">{props.lead.likelihoodScore}%</span>
            </p>
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
              {!props.hideSave ? (
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
              ) : null}
              <button
                type="button"
                className="rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4] hover:bg-[#E32B2B]/20"
                onClick={props.onDelete}
              >
                Delete
              </button>
            </div>
            {isDeadLead && props.lead.deadLeadAt ? (
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
      <div className="space-y-4 p-4 sm:p-5">{props.children}</div>
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
  atlCount: number;
  virtualCount: number;
  onAtlCount: (n: number) => void;
  onVirtualCount: (n: number) => void;
  onGenerate: () => void;
  onRefresh: () => void;
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
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

  const renderLead = (lead: AnyLead) => {
    if (props.platform === "instagram") {
      const ig = lead as InstagramLeadRow;
      return (
        <LeadBubble
          key={ig.id}
          platform="instagram"
          lead={ig}
          title={ig.handle}
          linkHref={ig.profileUrl}
          linkLabel="Open Instagram profile"
          onUpdate={(patch) => props.onUpdate(ig.id, patch)}
          onDelete={() => props.onDelete(ig.id)}
          onSaveToHub={() => props.onSaveToHub(ig.id)}
        >
          <EditableBlock
            label="Instagram DM"
            value={ig.dmText}
            rows={6}
            onSave={(dmText) => props.onUpdate(ig.id, { dmText })}
          />
          <EditableBlock
            label="Comment (to grab attention)"
            value={ig.commentText}
            rows={2}
            onSave={(commentText) => props.onUpdate(ig.id, { commentText })}
          />
          {ig.commentPostRef ? <p className="text-xs text-white/40">Comment on: {ig.commentPostRef}</p> : null}
        </LeadBubble>
      );
    }
    if (props.platform === "facebook") {
      const fb = lead as FacebookLeadRow;
      return (
        <LeadBubble
          key={fb.id}
          platform="facebook"
          lead={fb}
          title={fb.pageName}
          linkHref={fb.pageUrl}
          linkLabel="Open Facebook page"
          onUpdate={(patch) => props.onUpdate(fb.id, patch)}
          onDelete={() => props.onDelete(fb.id)}
          onSaveToHub={() => props.onSaveToHub(fb.id)}
        >
          <EditableBlock
            label="Page post"
            value={fb.pagePostText}
            rows={6}
            onSave={(pagePostText) => props.onUpdate(fb.id, { pagePostText })}
          />
        </LeadBubble>
      );
    }
    if (props.platform === "email") {
      const em = lead as EmailLeadRow;
      return (
        <LeadBubble
          key={em.id}
          platform="email"
          lead={em}
          title={em.name}
          linkHref={em.emailSourceUrl ?? undefined}
          linkLabel={em.emailSourceUrl ? "Where email was found" : em.email}
          onUpdate={(patch) => props.onUpdate(em.id, patch)}
          onDelete={() => props.onDelete(em.id)}
          onSaveToHub={() => props.onSaveToHub(em.id)}
        >
          <p className="text-sm text-white/55">
            {em.email}
            {em.businessName ? ` · ${em.businessName}` : ""}
          </p>
          <EditableBlock
            label="Email subject"
            value={em.emailSubject}
            rows={1}
            onSave={(emailSubject) => props.onUpdate(em.id, { emailSubject })}
          />
          <EditableBlock
            label="Email body"
            value={em.emailBody}
            rows={8}
            onSave={(emailBody) => props.onUpdate(em.id, { emailBody })}
          />
        </LeadBubble>
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
            <label className={adminLabelClass}>ATL local count</label>
            <input
              type="number"
              min={0}
              max={20}
              className={adminInputClass}
              value={props.atlCount}
              onChange={(e) => props.onAtlCount(Number(e.target.value))}
            />
          </div>
          <div>
            <label className={adminLabelClass}>Virtual count</label>
            <input
              type="number"
              min={0}
              max={20}
              className={adminInputClass}
              value={props.virtualCount}
              onChange={(e) => props.onVirtualCount(Number(e.target.value))}
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
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={props.bulkSaving}
                  className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
                  onClick={() => {
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
                  {props.bulkSaving ? "Saving…" : `Save all ${activeLeads.length} leads`}
                </button>
                <button
                  type="button"
                  disabled={props.bulkDeleting}
                  className="rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4] hover:bg-[#E32B2B]/20 disabled:opacity-40"
                  onClick={() => props.onBulkDelete({ mode: "all" })}
                >
                  {props.bulkDeleting ? "Removing…" : `Delete all ${activeLeads.length} leads`}
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
          Leads marked Dead Lead are archived after {OUTREACH_DEAD_LEAD_ARCHIVE_HOURS} hours. Archived rows are cleared
          every {OUTREACH_ARCHIVE_RETENTION_DAYS} days per account. Revived leads return to Outreach Hub — not the
          generation pages.
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
          No archived dead leads yet. Mark a lead as Dead Lead and it will appear here after{" "}
          {OUTREACH_DEAD_LEAD_ARCHIVE_HOURS} hours.
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
  onRefresh: () => void;
  onOpenArchive: () => void;
  onUpdate: (platform: OutreachPlatform, id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (platform: OutreachPlatform, id: string) => void;
  onSaveToHub: (platform: OutreachPlatform, id: string) => Promise<void>;
}) {
  const renderEntry = (entry: OutreachHubLead) => {
    const { platform, lead } = entry;

    if (platform === "instagram") {
      const ig = lead as InstagramLeadRow;
      return (
        <LeadBubble
          key={`${platform}-${ig.id}`}
          platform="instagram"
          lead={ig}
          title={ig.handle}
          linkHref={ig.profileUrl}
          linkLabel="Open Instagram profile"
          onUpdate={(patch) => props.onUpdate(platform, ig.id, patch)}
          onDelete={() => props.onDelete(platform, ig.id)}
          onSaveToHub={() => props.onSaveToHub(platform, ig.id)}
          hideSave
        >
          <EditableBlock label="Instagram DM" value={ig.dmText} rows={6} onSave={(dmText) => props.onUpdate(platform, ig.id, { dmText })} />
          <EditableBlock
            label="Comment (to grab attention)"
            value={ig.commentText}
            rows={2}
            onSave={(commentText) => props.onUpdate(platform, ig.id, { commentText })}
          />
          {ig.commentPostRef ? <p className="text-xs text-white/40">Comment on: {ig.commentPostRef}</p> : null}
        </LeadBubble>
      );
    }

    if (platform === "facebook") {
      const fb = lead as FacebookLeadRow;
      return (
        <LeadBubble
          key={`${platform}-${fb.id}`}
          platform="facebook"
          lead={fb}
          title={fb.pageName}
          linkHref={fb.pageUrl}
          linkLabel="Open Facebook page"
          onUpdate={(patch) => props.onUpdate(platform, fb.id, patch)}
          onDelete={() => props.onDelete(platform, fb.id)}
          onSaveToHub={() => props.onSaveToHub(platform, fb.id)}
          hideSave
        >
          <EditableBlock
            label="Page post"
            value={fb.pagePostText}
            rows={6}
            onSave={(pagePostText) => props.onUpdate(platform, fb.id, { pagePostText })}
          />
        </LeadBubble>
      );
    }

    if (platform === "email") {
      const em = lead as EmailLeadRow;
      return (
        <LeadBubble
          key={`${platform}-${em.id}`}
          platform="email"
          lead={em}
          title={em.name}
          linkHref={em.emailSourceUrl ?? undefined}
          linkLabel={em.emailSourceUrl ? "Where email was found" : em.email}
          onUpdate={(patch) => props.onUpdate(platform, em.id, patch)}
          onDelete={() => props.onDelete(platform, em.id)}
          onSaveToHub={() => props.onSaveToHub(platform, em.id)}
          hideSave
        >
          <p className="text-sm text-white/55">
            {em.email}
            {em.businessName ? ` · ${em.businessName}` : ""}
          </p>
          <EditableBlock
            label="Email subject"
            value={em.emailSubject}
            rows={1}
            onSave={(emailSubject) => props.onUpdate(platform, em.id, { emailSubject })}
          />
          <EditableBlock
            label="Email body"
            value={em.emailBody}
            rows={8}
            onSave={(emailBody) => props.onUpdate(platform, em.id, { emailBody })}
          />
        </LeadBubble>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <section className={`${adminCardClass} space-y-3`}>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Outreach Hub</p>
        <p className="text-sm text-white/55">
          Saved contacts from every platform — your working list for follow-up. Download a CSV anytime for spreadsheets
          or external tools.
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

      {props.loading ? (
        <p className="text-sm text-white/45">Loading saved contacts…</p>
      ) : props.entries.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-8 text-center text-sm text-white/45">
          No saved contacts yet. Use Save on any lead bubble to add them here.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-white/55">
            {props.entries.length} saved contact{props.entries.length === 1 ? "" : "s"} across all platforms.
          </p>
          {props.entries.map((entry) => (
            <div key={`${entry.platform}-${entry.lead.id}`} className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF7E00]/70">
                {OUTREACH_PLATFORMS.find((p) => p.id === entry.platform)?.label ?? entry.platform}
                {" · Saved "}
                {new Date(entry.savedToHubAt).toLocaleString()}
              </p>
              {renderEntry(entry)}
            </div>
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
  const [atlCount, setAtlCount] = useState(3);
  const [virtualCount, setVirtualCount] = useState(5);
  const [hubEntries, setHubEntries] = useState<OutreachHubLead[]>([]);
  const [archiveEntries, setArchiveEntries] = useState<OutreachArchiveLead[]>([]);
  const [purging, setPurging] = useState(false);
  const [revivingId, setRevivingId] = useState<string | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<DeleteReasonPromptState | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const coldTab = tab === "hub" || tab === "archive" ? "instagram" : tab;

  const loadLeads = useCallback(async (platform: OutreachPlatform, options?: { clearAlerts?: boolean }) => {
    setLoading(true);
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
      setLoading(false);
    }
  }, []);

  const loadArchiveEntries = useCallback(async (options?: { clearAlerts?: boolean }) => {
    setLoading(true);
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
      setLoading(false);
    }
  }, []);

  const loadHubEntries = useCallback(async (options?: { clearAlerts?: boolean }) => {
    setLoading(true);
    if (options?.clearAlerts) {
      setError(null);
      setSuccessMessage(null);
    }
    try {
      const res = await fetch("/api/admin/outreach/hub", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load outreach hub.");
      const data = await readJsonResponse<{ entries?: OutreachHubLead[]; leads?: OutreachHubLead[] }>(res);
      setHubEntries(data.leads ?? data.entries ?? []);
    } catch {
      if (options?.clearAlerts) {
        setError("Could not load Outreach Hub saved contacts.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      if (tab === "hub") {
        void loadHubEntries({ clearAlerts: true });
      } else if (tab === "archive") {
        void loadArchiveEntries({ clearAlerts: true });
      } else {
        void loadLeads(tab, { clearAlerts: true });
      }
    });
  }, [tab, loadLeads, loadHubEntries, loadArchiveEntries]);

  const stats = useMemo(() => {
    const active = leads.filter((l) => !l.deletedAt);
    return {
      total: active.length,
      followUp: active.filter((l) => l.autoClassification === "FOLLOW_UP_NEEDED").length,
      responses: active.filter((l) => l.status === "RESPONSE_RECEIVED").length,
    };
  }, [leads]);

  useEffect(() => {
    if (!generating || tab === "hub" || tab === "archive") return;

    const totalLeads = atlCount + virtualCount;
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
  }, [generating, tab, coldTab, atlCount, virtualCount]);

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
        body: JSON.stringify({ platform: coldTab, atlCount, virtualCount }),
      });
      const data = await readJsonResponse<{
        error?: string;
        message?: string;
        leads?: unknown[];
        verification?: {
          parsed: number;
          saved: number;
          rejected: number;
          rejectedSamples?: { handle: string; reason: string }[];
        };
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");

      const leadCount = data.leads?.length ?? 0;
      if (leadCount === 0) {
        setError(
          data.message ??
            (data.verification?.parsed
              ? `No leads saved. ${data.verification.rejected} candidate(s) failed verification.`
              : "No leads were generated. Try again."),
        );
        setSuccessMessage(null);
      } else if (data.message) {
        setSuccessMessage(data.message);
        setError(null);
      } else if (data.verification) {
        setSuccessMessage(
          `Saved ${data.verification.saved} verified lead(s)${
            data.verification.rejected > 0 ? ` (${data.verification.rejected} skipped)` : ""
          }.`,
        );
        setError(null);
      } else {
        setSuccessMessage(`Saved ${leadCount} new lead${leadCount === 1 ? "" : "s"}.`);
        setError(null);
      }

      setGenerateProgress(96);
      setGenerateStage("Refreshing leads…");
      await loadLeads(coldTab);
      setGenerateProgress(100);
      setGenerateStage("Complete");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenerating(false);
      window.setTimeout(() => {
        setGenerateProgress(0);
        setGenerateStage("");
      }, 700);
    }
  };

  const updateLead = async (id: string, patch: Record<string, unknown>, platform: OutreachPlatform = coldTab) => {
    const res = await fetch(`/api/admin/outreach/leads/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, ...patch }),
    });
    if (!res.ok) throw new Error("Update failed.");
    if (tab === "hub") {
      await loadHubEntries();
    } else {
      await loadLeads(coldTab);
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
    if (!res.ok) throw new Error(data.error ?? "Delete failed.");
    if (tab === "hub") {
      await loadHubEntries();
    } else if (tab === "archive") {
      await loadArchiveEntries();
    } else {
      await loadLeads(platform);
    }
  };

  const promptDeleteLead = (id: string, platform: OutreachPlatform = coldTab) => {
    setDeletePrompt({
      title: "Delete lead",
      description: "Tell the AI why this lead should not have been generated. This helps Match Fit avoid similar profiles.",
      onConfirm: async (reason) => {
        setDeleteSubmitting(true);
        try {
          await deleteLeadWithReason(id, platform, reason);
          setSuccessMessage("Lead deleted. Reason saved for AI learning.");
          setDeletePrompt(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Delete failed.");
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
    if (tab === "hub") {
      await loadHubEntries();
    } else {
      await loadLeads(coldTab);
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
      if (!res.ok) throw new Error(data.error ?? "Bulk save failed.");
      setSuccessMessage(
        `Saved ${data.savedCount ?? 0} lead${data.savedCount === 1 ? "" : "s"} to Outreach Hub.`,
      );
      await loadLeads(coldTab);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk save failed.");
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
          if (!res.ok) throw new Error(data.error ?? "Bulk delete failed.");
          setSuccessMessage(
            `Deleted ${data.deletedCount ?? 0} lead${data.deletedCount === 1 ? "" : "s"}. Reasons saved for AI learning.`,
          );
          setDeletePrompt(null);
          await loadLeads(coldTab);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Bulk delete failed.");
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
      if (!res.ok) throw new Error(data.error ?? "Revive failed.");
      setSuccessMessage(data.message ?? "Lead revived to Outreach Hub.");
      await loadArchiveEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revive failed.");
    } finally {
      setRevivingId(null);
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
      if (!res.ok) throw new Error(data.error ?? "Purge failed.");
      setSuccessMessage(data.message ?? "Archived outreach rows removed.");
      if (tab === "hub") {
        await loadHubEntries();
      } else {
        await loadLeads(coldTab);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purge failed.");
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
            {props.aiStatus.message} Lead generation needs ANTHROPIC_API_KEY or OPENAI_API_KEY on the server.
          </AdminPortalAlert>
        ) : null}

        {error ? <AdminPortalAlert variant="error">{error}</AdminPortalAlert> : null}
        {successMessage ? <AdminPortalAlert variant="success">{successMessage}</AdminPortalAlert> : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className={`${adminPanelClass} p-4`}>
            <p className={adminLabelClass}>Active leads</p>
            <p className="mt-1 text-2xl font-black tabular-nums">{stats.total}</p>
          </div>
          <div className={`${adminPanelClass} p-4`}>
            <p className={adminLabelClass}>Follow-up needed</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-amber-200">{stats.followUp}</p>
          </div>
          <div className={`${adminPanelClass} p-4`}>
            <p className={adminLabelClass}>Responses</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-emerald-200">{stats.responses}</p>
          </div>
        </div>

        <section className={`${adminCardClass} space-y-3`}>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Housekeeping</p>
          <p className="text-sm text-white/55">
            Clear soft-deleted fake batches from earlier runs, then regenerate with verified AI lead discovery. Dead leads
            marked in the status dropdown move to the archive after {OUTREACH_DEAD_LEAD_ARCHIVE_HOURS} hours.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={purging}
              className={adminSecondaryButtonClass}
              onClick={() => void purgeStaleLeads()}
            >
              {purging ? "Purging…" : "Purge deleted stale leads"}
            </button>
            <button type="button" className={adminSecondaryButtonClass} onClick={() => setTab("archive")}>
              Open dead lead archive
            </button>
          </div>
        </section>

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
            onRefresh={() => void loadHubEntries()}
            onOpenArchive={() => setTab("archive")}
            onUpdate={(platform, id, patch) => updateLead(id, patch, platform)}
            onDelete={(platform, id) => promptDeleteLead(id, platform)}
            onSaveToHub={(platform, id) => saveLeadToHub(id, platform)}
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
            atlCount={atlCount}
            virtualCount={virtualCount}
            onAtlCount={setAtlCount}
            onVirtualCount={setVirtualCount}
            onGenerate={() => void generate()}
            onRefresh={() => void loadLeads(tab)}
            onUpdate={updateLead}
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
