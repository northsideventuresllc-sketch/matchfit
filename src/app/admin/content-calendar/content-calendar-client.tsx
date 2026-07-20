"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { MarketingPlaybookStepBanner } from "@/components/admin/marketing-playbook-step-banner";
import { AdminPortalAlert, AdminPortalBetaNotice, adminSecondaryButtonClass } from "@/components/admin/admin-portal-ui";
import type { ClientContentPost } from "@/lib/content-calendar/content-calendar-store";
import { isPostMissed } from "@/lib/content-calendar/schedule-utils";
import {
  BulkContentGeneratorPanel,
  ContentGeneratorPanel,
  ContentHubPanel,
  DeletedContentPanel,
  PostedContentPanel,
  UnpostedPromptModal,
} from "@/app/admin/content-calendar/content-calendar-panels";

type AiStatus = {
  configured: boolean;
  niBrain: boolean;
  media: boolean;
  message: string;
};

type ContentTab = "generator" | "bulk" | "hub" | "posted" | "deleted";

export function ContentCalendarClient(props: { aiStatus: AiStatus }) {
  const [tab, setTab] = useState<ContentTab>("generator");
  const [error, setError] = useState<string | null>(null);
  const [socialSummary, setSocialSummary] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [hubPosts, setHubPosts] = useState<ClientContentPost[]>([]);
  const [postedPosts, setPostedPosts] = useState<ClientContentPost[]>([]);
  const [deletedPosts, setDeletedPosts] = useState<ClientContentPost[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ClientContentPost[]>([]);
  const [hubLoading, setHubLoading] = useState(false);
  const [postedLoading, setPostedLoading] = useState(false);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [promptDismissedIds, setPromptDismissedIds] = useState<Set<string>>(new Set());
  const [promptBusy, setPromptBusy] = useState(false);
  const [schemaRepairing, setSchemaRepairing] = useState(false);
  const [schemaRepairMessage, setSchemaRepairMessage] = useState<string | null>(null);

  const showSchemaRepair =
    Boolean(error) &&
    /Content Hub columns are missing|NI_BRAIN_DATABASE_URL|NI_BRAIN_DATABASE_PASSWORD|saved_to_hub_at/i.test(error ?? "");

  const loadHub = useCallback(async () => {
    setHubLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/content-calendar/hub", { credentials: "include" });
      const data = (await res.json()) as { posts?: ClientContentPost[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load Content Hub.");
      setHubPosts(data.posts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Content Hub.");
    } finally {
      setHubLoading(false);
    }
  }, []);

  const loadScheduled = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/content-calendar/hub?view=scheduled", { credentials: "include" });
      const data = (await res.json()) as { posts?: ClientContentPost[] };
      if (res.ok) setScheduledPosts(data.posts ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadPosted = useCallback(async () => {
    setPostedLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/content-calendar/hub?view=posted", { credentials: "include" });
      const data = (await res.json()) as { posts?: ClientContentPost[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load posted posts.");
      setPostedPosts(data.posts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load posted posts.");
    } finally {
      setPostedLoading(false);
    }
  }, []);

  const loadDeleted = useCallback(async () => {
    setDeletedLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/content-calendar/hub?view=deleted", { credentials: "include" });
      const data = (await res.json()) as { posts?: ClientContentPost[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load deleted posts.");
      setDeletedPosts(data.posts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load deleted posts.");
    } finally {
      setDeletedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "hub") {
      queueMicrotask(() => void loadHub());
    }
    if (tab === "posted") {
      queueMicrotask(() => void loadPosted());
    }
    if (tab === "deleted") {
      queueMicrotask(() => void loadDeleted());
    }
    if (tab === "bulk" || tab === "hub") {
      queueMicrotask(() => void loadScheduled());
    }
  }, [tab, loadHub, loadScheduled, loadDeleted, loadPosted]);

  const tabPosts = useMemo(() => {
    if (tab === "hub") return hubPosts;
    if (tab === "bulk") return scheduledPosts;
    return [];
  }, [tab, hubPosts, scheduledPosts]);

  const unpostedPromptPost = useMemo(() => {
    const candidate = tabPosts.find(
      (p) =>
        !p.posted &&
        !promptDismissedIds.has(p.id) &&
        isPostMissed({ postDate: p.postDate, posted: p.posted }),
    );
    return candidate ?? null;
  }, [tabPosts, promptDismissedIds]);

  async function repairContentHubSchema() {
    setSchemaRepairing(true);
    setSchemaRepairMessage(null);
    try {
      const res = await fetch("/api/admin/content-calendar/hub/schema-repair", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Schema repair failed.");
      setSchemaRepairMessage(data.message ?? "Content Hub schema repaired.");
      setError(null);
      await loadHub();
    } catch (e) {
      setSchemaRepairMessage(e instanceof Error ? e.message : "Schema repair failed.");
    } finally {
      setSchemaRepairing(false);
    }
  }

  async function runSocialScan() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/content-calendar/social-scan", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { summary?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Scan failed.");
      setSocialSummary(data.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  async function deleteHubPost(id: string) {
    const res = await fetch(`/api/admin/content-calendar/posts/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not delete post.");
      return;
    }
    await loadHub();
    void loadDeleted();
  }

  async function markHubPosted(id: string) {
    const res = await fetch(`/api/admin/content-calendar/posts/${id}/actions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "posted" }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not mark posted.");
      return;
    }
    await Promise.all([loadHub(), loadPosted()]);
  }

  async function updateHubPostDate(id: string, postDate: string) {
    const res = await fetch(`/api/admin/content-calendar/posts/${id}/actions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_post_date", postDate }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not update post date.");
      return;
    }
    await loadHub();
  }

  async function saveHubPostFields(
    id: string,
    fields: { caption: string; visualPrompt: string | null; hashtags: string[] },
    originals: { caption: string; visualPrompt: string | null; hashtags: string[] },
  ) {
    const res = await fetch(`/api/admin/content-calendar/posts/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: fields.caption,
        visualPrompt: fields.visualPrompt,
        hashtags: fields.hashtags,
        originalCaption: originals.caption,
        originalVisualPrompt: originals.visualPrompt,
        originalHashtags: originals.hashtags,
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not save post edits.");
      return;
    }
    await loadHub();
  }

  async function restoreDeletedPost(id: string) {
    const res = await fetch(`/api/admin/content-calendar/posts/${id}/actions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not restore post.");
      return;
    }
    await Promise.all([loadDeleted(), loadHub()]);
  }

  const tabs: { id: ContentTab; label: string }[] = [
    { id: "generator", label: "Content Generator" },
    { id: "bulk", label: "Bulk Content Generator" },
    { id: "hub", label: "Content Hub" },
    { id: "posted", label: "Recently Posted" },
    { id: "deleted", label: "Recently Deleted" },
  ];

  return (
    <AdminPortalShell
      current="content-calendar"
      maxWidth="full"
      title="Content Calendar"
      description="Generate single posts, bulk batches with target groups, and manage saved content in Content Hub."
      headerActions={
        <>
          <Link href="/admin/content-calendar/v2" className={adminSecondaryButtonClass}>
            Open v2 (preview)
          </Link>
          <button
            type="button"
            className={adminSecondaryButtonClass}
            disabled={scanning}
            onClick={() => void runSocialScan()}
          >
            {scanning ? "Scanning…" : "Scan Social"}
          </button>
        </>
      }
      contentClassName="space-y-6"
    >
      <AdminPortalBetaNotice className="mt-0" />

      <MarketingPlaybookStepBanner currentStepId="generate_content" />

      {!props.aiStatus.niBrain ? (
        <AdminPortalAlert variant="info">
          NI Brain Supabase keys are not set. Add NI_BRAIN_SUPABASE_URL and NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY to Vercel
          production env or store them in platform_secrets, then redeploy.
        </AdminPortalAlert>
      ) : null}

      {!props.aiStatus.configured ? (
        <AdminPortalAlert variant="info">{props.aiStatus.message}</AdminPortalAlert>
      ) : null}

      {error ? <AdminPortalAlert>{error}</AdminPortalAlert> : null}

      {showSchemaRepair ? (
        <AdminPortalAlert variant="info">
          <p className="text-sm leading-relaxed">
            Content Hub needs a one-time database update on NI Brain. Add{" "}
            <strong>NI_BRAIN_DATABASE_PASSWORD</strong> (from Supabase → NI Brain project → Settings → Database) to
            Vercel production env or run <code className="text-[#FFD34E]">npm run bootstrap:ni-brain</code> with that
            password, redeploy, then click repair below.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={adminSecondaryButtonClass}
              disabled={schemaRepairing}
              onClick={() => void repairContentHubSchema()}
            >
              {schemaRepairing ? "Repairing schema…" : "Repair Content Hub schema"}
            </button>
            {schemaRepairMessage ? <span className="text-sm text-white/70">{schemaRepairMessage}</span> : null}
          </div>
        </AdminPortalAlert>
      ) : null}

      {schemaRepairMessage && !showSchemaRepair ? (
        <AdminPortalAlert variant="info">{schemaRepairMessage}</AdminPortalAlert>
      ) : null}

      {socialSummary ? (
        <section className="rounded-2xl border border-white/[0.06] bg-[#12151C]/90 p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Social performance insights</p>
          <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/70">{socialSummary}</pre>
        </section>
      ) : null}

      <nav className="flex flex-wrap gap-2 border-b border-white/[0.06] pb-1" aria-label="Content calendar sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={
              tab === t.id
                ? "border-b-2 border-[#FF7E00] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#FFD34E]"
                : "px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/40 hover:text-white/70"
            }
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "generator" ? <ContentGeneratorPanel configured={props.aiStatus.configured} /> : null}
      {tab === "bulk" ? (
        <BulkContentGeneratorPanel
          configured={props.aiStatus.configured}
          niBrainConfigured={props.aiStatus.niBrain}
          onHubRefresh={() => void loadHub()}
        />
      ) : null}
      {tab === "hub" ? (
        <ContentHubPanel
          posts={hubPosts}
          loading={hubLoading}
          onRefresh={() => void loadHub()}
          onDelete={deleteHubPost}
          onMarkPosted={markHubPosted}
          onUpdatePostDate={updateHubPostDate}
          onSaveFields={saveHubPostFields}
        />
      ) : null}

      {tab === "posted" ? (
        <PostedContentPanel
          posts={postedPosts}
          loading={postedLoading}
          onRefresh={() => void loadPosted()}
        />
      ) : null}

      {tab === "deleted" ? (
        <DeletedContentPanel
          posts={deletedPosts}
          loading={deletedLoading}
          onRefresh={() => void loadDeleted()}
          onRestore={restoreDeletedPost}
        />
      ) : null}

      {unpostedPromptPost ? (
        <UnpostedPromptModal
          post={unpostedPromptPost}
          busy={promptBusy}
          onDismiss={() => setPromptDismissedIds((s) => new Set(s).add(unpostedPromptPost.id))}
          onMarkPosted={async () => {
            setPromptBusy(true);
            await markHubPosted(unpostedPromptPost.id);
            setPromptBusy(false);
          }}
          onUpdateDate={async (date) => {
            setPromptBusy(true);
            await updateHubPostDate(unpostedPromptPost.id, date);
            setPromptDismissedIds((s) => new Set(s).add(unpostedPromptPost.id));
            setPromptBusy(false);
          }}
        />
      ) : null}
    </AdminPortalShell>
  );
}
