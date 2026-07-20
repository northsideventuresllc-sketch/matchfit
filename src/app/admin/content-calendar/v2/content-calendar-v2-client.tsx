"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import {
  AdminLoadingBar,
  AdminPortalAlert,
  AdminPortalBetaNotice,
  adminAccentButtonClass,
  adminCardClass,
  adminInputClassSm,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import { ContentHashtagTagInput } from "@/components/admin/content-hashtag-tag-input";
import type { BulkGeneratedDraft } from "@/lib/content-calendar/content-calendar-ai";
import {
  CONTENT_CALENDAR_GROUPS,
  CONTENT_CALENDAR_POST_TYPES,
  CONTENT_CALENDAR_TYPE_ICONS,
  type ContentCalendarGroup,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import { formatCalendarDate } from "@/lib/content-calendar/rotation";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";

type AiStatus = {
  configured: boolean;
  niBrain: boolean;
  media: boolean;
  message: string;
};

type Tab = "hub" | "planner" | "impromptu" | "publishing" | "scheduled" | "archives";
type Stage = "hub" | "publishing" | "scheduled" | "archived";
type Lane = "scheduled" | "impromptu";

/** JB Workflow 1 — video via Google account `jonnybooth22@gmail.com` (Flow / Gemini). */
const GEMINI_FLOW_VIDEO_URL = "https://labs.google/flow";
const GEMINI_ACCOUNT_URL = "https://gemini.google.com/app";

const TABS: { id: Tab; label: string }[] = [
  { id: "hub", label: "CONTENT HUB" },
  { id: "planner", label: "WEEKLY PLANNER" },
  { id: "impromptu", label: "IMPROMPTU CONTENT GENERATION" },
  { id: "publishing", label: "PUBLISHING" },
  { id: "scheduled", label: "SCHEDULED POSTS" },
  { id: "archives", label: "ARCHIVES" },
];

const POST_ORDER: ContentCalendarPostType[] = ["Static", "Carousel", "Text", "Video"];

type DayPlan = {
  dayIndex: number;
  label: string;
  date: string;
  theme: string;
  targetAudience: ContentCalendarGroup;
  cta: string;
  prompts: Record<ContentCalendarPostType, string>;
};

function nextMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const add = day === 1 ? 7 : ((8 - day) % 7 || 7);
  const next = new Date(now);
  next.setDate(now.getDate() + add);
  next.setHours(0, 0, 0, 0);
  return next;
}

function buildDefaultPlan(): DayPlan[] {
  const monday = nextMonday();
  const labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const themes = [
    "Founding coach proof and early trust",
    "Client discovery without cold DMs",
    "Independent Pro listing and business visibility",
    "Fit Hub community momentum",
    "Weekend signup urgency and beta conversion",
  ];
  const audiences: ContentCalendarGroup[] = ["Join the Team", "Clients", "List With Us", "Clients", "Join the Team"];
  const ctas = [
    "Drive coaches to match-fit.net/trainer/sign-up",
    "Drive clients to match-fit.net/client/sign-up",
    "Drive Independent Pros to match-fit.net/trainer/sign-up",
    "Drive clients to explore Fit Hub and sign up",
    "Drive coaches to claim beta launch position",
  ];
  return labels.map((label, dayIndex) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + dayIndex);
    const audience = audiences[dayIndex];
    const theme = themes[dayIndex];
    const cta = ctas[dayIndex];
    return {
      dayIndex,
      label,
      date: formatCalendarDate(date),
      theme,
      targetAudience: audience,
      cta,
      prompts: {
        Static: `${theme}. Make one bold visual proof point for ${audience}.`,
        Carousel: `${theme}. Build 3-5 swipe frames that teach the audience what to do next.`,
        Text: `${theme}. Write a text-native opinion or mini-story that sounds human and direct.`,
        Video: `${theme}. Script a short-form hook, beat arc, and thumbnail concept.`,
      },
    };
  });
}

function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultScheduleValue(post: ClientContentCalendarV2Post): string {
  const base = post.postDate ? new Date(`${post.postDate}T10:00:00`) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  base.setHours(10, 0, 0, 0);
  return formatDateTimeLocal(base);
}

async function readApi<T>(res: Response, fallback: string): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? fallback);
  return data;
}

