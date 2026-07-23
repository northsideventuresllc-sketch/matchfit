"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import {
  AdminLoadingBar,
  AdminPortalAlert,
  AdminPortalBetaNotice,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { ContentHubPanel, type DayActionResult } from "./components/content-hub-panel";
import { ImpromptuPanel } from "./components/impromptu-panel";
import { PublishingPanel } from "./components/publishing-panel";
import { ScheduledPanel } from "./components/scheduled-panel";
import { ArchivesPanel } from "./components/archives-panel";
import { Modal } from "./components/ui-bits";
import { useUnsavedRegistry } from "./components/use-unsaved-registry";

type AiStatus = {
  configured: boolean;
  niBrain: boolean;
  media: boolean;
  message: string;
};

type Tab = "hub" | "impromptu" | "publishing" | "scheduled" | "archives";
type Stage = "hub" | "publishing" | "scheduled" | "archived";

const TABS: { id: Tab; label: string }[] = [
  { id: "hub", label: "CONTENT HUB" },
  { id: "impromptu", label: "IMPROMPTU CONTENT GENERATION" },
  { id: "publishing", label: "PUBLISHING" },
  { id: "scheduled", label: "SCHEDULED POSTS" },
  { id: "archives", label: "ARCHIVES" },
];

const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000;

async function readApi<T>(res: Response, fallback: string): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? fallback);
  return data;
}

