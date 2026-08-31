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
// Owned by the next wave of agents — these two files do not exist yet, so this import will not
// resolve until they land at exactly these paths. That is expected: this file is the single owner
// of tab state and the shell that wires every panel in, so the plumbing (state, loads, actions,
// tab-follow) is built here first; the panel-owning agents fill in the component bodies right after.
import { PendingTabPanel } from "./components/pending-tab-panel";
import { PublishingPanel } from "./components/publishing-panel";
import { ScheduledPanel } from "./components/scheduled-panel";
import { ArchivesPanel } from "./components/archives-panel";
import { SocialMediaResearchPanel } from "./components/social-media-research-panel";
import { Modal } from "./components/ui-bits";
import { useUnsavedRegistry } from "./components/use-unsaved-registry";

type AiStatus = {
  configured: boolean;
  niBrain: boolean;
  media: boolean;
  message: string;
};

type Tab = "research" | "hub" | "impromptu" | "pending" | "publishing" | "scheduled" | "archives";
type Stage = "hub" | "pending" | "publishing" | "scheduled" | "archived";

const TABS: { id: Tab; label: string }[] = [
  { id: "research", label: "SOCIAL MEDIA RESEARCH" },
  { id: "hub", label: "CONTENT HUB" },
  { id: "impromptu", label: "IMPROMPTU CONTENT GENERATION" },
  { id: "pending", label: "PENDING" },
  { id: "publishing", label: "PUBLISHING" },
  { id: "scheduled", label: "SCHEDULED POSTS" },
  { id: "archives", label: "ARCHIVES" },
];

const TAB_IDS = TABS.map((t) => t.id);

function isValidTab(value: string | undefined | null): value is Tab {
  return typeof value === "string" && (TAB_IDS as string[]).includes(value);
}

/** Post-load stage each tab reflects. "research" and "impromptu" have no post list of their own — they fall back to "hub" (impromptu drafts land there; research never loads a stage at all). */
function tabToStage(tab: Tab): Stage {
  switch (tab) {
    case "archives":
      return "archived";
    case "impromptu":
    case "research":
      return "hub";
    default:
      return tab;
  }
}

/** Reverse of tabToStage, for auto-advancing the active tab to wherever a post/action actually sent content. */
function stageToTab(stage: string | null | undefined): Tab | null {
  switch (stage) {
    case "hub":
      return "hub";
    case "pending":
      return "pending";
    case "publishing":
      return "publishing";
    case "scheduled":
      return "scheduled";
    case "archived":
      return "archives";
    default:
      return null;
  }
}

/**
 * Post-level actions whose outcome should auto-advance the active tab to wherever the post
 * actually went, per the plan's routing rules: submit_for_generation (media→pending,
 * text→publishing), regenerate_via_agent ("Regenerate", →pending), back_to_drafts ("Stop", →hub).
 * Keyed by action name (not by caller) so this applies no matter which panel triggers it.
 */
const TAB_FOLLOW_ACTIONS = new Set(["submit_for_generation", "regenerate_via_agent", "back_to_drafts"]);

const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000;

async function readApi<T>(res: Response, fallback: string): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? fallback);
  return data;
}

