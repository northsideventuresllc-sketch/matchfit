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
  OtherLeadRow,
  OutreachLeadStatus,
  OutreachPlatform,
} from "@/lib/outreach-types";
import {
  OUTREACH_CLASSIFICATION_LABELS,
  OUTREACH_PLATFORMS,
  OUTREACH_STATUS_OPTIONS,
  statusLabelForPlatform,
  targetGroupLabel,
} from "@/lib/outreach-types";
import type { AdminAiProviderStatus } from "@/lib/admin-analytics-ai";

type AnyLead = InstagramLeadRow | FacebookLeadRow | EmailLeadRow | OtherLeadRow;

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
  useEffect(() => setDraft(value), [value]);
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
  onDelete: () => Promise<void>;
  children: ReactNode;
  title: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const classification = props.lead.autoClassification as keyof typeof OUTREACH_CLASSIFICATION_LABELS;
  const statusOptions = OUTREACH_STATUS_OPTIONS.filter(
    (s) => props.platform !== "facebook" || !["FOLLOW_UP_1", "FOLLOW_UP_2"].includes(s.id),
  );

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
              onChange={(e) => void props.onUpdate({ status: e.target.value as OutreachLeadStatus })}
            >
              {statusOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {statusLabelForPlatform(s.id, props.platform)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={deleting}
              className="rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4] hover:bg-[#E32B2B]/20 disabled:opacity-40"
              onClick={() => {
                if (!confirm("Move this outreach to deleted archive? It stays on file for learning.")) return;
                setDeleting(true);
                void props.onDelete().finally(() => setDeleting(false));
              }}
            >
              {deleting ? "Removing…" : "Delete"}
            </button>
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
  atlCount: number;
  virtualCount: number;
  onAtlCount: (n: number) => void;
  onVirtualCount: (n: number) => void;
  onGenerate: () => void;
  onRefresh: () => void;
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const activeLeads = props.leads.filter((l) => !l.deletedAt);

  return (
    <div className="space-y-6">
      <section className={`${adminCardClass} space-y-4`}>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Generate leads</p>
          <p className="mt-2 text-sm text-white/55">
            AI finds new fitness pro leads, skips ones already in the database, and drafts personalized outreach with a
            shared invite tail for today&apos;s batch.
          </p>
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
      </section>

      {props.loading ? (
        <p className="text-sm text-white/45">Loading leads…</p>
      ) : activeLeads.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-8 text-center text-sm text-white/45">
          No active leads yet. Generate a batch to get started.
        </p>
      ) : (
        <div className="space-y-4">
          {activeLeads.map((lead) => {
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
                  {ig.commentPostRef ? (
                    <p className="text-xs text-white/40">Comment on: {ig.commentPostRef}</p>
                  ) : null}
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
                >
                  <p className="text-sm text-white/55">{em.email}{em.businessName ? ` · ${em.businessName}` : ""}</p>
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
            const ot = lead as OtherLeadRow;
            return (
              <LeadBubble
                key={ot.id}
                platform="other"
                lead={ot}
                title={ot.contactLabel}
                linkHref={ot.contactUrl ?? undefined}
                onUpdate={(patch) => props.onUpdate(ot.id, patch)}
                onDelete={() => props.onDelete(ot.id)}
              >
                {ot.channelNotes ? <p className="text-xs text-white/45">{ot.channelNotes}</p> : null}
                <EditableBlock
                  label="Outreach message"
                  value={ot.outreachText}
                  rows={6}
                  onSave={(outreachText) => props.onUpdate(ot.id, { outreachText })}
                />
              </LeadBubble>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function OutreachHqClient(props: { aiStatus: AdminAiProviderStatus }) {
  const [tab, setTab] = useState<OutreachPlatform>("instagram");
  const [leads, setLeads] = useState<AnyLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atlCount, setAtlCount] = useState(5);
  const [virtualCount, setVirtualCount] = useState(10);
  const [coworkJson, setCoworkJson] = useState<string | null>(null);

  const loadLeads = useCallback(async (platform: OutreachPlatform) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/outreach/leads?platform=${platform}`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load leads.");
      const data = (await res.json()) as { leads?: AnyLead[] };
      setLeads(data.leads ?? []);
    } catch {
      setError("Could not load outreach leads. Run db:migrate if tables are missing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads(tab);
  }, [tab, loadLeads]);

  const stats = useMemo(() => {
    const active = leads.filter((l) => !l.deletedAt);
    return {
      total: active.length,
      followUp: active.filter((l) => l.autoClassification === "FOLLOW_UP_NEEDED").length,
      responses: active.filter((l) => l.status === "RESPONSE_RECEIVED").length,
    };
  }, [leads]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/outreach/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: tab, atlCount, virtualCount }),
      });
      const data = (await res.json()) as { error?: string; message?: string; leads?: unknown[] };
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      if (data.message && !data.leads?.length) setError(data.message);
      await loadLeads(tab);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const updateLead = async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/outreach/leads/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: tab, ...patch }),
    });
    if (!res.ok) throw new Error("Update failed.");
    await loadLeads(tab);
  };

  const deleteLead = async (id: string) => {
    const res = await fetch(`/api/admin/outreach/leads/${id}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: tab }),
    });
    if (!res.ok) throw new Error("Delete failed.");
    await loadLeads(tab);
  };

  const loadCoworkBrief = async () => {
    const res = await fetch("/api/admin/outreach/cowork-brief", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setCoworkJson(JSON.stringify(data, null, 2));
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
                Daily trainer outreach by platform — AI lead discovery, editable copy, status tracking, and a Cowork
                morning brief. Data lives in your Match Fit database (Supabase Postgres).
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
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Claude Cowork</p>
          <p className="text-sm text-white/55">
            Export today&apos;s Lead-status queue for morning automation. Cowork can open profile links in Chrome tabs,
            send DMs/comments/emails, then update status via the API or this UI.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={adminAccentButtonClass} onClick={() => void loadCoworkBrief()}>
              Load morning brief
            </button>
            {coworkJson ? <CopyButton text={coworkJson} /> : null}
          </div>
          {coworkJson ? (
            <pre className="max-h-64 overflow-auto rounded-xl border border-white/[0.06] bg-[#0E1016]/90 p-3 text-[11px] leading-relaxed text-white/60">
              {coworkJson}
            </pre>
          ) : null}
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
        </nav>

        <PlatformTabPanel
          platform={tab}
          leads={leads}
          loading={loading}
          generating={generating}
          atlCount={atlCount}
          virtualCount={virtualCount}
          onAtlCount={setAtlCount}
          onVirtualCount={setVirtualCount}
          onGenerate={() => void generate()}
          onRefresh={() => void loadLeads(tab)}
          onUpdate={updateLead}
          onDelete={deleteLead}
        />

        <AdminPortalBetaNotice />
      </div>
    </main>
  );
}