export function ContentCalendarV2Client({ aiStatus }: { aiStatus: AiStatus }) {
  const [tab, setTab] = useState<Tab>("hub");
  const [hubPosts, setHubPosts] = useState<ClientContentCalendarV2Post[]>([]);
  const [publishingPosts, setPublishingPosts] = useState<ClientContentCalendarV2Post[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ClientContentCalendarV2Post[]>([]);
  const [archivedPosts, setArchivedPosts] = useState<ClientContentCalendarV2Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [autoSave, setAutoSave] = useState(false);
  const [pendingTab, setPendingTab] = useState<Tab | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const registry = useUnsavedRegistry();
  const { anyDirty, saveAll } = registry;

  const loadStage = useCallback(async (stage: Stage) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/content-calendar/v2/posts?stage=${stage}`, { credentials: "include" });
      const data = await readApi<{ posts: ClientContentCalendarV2Post[] }>(res, "Could not load posts.");
      if (stage === "hub") setHubPosts(data.posts ?? []);
      if (stage === "publishing") setPublishingPosts(data.posts ?? []);
      if (stage === "scheduled") setScheduledPosts(data.posts ?? []);
      if (stage === "archived") setArchivedPosts(data.posts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load posts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "hub") queueMicrotask(() => void loadStage("hub"));
    if (tab === "publishing") queueMicrotask(() => void loadStage("publishing"));
    if (tab === "scheduled") queueMicrotask(() => void loadStage("scheduled"));
    if (tab === "archives") queueMicrotask(() => void loadStage("archived"));
  }, [tab, loadStage]);

  // Reflect any in-flight Cowork media completions moving posts into Publishing without a manual
  // refresh — safe on remount because it re-reads server state rather than assuming the tab stayed open.
  useEffect(() => {
    if (tab !== "publishing" && tab !== "hub") return;
    const stage: Stage = tab === "hub" ? "hub" : "publishing";
    const timer = window.setInterval(() => {
      if (!anyDirty) void loadStage(stage);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [tab, anyDirty, loadStage]);

  const replacePostInLists = useCallback((post: ClientContentCalendarV2Post | null) => {
    if (!post) return;
    const swap = (list: ClientContentCalendarV2Post[]) => list.map((p) => (p.id === post.id ? post : p));
    setHubPosts(swap);
    setPublishingPosts(swap);
    setScheduledPosts(swap);
    setArchivedPosts(swap);
  }, []);

  // In-place PATCH (no full refetch) so saving one post never resets sibling bubbles' unsaved edits.
  const patchPost = useCallback(
    async (id: string, fields: Partial<ClientContentCalendarV2Post>) => {
      const res = await fetch(`/api/admin/content-calendar/v2/posts/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await readApi<{ post: ClientContentCalendarV2Post | null }>(res, "Could not save edits.");
      replacePostInLists(data.post);
    },
    [replacePostInLists],
  );

  const currentStage: Stage = tab === "archives" ? "archived" : (tab === "impromptu" ? "hub" : tab);

  const postAction = useCallback(
    async (id: string, body: Record<string, unknown>, success?: string) => {
      setBusyId(id);
      setError(null);
      try {
        const res = await fetch(`/api/admin/content-calendar/v2/posts/${id}/actions`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        await readApi(res, "Action failed.");
        if (success) setNotice(success);
        await loadStage(currentStage);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      } finally {
        setBusyId(null);
      }
    },
    [currentStage, loadStage],
  );

  const dayAction = useCallback(
    async (path: string, body: Record<string, unknown>): Promise<DayActionResult> => {
      const res = await fetch(`/api/admin/content-calendar/v2/posts/day/${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readApi<DayActionResult>(res, "Day action failed.");
      await loadStage("hub");
      return data;
    },
    [loadStage],
  );

  const onApproveDay = useCallback((postDate: string) => dayAction("approve", { postDate, action: "approve" }), [dayAction]);
  const onReturnToEditing = useCallback(
    (postDate: string) => dayAction("approve", { postDate, action: "return_to_editing" }),
    [dayAction],
  );
  const onFireCowork = useCallback((postDate: string) => dayAction("fire-cowork", { postDate }), [dayAction]);

  const onApproveForPosting = useCallback(
    async (postIds: string[]): Promise<{ jobId?: string; postCount?: number }> => {
      const res = await fetch("/api/admin/content-calendar/v2/publishing/approve-for-posting", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds }),
      });
      const data = await readApi<{ jobId?: string; postCount?: number }>(res, "Could not approve for posting.");
      await loadStage("publishing");
      return data;
    },
    [loadStage],
  );

  const handleSaveAll = useCallback(async () => {
    setSavingAll(true);
    setError(null);
    try {
      await saveAll();
      setNotice("Progress saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save progress.");
    } finally {
      setSavingAll(false);
    }
  }, [saveAll]);

  // Warn on hard browser navigation / close while edits are unsaved.
  useEffect(() => {
    if (!anyDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [anyDirty]);

  // Auto Save — off by default; saves every 5 minutes while there are unsaved edits.
  const saveAllRef = useRef(saveAll);
  useEffect(() => {
    saveAllRef.current = saveAll;
  });
  useEffect(() => {
    if (!autoSave) return;
    const timer = window.setInterval(() => {
      if (anyDirty) void saveAllRef.current();
    }, AUTO_SAVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoSave, anyDirty]);

  function selectTab(next: Tab) {
    if (next === tab) return;
    setNotice(null);
    if (anyDirty) {
      setPendingTab(next);
      return;
    }
    setTab(next);
  }

  const bubbleWiring = {
    busyId,
    onPatch: patchPost,
    register: registry.setEntry,
    unregister: registry.removeEntry,
  };

  return (
    <AdminPortalShell
      current="content-calendar"
      maxWidth="full"
      title="Content Calendar v2"
      description="Five-tab content pipeline: Content Hub, Impromptu, Publishing, Scheduled Posts, Archives."
      contentClassName="space-y-6"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white/60">
            <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} />
            Auto Save {autoSave ? "on" : "off"}
          </label>
          <button
            type="button"
            className={adminPrimaryButtonClass}
            disabled={savingAll || !anyDirty}
            onClick={() => void handleSaveAll()}
          >
            {savingAll ? "SAVING…" : anyDirty ? "SAVE PROGRESS" : "SAVED"}
          </button>
        </div>
      }
    >
      <AdminPortalBetaNotice className="mt-0" />
      {!aiStatus.niBrain ? (
        <AdminPortalAlert variant="info">NI Brain Supabase keys are required for v2 reads and writes.</AdminPortalAlert>
      ) : null}
      {!aiStatus.configured ? <AdminPortalAlert variant="info">{aiStatus.message}</AdminPortalAlert> : null}
      {!aiStatus.media ? (
        <AdminPortalAlert variant="info">OPENAI_API_KEY is required for image/media adjust generation.</AdminPortalAlert>
      ) : null}
      {error ? <AdminPortalAlert>{error}</AdminPortalAlert> : null}
      {notice ? <AdminPortalAlert variant="success">{notice}</AdminPortalAlert> : null}

      <nav className="flex flex-wrap gap-2 border-b border-white/[0.06] pb-1" aria-label="Content Calendar v2 tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={
              tab === t.id
                ? "border-b-2 border-[#FF7E00] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#FFD34E]"
                : "px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/40 hover:text-white/70"
            }
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {loading ? <AdminLoadingBar label="Loading v2 content…" /> : null}

      {tab === "hub" ? (
        <ContentHubPanel
          posts={hubPosts}
          wiring={bubbleWiring}
          onApproveDay={onApproveDay}
          onReturnToEditing={onReturnToEditing}
          onFireCowork={onFireCowork}
        />
      ) : null}

      {tab === "impromptu" ? (
        <ImpromptuPanel
          disabled={!aiStatus.configured || !aiStatus.niBrain}
          onGenerated={async () => {
            await loadStage("hub");
          }}
          setError={setError}
        />
      ) : null}

      {tab === "publishing" ? (
        <PublishingPanel
          posts={publishingPosts}
          busyId={busyId}
          onPatch={patchPost}
          onAction={postAction}
          onApproveForPosting={onApproveForPosting}
          register={registry.setEntry}
          unregister={registry.removeEntry}
        />
      ) : null}

      {tab === "scheduled" ? <ScheduledPanel posts={scheduledPosts} /> : null}

      {tab === "archives" ? <ArchivesPanel posts={archivedPosts} /> : null}

      {pendingTab ? (
        <Modal title="Unsaved changes" onClose={() => setPendingTab(null)}>
          <p className="text-sm leading-relaxed text-white/80">
            You have unsaved draft edits. Auto Save is currently <span className="font-bold text-[#FFD34E]">{autoSave ? "on" : "off"}</span>.
          </p>
          <p className="mt-2 text-xs text-white/50">Save them before switching tabs, or discard and continue.</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className={adminSecondaryButtonClass} onClick={() => setPendingTab(null)}>
              STAY
            </button>
            <button
              type="button"
              className={adminSecondaryButtonClass}
              onClick={() => {
                const next = pendingTab;
                setPendingTab(null);
                if (next) setTab(next);
              }}
            >
              DISCARD & CONTINUE
            </button>
            <button
              type="button"
              className={adminPrimaryButtonClass}
              disabled={savingAll}
              onClick={async () => {
                const next = pendingTab;
                await handleSaveAll();
                setPendingTab(null);
                if (next) setTab(next);
              }}
            >
              {savingAll ? "SAVING…" : "SAVE & CONTINUE"}
            </button>
          </div>
        </Modal>
      ) : null}
    </AdminPortalShell>
  );
}