export function ContentCalendarV2Client({
  aiStatus,
  initialTab,
}: {
  aiStatus: AiStatus;
  /** From the ?tab= query param — seeds the active tab (e.g. the old /pending URL's redirect lands on "pending"). Defaults to "hub" when absent or unrecognized. */
  initialTab?: string;
}) {
  const [tab, setTab] = useState<Tab>(() => (isValidTab(initialTab) ? initialTab : "hub"));
  const [hubPosts, setHubPosts] = useState<ClientContentCalendarV2Post[]>([]);
  const [pendingPosts, setPendingPosts] = useState<ClientContentCalendarV2Post[]>([]);
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

  // Manual media bypass (Lane 1) — a top-level control since the per-day button in the Hub tab's
  // day cards belongs to the ContentHubPanel-owning agent. This gives the route/handler a working
  // entry point today; that agent can call the same route from inside each day card instead/too.
  const [manualMediaDate, setManualMediaDate] = useState("");
  const [manualMediaBusy, setManualMediaBusy] = useState(false);

  const registry = useUnsavedRegistry();
  const { anyDirty, saveAll } = registry;

  const loadStage = useCallback(async (stage: Stage) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/content-calendar/v2/posts?stage=${stage}`, { credentials: "include" });
      const data = await readApi<{ posts: ClientContentCalendarV2Post[] }>(res, "Could not load posts.");
      if (stage === "hub") setHubPosts(data.posts ?? []);
      if (stage === "pending") setPendingPosts(data.posts ?? []);
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
    if (tab === "pending") queueMicrotask(() => void loadStage("pending"));
    if (tab === "publishing") queueMicrotask(() => void loadStage("publishing"));
    if (tab === "scheduled") queueMicrotask(() => void loadStage("scheduled"));
    if (tab === "archives") queueMicrotask(() => void loadStage("archived"));
  }, [tab, loadStage]);

  // Reflect any in-flight Cowork media completions (or elapsed pending-progress) moving posts
  // between stages without a manual refresh — safe on remount because it re-reads server state
  // rather than assuming the tab stayed open.
  useEffect(() => {
    if (tab !== "publishing" && tab !== "hub" && tab !== "pending") return;
    const stage = tabToStage(tab);
    const timer = window.setInterval(() => {
      if (!anyDirty) void loadStage(stage);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [tab, anyDirty, loadStage]);

  const replacePostInLists = useCallback((post: ClientContentCalendarV2Post | null) => {
    if (!post) return;
    const swap = (list: ClientContentCalendarV2Post[]) => list.map((p) => (p.id === post.id ? post : p));
    setHubPosts(swap);
    setPendingPosts(swap);
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

  const currentStage = tabToStage(tab);

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
        const data = await readApi<{ post: ClientContentCalendarV2Post | null }>(res, "Action failed.");
        if (success) setNotice(success);

        const actionName = typeof body.action === "string" ? body.action : "";
        if (TAB_FOLLOW_ACTIONS.has(actionName)) {
          const nextTab = stageToTab(data.post?.workflowStage);
          if (nextTab && nextTab !== tab) {
            setTab(nextTab);
            await loadStage(tabToStage(nextTab));
          }
        }

        await loadStage(currentStage);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      } finally {
        setBusyId(null);
      }
    },
    [currentStage, loadStage, tab],
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

  // Approve Day queues media posts into Pending and sends text posts straight to Publishing — a
  // real day almost always has media posts, so Pending is where the operator's attention goes next.
  const onApproveDay = useCallback(
    async (postDate: string) => {
      const result = await dayAction("approve", { postDate, action: "approve" });
      setTab("pending");
      await loadStage("pending");
      return result;
    },
    [dayAction, loadStage],
  );
  const onReturnToEditing = useCallback(
    (postDate: string) => dayAction("approve", { postDate, action: "return_to_editing" }),
    [dayAction],
  );
  const onFireCowork = useCallback((postDate: string) => dayAction("fire-cowork", { postDate }), [dayAction]);

  // Manually Generate Media Day (Lane 1) — skips Cowork entirely, so every post for the date lands
  // straight in Publishing, unconditionally.
  const onManuallyGenerateDayMedia = useCallback(
    async (postDate: string): Promise<{ moved?: number; memoId?: string | null }> => {
      const res = await fetch("/api/admin/content-calendar/v2/posts/day/manually-generate-media", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postDate }),
      });
      const data = await readApi<{ moved?: number; memoId?: string | null }>(
        res,
        "Could not manually generate media for that day.",
      );
      await loadStage("hub");
      setTab("publishing");
      await loadStage("publishing");
      return data;
    },
    [loadStage],
  );

  const onApproveForPosting = useCallback(
    async (
      postIds: string[],
      platformOverrides?: Record<string, string[]>,
    ): Promise<{ jobId?: string; postCount?: number }> => {
      const res = await fetch("/api/admin/content-calendar/v2/publishing/approve-for-posting", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds, platformOverrides }),
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

  const runManualMediaBypass = useCallback(async () => {
    if (!manualMediaDate) return;
    setManualMediaBusy(true);
    setError(null);
    try {
      await onManuallyGenerateDayMedia(manualMediaDate);
      setNotice(`Media generation bypassed for ${manualMediaDate} — that day's posts moved straight to Publishing.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not manually generate media for that day.");
    } finally {
      setManualMediaBusy(false);
    }
  }, [manualMediaDate, onManuallyGenerateDayMedia]);

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
      description="Seven-tab content pipeline: Social Media Research, Content Hub, Impromptu, Pending, Publishing, Scheduled Posts, Archives."
      contentClassName="space-y-6"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={manualMediaDate}
              onChange={(e) => setManualMediaDate(e.target.value)}
              aria-label="Post date for manual media bypass"
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/80"
            />
            <button
              type="button"
              className={adminSecondaryButtonClass}
              disabled={manualMediaBusy || !manualMediaDate}
              onClick={() => void runManualMediaBypass()}
              title="Skip Cowork media generation and send that day's hub posts straight to Publishing."
            >
              {manualMediaBusy ? "WORKING…" : "MANUALLY GENERATE MEDIA"}
            </button>
          </div>
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
        <AdminPortalAlert variant="info">{aiStatus.message}</AdminPortalAlert>
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

      {tab === "research" ? (
        <SocialMediaResearchPanel
          disabled={!aiStatus.configured || !aiStatus.niBrain}
          setError={setError}
          setNotice={setNotice}
        />
      ) : null}

      {tab === "hub" ? (
        <ContentHubPanel
          posts={hubPosts}
          wiring={bubbleWiring}
          onApproveDay={onApproveDay}
          onReturnToEditing={onReturnToEditing}
          onFireCowork={onFireCowork}
          onManuallyGenerateMedia={onManuallyGenerateDayMedia}
          onPostAction={postAction}
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

      {tab === "pending" ? (
        <PendingTabPanel
          posts={pendingPosts}
          busyId={busyId}
          onPatch={patchPost}
          onAction={postAction}
          register={registry.setEntry}
          unregister={registry.removeEntry}
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
