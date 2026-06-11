"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminPortalAlert, AdminPortalBetaNotice, adminSecondaryButtonClass } from "@/components/admin/admin-portal-ui";
import type { ClientContentPost } from "@/lib/content-calendar/content-calendar-store";
import { isPostMissed } from "@/lib/content-calendar/schedule-utils";
import {
  BulkContentGeneratorPanel,
  ContentGeneratorPanel,
  ContentHubPanel,
  UnpostedPromptModal,
} from "@/app/admin/content-calendar/content-calendar-panels";

type AiStatus = {
  configured: boolean;
  niBrain: boolean;
  media: boolean;
  message: string;
};

type ContentTab = "generator" | "bulk" | "hub";

const AUTO_PURGE_KEY = "matchfit_content_hub_auto_purge_24h";

export function ContentCalendarClient(props: { aiStatus: AiStatus }) {
  const [tab, setTab] = useState<ContentTab>("generator");
  const [error, setError] = useState<string | null>(null);
  const [socialSummary, setSocialSummary] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [hubPosts, setHubPosts] = useState<ClientContentPost[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ClientContentPost[]>([]);
  const [hubLoading, setHubLoading] = useState(false);
  const [autoPurge, setAutoPurge] = useState(false);
  const [promptDismissedIds, setPromptDismissedIds] = useState<Set<string>>(new Set());
  const [promptBusy, setPromptBusy] = useState(false);

  useEffect(() => {
    try {
      setAutoPurge(localStorage.getItem(AUTO_PURGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

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

  useEffect(() => {
    if (tab === "hub") {
      queueMicrotask(() => void loadHub());
    }
    if (tab === "bulk" || tab === "hub") {
      queueMicrotask(() => void loadScheduled());
    }
  }, [tab, loadHub, loadScheduled]);

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

  function setAutoPurgePref(value: boolean) {
    setAutoPurge(value);
    try {
      localStorage.setItem(AUTO_PURGE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
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
  }

  async function markHubPosted(id: string) {
    const res = await fetch(`/api/admin/content-calendar/posts/${id}/actions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "posted", autoPurgeAfter24h: autoPurge }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not mark posted.");
      return;
    }
    await loadHub();
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

  const tabs: { id: ContentTab; label: string }[] = [
    { id: "generator", label: "Content Generator" },
    { id: "bulk", label: "Bulk Content Generator" },
    { id: "hub", label: "Content Hub" },
  ];

  return (
    <AdminPortalShell
      current="content-calendar"
      maxWidth="full"
      title="Content Calendar"
      description="Generate single posts, bulk batches with target groups, and manage saved content in Content Hub."
      headerActions={
        <button
          type="button"
          className={adminSecondaryButtonClass}
          disabled={scanning}
          onClick={() => void runSocialScan()}
        >
          {scanning ? "Scanning…" : "Scan Social"}
        </button>
      }
      contentClassName="space-y-6"
    >
      <AdminPortalBetaNotice className="mt-0" />

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
        <BulkContentGeneratorPanel configured={props.aiStatus.configured} onHubRefresh={() => void loadHub()} />
      ) : null}
      {tab === "hub" ? (
        <ContentHubPanel
          posts={hubPosts}
          loading={hubLoading}
          autoPurge={autoPurge}
          onAutoPurgeChange={setAutoPurgePref}
          onRefresh={() => void loadHub()}
          onDelete={deleteHubPost}
          onMarkPosted={markHubPosted}
          onUpdatePostDate={updateHubPostDate}
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