export function ContentCalendarV2Client({ aiStatus }: { aiStatus: AiStatus }) {
  const [tab, setTab] = useState<Tab>("planner");
  const [hubPosts, setHubPosts] = useState<ClientContentCalendarV2Post[]>([]);
  const [publishingPosts, setPublishingPosts] = useState<ClientContentCalendarV2Post[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ClientContentCalendarV2Post[]>([]);
  const [archivedPosts, setArchivedPosts] = useState<ClientContentCalendarV2Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [impromptuDate, setImpromptuDate] = useState("");

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

  const refreshCurrent = useCallback(async () => {
    if (tab === "hub") await loadStage("hub");
    if (tab === "publishing") await loadStage("publishing");
    if (tab === "scheduled") await loadStage("scheduled");
    if (tab === "archives") await loadStage("archived");
  }, [tab, loadStage]);

  useEffect(() => {
    if (tab === "hub") queueMicrotask(() => void loadStage("hub"));
    if (tab === "publishing") queueMicrotask(() => void loadStage("publishing"));
    if (tab === "scheduled") queueMicrotask(() => void loadStage("scheduled"));
    if (tab === "archives") queueMicrotask(() => void loadStage("archived"));
  }, [tab, loadStage]);

  useEffect(() => {
    if (tab !== "publishing") return;
    if (!publishingPosts.some((post) => post.optimizeStatus === "running")) return;
    const timer = window.setInterval(() => void loadStage("publishing"), 4000);
    return () => window.clearInterval(timer);
  }, [tab, publishingPosts, loadStage]);

  async function patchPost(id: string, fields: Partial<ClientContentCalendarV2Post>) {
    const res = await fetch(`/api/admin/content-calendar/v2/posts/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    await readApi(res, "Could not save edits.");
    await refreshCurrent();
  }

  async function postAction(id: string, body: Record<string, unknown>, success?: string) {
    setBusy(id);
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
      await refreshCurrent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function submitLane(lane: Lane) {
    setBusy(`submit_${lane}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/content-calendar/v2/posts/actions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_approved",
          lane,
          postDate: lane === "impromptu" ? impromptuDate : undefined,
        }),
      });
      const data = await readApi<{ moved: number }>(res, "Submit failed.");
      setNotice(`${data.moved} approved ${lane} post${data.moved === 1 ? "" : "s"} moved to PUBLISHING.`);
      await loadStage("hub");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed.");
    } finally {
      setBusy(null);
    }
  }

  const scheduledDrafts = hubPosts.filter((p) => p.contentLane === "scheduled");
  const impromptuDrafts = hubPosts.filter((p) => p.contentLane === "impromptu");

  return (
    <AdminPortalShell
      current="content-calendar"
      maxWidth="full"
      title="Content Calendar v2"
      description="Hidden six-tab preview for JB approval. Live calendar remains unchanged."
      contentClassName="space-y-6"
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

      <div className={`${adminCardClass} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FFD34E]">Gemini video account</p>
          <p className="mt-1 text-sm text-white/55">
            Open your Google Gemini / Flow account (<span className="text-white/80">jonnybooth22@gmail.com</span>) to
            generate Video posts (Veo 3.1 Lite · 9:16), then attach the MP4 on the Video bubble.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={GEMINI_FLOW_VIDEO_URL}
            target="_blank"
            rel="noreferrer"
            className={adminPrimaryButtonClass}
          >
            Open Gemini Flow (video)
          </a>
          <a
            href={GEMINI_ACCOUNT_URL}
            target="_blank"
            rel="noreferrer"
            className={adminSecondaryButtonClass}
          >
            Open Gemini
          </a>
        </div>
      </div>

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
            onClick={() => {
              setNotice(null);
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {loading ? <AdminLoadingBar label="Loading v2 content..." /> : null}

      {tab === "planner" ? (
        <WeeklyPlannerPanel
          disabled={!aiStatus.configured || !aiStatus.niBrain}
          onApproved={async () => {
            setNotice("Weekly planner day approved into CONTENT HUB scheduled drafts.");
            await loadStage("hub");
            setTab("hub");
          }}
          setError={setError}
        />
      ) : null}

      {tab === "hub" ? (
        <ContentHubV2Panel
          scheduledDrafts={scheduledDrafts}
          impromptuDrafts={impromptuDrafts}
          busy={busy}
          impromptuDate={impromptuDate}
          setImpromptuDate={setImpromptuDate}
          onRefresh={() => void loadStage("hub")}
          onPatch={patchPost}
          onAction={postAction}
          onSubmit={submitLane}
        />
      ) : null}

      {tab === "impromptu" ? (
        <ImpromptuGenerationPanel
          disabled={!aiStatus.configured || !aiStatus.niBrain}
          onSaved={async () => {
            setNotice("Impromptu draft saved into CONTENT HUB.");
            await loadStage("hub");
          }}
          setError={setError}
        />
      ) : null}

      {tab === "publishing" ? (
        <PublishingPanel posts={publishingPosts} busy={busy} onPatch={patchPost} onAction={postAction} />
      ) : null}

      {tab === "scheduled" ? (
        <ScheduledPostsPanel posts={scheduledPosts} busy={busy} onAction={postAction} />
      ) : null}

      {tab === "archives" ? <ArchivesPanel posts={archivedPosts} busy={busy} onAction={postAction} /> : null}
    </AdminPortalShell>
  );
}

function SectionHeader(props: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-black uppercase tracking-[0.12em] text-white">{props.title}</h2>
        {props.description ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/55">{props.description}</p> : null}
      </div>
      {props.actions ? <div className="flex shrink-0 flex-wrap gap-2">{props.actions}</div> : null}
    </div>
  );
}

function MediaPreview({ post }: { post: ClientContentCalendarV2Post }) {
  if (post.postType === "Text") return null;
  if (post.mediaStatus === "generating") return <AdminLoadingBar label="Generating media..." />;
  if (!post.mediaUrls.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-xs text-white/45">
        No media generated yet. Use ADJUST from Content Hub drafts.
      </div>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {post.mediaUrls.map((url, index) => (
        <a
          key={`${url}_${index}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="group overflow-hidden rounded-xl border border-white/[0.08] bg-black/30"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`${post.postType} media ${index + 1}`} className="h-36 w-full object-cover transition group-hover:opacity-85" />
          <span className="block px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white/45">
            Open media {index + 1}
          </span>
        </a>
      ))}
    </div>
  );
}

function EditablePostBubble(props: {
  post: ClientContentCalendarV2Post;
  mode: "hub" | "publishing" | "scheduled" | "archived";
  busy: boolean;
  onPatch?: (id: string, fields: Partial<ClientContentCalendarV2Post>) => Promise<void>;
  onAction: (id: string, body: Record<string, unknown>, success?: string) => Promise<void>;
}) {
  const { post } = props;
  const [caption, setCaption] = useState(post.caption);
  const [visualPrompt, setVisualPrompt] = useState(post.visualPrompt ?? "");
  const [hashtags, setHashtags] = useState(post.hashtags);
  const [theme, setTheme] = useState(post.theme);
  const [targetGroup, setTargetGroup] = useState(post.targetGroup);
  const [cta, setCta] = useState(post.cta);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(post.platformList);
  const [scheduleAt, setScheduleAt] = useState(defaultScheduleValue(post));
  const [platformCaptions, setPlatformCaptions] = useState(post.platformCaptions);
  const [platformHashtags, setPlatformHashtags] = useState(post.platformHashtags);

  useEffect(() => {
    queueMicrotask(() => {
      setCaption(post.caption);
      setVisualPrompt(post.visualPrompt ?? "");
      setHashtags(post.hashtags);
      setTheme(post.theme);
      setTargetGroup(post.targetGroup);
      setCta(post.cta);
      setSelectedPlatforms(post.platformList);
      setPlatformCaptions(post.platformCaptions);
      setPlatformHashtags(post.platformHashtags);
      setScheduleAt(defaultScheduleValue(post));
    });
  }, [post]);

  const editable = props.mode === "hub" || props.mode === "publishing";
  const isOptimized = post.optimizeStatus === "done";

  async function saveEdits() {
    await props.onPatch?.(post.id, {
      caption,
      visualPrompt: post.postType === "Text" ? null : visualPrompt,
      hashtags,
      theme,
      targetGroup,
      cta,
      platformCaptions,
      platformHashtags,
    });
  }

  function togglePlatform(platform: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  }

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4 shadow-[0_24px_80px_-52px_rgba(227,43,43,0.5)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FFD34E]">
            {CONTENT_CALENDAR_TYPE_ICONS[post.postType]} {post.postType} | {post.contentLane.toUpperCase()} | {post.workflowStage.toUpperCase()}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-white/40">
            {post.postDate || "No date"} | {post.targetGroup}
          </p>
          {post.approvedAt ? <p className="mt-1 text-[10px] font-bold uppercase text-emerald-200">Approved</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {props.mode === "hub" ? (
            <>
              <button
                type="button"
                className={adminAccentButtonClass}
                disabled={props.busy || post.approvedAt !== null}
                onClick={() => props.onAction(post.id, { action: "approve" }, "Post approved.")}
              >
                APPROVE
              </button>
              {post.postType !== "Text" ? (
                <button
                  type="button"
                  className={adminSecondaryButtonClass}
                  disabled={props.busy}
                  onClick={() => props.onAction(post.id, { action: "adjust_media" }, "Media adjusted.")}
                >
                  ADJUST
                </button>
              ) : null}
              {post.postType === "Video" ? (
                <a
                  href={GEMINI_FLOW_VIDEO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={adminSecondaryButtonClass}
                  title="Generate this video in Gemini Flow (jonnybooth22), then attach the MP4 here"
                >
                  OPEN GEMINI FLOW
                </a>
              ) : null}
              <button
                type="button"
                className={adminSecondaryButtonClass}
                disabled={props.busy}
                onClick={() => props.onAction(post.id, { action: "archive" }, "Post archived.")}
              >
                ARCHIVE
              </button>
            </>
          ) : null}
          {props.mode === "publishing" ? (
            <>
              <button
                type="button"
                className={adminSecondaryButtonClass}
                disabled={props.busy}
                onClick={() => props.onAction(post.id, { action: "back_to_drafts" }, "Post moved back to drafts.")}
              >
                BACK TO DRAFTS
              </button>
              <button
                type="button"
                className={adminPrimaryButtonClass}
                disabled={props.busy || selectedPlatforms.length < 1 || post.optimizeStatus === "running"}
                onClick={() => props.onAction(post.id, { action: "optimize", platforms: selectedPlatforms }, "Optimization started.")}
              >
                OPTIMIZE
              </button>
            </>
          ) : null}
          {props.mode === "archived" ? (
            <button
              type="button"
              className={adminAccentButtonClass}
              disabled={props.busy}
              onClick={() => props.onAction(post.id, { action: "revive" }, "Post revived to Content Hub.")}
            >
              REVIVE
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid gap-3 lg:grid-cols-3">
          <label>
            <span className={adminLabelClass}>Theme</span>
            <input className={`${adminInputClassSm} mt-1`} value={theme} disabled={!editable} onChange={(e) => setTheme(e.target.value)} />
          </label>
          <label>
            <span className={adminLabelClass}>Target Audience</span>
            <select className={`${adminInputClassSm} mt-1`} value={targetGroup} disabled={!editable} onChange={(e) => setTargetGroup(e.target.value as ContentCalendarGroup)}>
              {CONTENT_CALENDAR_GROUPS.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={adminLabelClass}>CTA</span>
            <input className={`${adminInputClassSm} mt-1`} value={cta} disabled={!editable} onChange={(e) => setCta(e.target.value)} />
          </label>
        </div>

        <MediaPreview post={post} />

        {post.postType !== "Text" ? (
          <label>
            <span className={adminLabelClass}>Media Preview / Hyperlink Prompt</span>
            <textarea
              className={`${adminInputClassSm} mt-1 min-h-[82px]`}
              value={visualPrompt}
              disabled={!editable || props.mode === "publishing"}
              onChange={(e) => setVisualPrompt(e.target.value)}
            />
          </label>
        ) : null}

        <label>
          <span className={adminLabelClass}>{post.postType === "Text" ? "Text Post" : "Caption"}</span>
          <textarea className={`${adminInputClassSm} mt-1 min-h-[130px]`} value={caption} disabled={!editable} onChange={(e) => setCaption(e.target.value)} />
        </label>

        <div>
          <span className={adminLabelClass}>Hashtags</span>
          <ContentHashtagTagInput tags={hashtags} onChange={setHashtags} readOnly={!editable} />
        </div>

        {editable ? (
          <button type="button" className={adminSecondaryButtonClass} disabled={props.busy} onClick={() => void saveEdits()}>
            SAVE EDITS
          </button>
        ) : null}
      </div>

      {props.mode === "publishing" ? (
        <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-4">
          <div>
            <p className={adminLabelClass}>Platform Checkboxes</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {post.platformList.map((platform) => (
                <label key={platform} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70">
                  <input type="checkbox" checked={selectedPlatforms.includes(platform)} onChange={() => togglePlatform(platform)} />
                  {platform}
                </label>
              ))}
            </div>
          </div>
          {post.optimizeStatus === "running" ? <AdminLoadingBar label="Optimizing platform captions..." /> : null}
          {post.optimizeStatus === "failed" ? <AdminPortalAlert>{post.optimizeError ?? "Optimization failed."}</AdminPortalAlert> : null}
          {isOptimized ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {selectedPlatforms.map((platform) => (
                <div key={platform} className="rounded-xl border border-white/[0.06] bg-[#0E1016]/80 p-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-[#FFD34E]">{platform}</p>
                  <textarea
                    className={`${adminInputClassSm} mt-2 min-h-[110px]`}
                    value={platformCaptions[platform] ?? caption}
                    onChange={(e) => setPlatformCaptions((prev) => ({ ...prev, [platform]: e.target.value }))}
                  />
                  <div className="mt-2">
                    <ContentHashtagTagInput
                      tags={platformHashtags[platform] ?? hashtags}
                      onChange={(tags) => setPlatformHashtags((prev) => ({ ...prev, [platform]: tags }))}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-72">
              <span className={adminLabelClass}>Confirm / Adjust Datetime</span>
              <input className={`${adminInputClassSm} mt-1`} type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
            </label>
            <button
              type="button"
              className={adminPrimaryButtonClass}
              disabled={props.busy || !scheduleAt}
              onClick={async () => {
                await saveEdits();
                await props.onAction(post.id, { action: "schedule", scheduledAt: new Date(scheduleAt).toISOString() }, "Post scheduled.");
              }}
            >
              SCHEDULE
            </button>
          </div>
        </div>
      ) : null}

      {props.mode === "scheduled" ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          <p className="text-sm text-white/60">
            When: <span className="font-bold text-white">{post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : "Not set"}</span> | Platforms: {post.platformList.join(", ")}
          </p>
          <button
            type="button"
            className={adminSecondaryButtonClass}
            disabled={props.busy}
            onClick={() => props.onAction(post.id, { action: "cancel_scheduled" }, "Scheduled post cancelled back to Content Hub.")}
          >
            CANCEL
          </button>
        </div>
      ) : null}
    </article>
  );
}

function ContentHubV2Panel(props: {
  scheduledDrafts: ClientContentCalendarV2Post[];
  impromptuDrafts: ClientContentCalendarV2Post[];
  busy: string | null;
  impromptuDate: string;
  setImpromptuDate: (value: string) => void;
  onRefresh: () => void;
  onPatch: (id: string, fields: Partial<ClientContentCalendarV2Post>) => Promise<void>;
  onAction: (id: string, body: Record<string, unknown>, success?: string) => Promise<void>;
  onSubmit: (lane: Lane) => Promise<void>;
}) {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[#FF7E00]/30 bg-[#FF7E00]/10 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FFD34E]">SCHEDULED DRAFTS</p>
        <p className="mt-2 text-sm leading-relaxed text-white/75">
          Match Fit posts 4/day Monday-Friday: Static, Carousel, Text, Video. Weekly Planner approval generates the
          day into this lane; media is generated during approval and can be regenerated with ADJUST before Publishing.
        </p>
      </section>

      <section className={adminCardClass}>
        <SectionHeader
          title="SCHEDULED DRAFTS"
          description="Approve individual bubbles, then SUBMIT moves only approved posts into PUBLISHING."
          actions={
            <>
              <button type="button" className={adminSecondaryButtonClass} onClick={props.onRefresh}>REFRESH</button>
              <button
                type="button"
                className={adminPrimaryButtonClass}
                disabled={props.busy === "submit_scheduled"}
                onClick={() => void props.onSubmit("scheduled")}
              >
                SUBMIT
              </button>
            </>
          }
        />
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {props.scheduledDrafts.map((post) => (
            <EditablePostBubble
              key={post.id}
              post={post}
              mode="hub"
              busy={props.busy === post.id}
              onPatch={props.onPatch}
              onAction={props.onAction}
            />
          ))}
        </div>
        {!props.scheduledDrafts.length ? <EmptyState text="No scheduled drafts yet. Approve a Weekly Planner day first." /> : null}
      </section>

      <section className={adminCardClass}>
        <SectionHeader
          title="IMPROMPTU DRAFTS"
          description="Same bubble rules. SUBMIT requires a post date before moving approved impromptu posts into PUBLISHING."
          actions={
            <div className="flex flex-wrap items-end gap-2">
              <label>
                <span className={adminLabelClass}>Post Date</span>
                <input
                  className={`${adminInputClassSm} mt-1`}
                  type="date"
                  value={props.impromptuDate}
                  onChange={(e) => props.setImpromptuDate(e.target.value)}
                />
              </label>
              <button
                type="button"
                className={adminPrimaryButtonClass}
                disabled={props.busy === "submit_impromptu" || !props.impromptuDate}
                onClick={() => void props.onSubmit("impromptu")}
              >
                SUBMIT
              </button>
            </div>
          }
        />
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {props.impromptuDrafts.map((post) => (
            <EditablePostBubble
              key={post.id}
              post={post}
              mode="hub"
              busy={props.busy === post.id}
              onPatch={props.onPatch}
              onAction={props.onAction}
            />
          ))}
        </div>
        {!props.impromptuDrafts.length ? <EmptyState text="No impromptu drafts yet. Generate and approve one from the Impromptu tab." /> : null}
      </section>
    </div>
  );
}

function WeeklyPlannerPanel(props: {
  disabled: boolean;
  onApproved: () => Promise<void>;
  setError: (error: string | null) => void;
}) {
  const [plans, setPlans] = useState<DayPlan[]>(() => buildDefaultPlan());
  const [expanded, setExpanded] = useState<number>(0);
  const [busyDay, setBusyDay] = useState<number | null>(null);
  const weekStart = plans[0]?.date ?? formatCalendarDate(nextMonday());

  function updatePlan(dayIndex: number, patch: Partial<DayPlan>) {
    setPlans((prev) => prev.map((plan) => (plan.dayIndex === dayIndex ? { ...plan, ...patch } : plan)));
  }

  function updatePrompt(dayIndex: number, postType: ContentCalendarPostType, value: string) {
    setPlans((prev) =>
      prev.map((plan) =>
        plan.dayIndex === dayIndex
          ? { ...plan, prompts: { ...plan.prompts, [postType]: value } }
          : plan,
      ),
    );
  }

  async function approveDay(plan: DayPlan) {
    setBusyDay(plan.dayIndex);
    props.setError(null);
    try {
      const res = await fetch("/api/admin/content-calendar/v2/weekly", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart,
          dayIndex: plan.dayIndex,
          theme: plan.theme,
          targetAudience: plan.targetAudience,
          cta: plan.cta,
          prompts: plan.prompts,
        }),
      });
      await readApi(res, "Could not approve weekly planner day.");
      await props.onApproved();
    } catch (e) {
      props.setError(e instanceof Error ? e.message : "Could not approve weekly planner day.");
    } finally {
      setBusyDay(null);
    }
  }

  return (
    <section className={adminCardClass}>
      <SectionHeader
        title="WEEKLY PLANNER"
        description="Coming week: each day locks a theme, target audience, CTA, and four post prompts. Adjust before approving a day."
      />
      <div className="mt-5 space-y-3">
        {plans.map((plan) => (
          <div key={plan.dayIndex} className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/80">
            <button
              type="button"
              className="flex w-full flex-col gap-2 px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between"
              onClick={() => setExpanded(expanded === plan.dayIndex ? -1 : plan.dayIndex)}
            >
              <span>
                <span className="text-sm font-black uppercase tracking-[0.12em] text-[#FFD34E]">{plan.label} | {plan.date}</span>
                <span className="mt-1 block text-sm text-white/60">{plan.theme} | {plan.targetAudience} | {plan.cta}</span>
              </span>
              <span className="text-xs font-black uppercase text-white/40">{expanded === plan.dayIndex ? "Collapse" : "Expand"}</span>
            </button>
            {expanded === plan.dayIndex ? (
              <div className="space-y-4 border-t border-white/[0.06] p-4">
                <div className="grid gap-3 lg:grid-cols-3">
                  <label>
                    <span className={adminLabelClass}>Day Theme</span>
                    <input className={`${adminInputClassSm} mt-1`} value={plan.theme} onChange={(e) => updatePlan(plan.dayIndex, { theme: e.target.value })} />
                  </label>
                  <label>
                    <span className={adminLabelClass}>Target Audience</span>
                    <select
                      className={`${adminInputClassSm} mt-1`}
                      value={plan.targetAudience}
                      onChange={(e) => updatePlan(plan.dayIndex, { targetAudience: e.target.value as ContentCalendarGroup })}
                    >
                      {CONTENT_CALENDAR_GROUPS.map((group) => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={adminLabelClass}>CTA</span>
                    <input className={`${adminInputClassSm} mt-1`} value={plan.cta} onChange={(e) => updatePlan(plan.dayIndex, { cta: e.target.value })} />
                  </label>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {POST_ORDER.map((postType) => (
                    <label key={postType}>
                      <span className={adminLabelClass}>{postType} Prompt</span>
                      <textarea
                        className={`${adminInputClassSm} mt-1 min-h-[96px]`}
                        value={plan.prompts[postType]}
                        onChange={(e) => updatePrompt(plan.dayIndex, postType, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className={adminPrimaryButtonClass}
                  disabled={props.disabled || busyDay === plan.dayIndex}
                  onClick={() => void approveDay(plan)}
                >
                  {busyDay === plan.dayIndex ? "GENERATING..." : "APPROVE DAY"}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function ImpromptuGenerationPanel(props: {
  disabled: boolean;
  onSaved: () => Promise<void>;
  setError: (error: string | null) => void;
}) {
  const [counts, setCounts] = useState<Record<ContentCalendarPostType, number>>({
    Static: 1,
    Carousel: 1,
    Text: 1,
    Video: 0,
  } as Record<ContentCalendarPostType, number>);
  const [audience, setAudience] = useState<ContentCalendarGroup>("Join the Team");
  const [prompt, setPrompt] = useState("Create urgent, specific Match Fit posts based on what is happening today.");
  const [drafts, setDrafts] = useState<BulkGeneratedDraft[]>([]);
  const [generating, setGenerating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const weekStart = useMemo(() => formatCalendarDate(nextMonday()), []);

  async function generate() {
    setGenerating(true);
    props.setError(null);
    try {
      const items = CONTENT_CALENDAR_POST_TYPES.flatMap((postType) =>
        Array.from({ length: counts[postType] ?? 0 }, (_, i) => ({
          postType,
          targetGroup: audience,
          indexWithinType: i + 1,
        })),
      );
      const res = await fetch("/api/admin/content-calendar/v2/impromptu", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, customPrompt: prompt, weekStart }),
      });
      const data = await readApi<{ drafts: BulkGeneratedDraft[] }>(res, "Impromptu generation failed.");
      setDrafts(data.drafts ?? []);
    } catch (e) {
      props.setError(e instanceof Error ? e.message : "Impromptu generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function approveDraft(draft: BulkGeneratedDraft) {
    setSavingId(draft.tempId);
    props.setError(null);
    try {
      const res = await fetch("/api/admin/content-calendar/v2/posts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          weekStart,
          lane: "impromptu",
          theme: prompt.slice(0, 500),
          cta: "Operator-selected impromptu CTA",
          generateMedia: true,
        }),
      });
      await readApi(res, "Could not save impromptu draft.");
      setDrafts((prev) => prev.filter((d) => d.tempId !== draft.tempId));
      await props.onSaved();
    } catch (e) {
      props.setError(e instanceof Error ? e.message : "Could not save impromptu draft.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className={adminCardClass}>
      <SectionHeader
        title="IMPROMPTU CONTENT GENERATION"
        description="Adapted from the live Bulk Content Generator: choose type counts, audience, prompt, generate, edit drafts, then approve into Content Hub IMPROMPTU DRAFTS with media ready."
      />
      <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4 rounded-2xl border border-white/[0.06] bg-[#0E1016]/80 p-4">
          <div className="grid grid-cols-2 gap-3">
            {CONTENT_CALENDAR_POST_TYPES.map((postType) => (
              <label key={postType}>
                <span className={adminLabelClass}>{postType}</span>
                <input
                  className={`${adminInputClassSm} mt-1`}
                  type="number"
                  min={0}
                  max={8}
                  value={counts[postType] ?? 0}
                  onChange={(e) => setCounts((prev) => ({ ...prev, [postType]: Math.max(0, Number(e.target.value) || 0) }))}
                />
              </label>
            ))}
          </div>
          <label>
            <span className={adminLabelClass}>Target Audience</span>
            <select className={`${adminInputClassSm} mt-1`} value={audience} onChange={(e) => setAudience(e.target.value as ContentCalendarGroup)}>
              {CONTENT_CALENDAR_GROUPS.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={adminLabelClass}>Operator Prompt</span>
            <textarea className={`${adminInputClassSm} mt-1 min-h-[140px]`} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </label>
          <button type="button" className={adminPrimaryButtonClass} disabled={props.disabled || generating} onClick={() => void generate()}>
            {generating ? "GENERATING..." : "GENERATE IMPROMPTU DRAFTS"}
          </button>
        </div>
        <div className="space-y-4">
          {drafts.map((draft) => (
            <DraftBubble
              key={draft.tempId}
              draft={draft}
              saving={savingId === draft.tempId}
              onChange={(next) => setDrafts((prev) => prev.map((d) => (d.tempId === next.tempId ? next : d)))}
              onApprove={() => void approveDraft(draft)}
            />
          ))}
          {!drafts.length ? <EmptyState text="Generated impromptu drafts will appear here." /> : null}
        </div>
      </div>
    </section>
  );
}

function DraftBubble(props: {
  draft: BulkGeneratedDraft;
  saving: boolean;
  onChange: (draft: BulkGeneratedDraft) => void;
  onApprove: () => void;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#FFD34E]">
          {CONTENT_CALENDAR_TYPE_ICONS[props.draft.postType]} {props.draft.postType} | {props.draft.targetGroup}
        </p>
        <button type="button" className={adminAccentButtonClass} disabled={props.saving} onClick={props.onApprove}>
          {props.saving ? "SAVING..." : "APPROVE"}
        </button>
      </div>
      {props.draft.postType !== "Text" ? (
        <label className="mt-3 block">
          <span className={adminLabelClass}>Media Prompt</span>
          <textarea
            className={`${adminInputClassSm} mt-1 min-h-[82px]`}
            value={props.draft.visualPrompt ?? ""}
            onChange={(e) => props.onChange({ ...props.draft, visualPrompt: e.target.value })}
          />
        </label>
      ) : null}
      <label className="mt-3 block">
        <span className={adminLabelClass}>{props.draft.postType === "Text" ? "Text Post" : "Caption"}</span>
        <textarea
          className={`${adminInputClassSm} mt-1 min-h-[120px]`}
          value={props.draft.caption}
          onChange={(e) => props.onChange({ ...props.draft, caption: e.target.value })}
        />
      </label>
      <div className="mt-3">
        <ContentHashtagTagInput tags={props.draft.hashtags} onChange={(hashtags) => props.onChange({ ...props.draft, hashtags })} />
      </div>
    </article>
  );
}

function PublishingPanel(props: {
  posts: ClientContentCalendarV2Post[];
  busy: string | null;
  onPatch: (id: string, fields: Partial<ClientContentCalendarV2Post>) => Promise<void>;
  onAction: (id: string, body: Record<string, unknown>, success?: string) => Promise<void>;
}) {
  return (
    <section className={adminCardClass}>
      <SectionHeader
        title="PUBLISHING"
        description="Edit text here. To regenerate media, use BACK TO DRAFTS and ADJUST from Content Hub. OPTIMIZE requires at least one platform checked and continues while this tab is open or on revisit."
      />
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {props.posts.map((post) => (
          <EditablePostBubble
            key={post.id}
            post={post}
            mode="publishing"
            busy={props.busy === post.id}
            onPatch={props.onPatch}
            onAction={props.onAction}
          />
        ))}
      </div>
      {!props.posts.length ? <EmptyState text="No posts in Publishing. Submit approved drafts from Content Hub." /> : null}
    </section>
  );
}

function ScheduledPostsPanel(props: {
  posts: ClientContentCalendarV2Post[];
  busy: string | null;
  onAction: (id: string, body: Record<string, unknown>, success?: string) => Promise<void>;
}) {
  return (
    <section className={adminCardClass}>
      <SectionHeader title="SCHEDULED POSTS" description="Scheduled posts list when and platforms. Cancel returns each post to its origin lane in Content Hub." />
      <div className="mt-5 space-y-4">
        {props.posts.map((post) => (
          <EditablePostBubble key={post.id} post={post} mode="scheduled" busy={props.busy === post.id} onAction={props.onAction} />
        ))}
      </div>
      {!props.posts.length ? <EmptyState text="No scheduled posts yet." /> : null}
    </section>
  );
}

function ArchivesPanel(props: {
  posts: ClientContentCalendarV2Post[];
  busy: string | null;
  onAction: (id: string, body: Record<string, unknown>, success?: string) => Promise<void>;
}) {
  return (
    <section className={adminCardClass}>
      <SectionHeader title="ARCHIVES" description="Archived drafts have a 72-hour revive window. Revive returns each post to its original Content Hub lane." />
      <div className="mt-5 space-y-4">
        {props.posts.map((post) => (
          <EditablePostBubble key={post.id} post={post} mode="archived" busy={props.busy === post.id} onAction={props.onAction} />
        ))}
      </div>
      {!props.posts.length ? <EmptyState text="No archived v2 drafts." /> : null}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/45">
      {text}
    </div>
  );
}
