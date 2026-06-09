"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import {
  AdminPortalAlert,
  AdminPortalBetaNotice,
  AdminLoadingBar,
  adminAccentButtonClass,
  adminInputClassSm,
  adminLabelClass,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import {
  CONTENT_CALENDAR_CONTENT_TYPES,
  CONTENT_CALENDAR_DAYS_LONG,
  CONTENT_CALENDAR_DAYS_SHORT,
  CONTENT_CALENDAR_GENERATOR_POST_TYPES,
  CONTENT_CALENDAR_PLATFORMS_BY_TYPE,
  CONTENT_CALENDAR_POST_TYPES,
  CONTENT_CALENDAR_TONES,
  CONTENT_CALENDAR_TYPE_ICONS,
  type ContentCalendarGeneratorPostType,
} from "@/lib/content-calendar/constants";
import {
  formatCalendarDate,
  getContentCalendarRotation,
  getMondayOfWeek,
  shortCalendarDate,
} from "@/lib/content-calendar/rotation";
import { shouldShowMissedPrompt } from "@/lib/content-calendar/schedule-utils";
import type { ClientContentPost } from "@/lib/content-calendar/content-calendar-store";

type AiStatus = {
  configured: boolean;
  niBrain: boolean;
  media: boolean;
  message: string;
};

type GeneratorResult = {
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  dmScript?: string;
};

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={adminSecondaryButtonClass}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

const REGENERATE_SUGGESTIONS = [
  "Make it shorter and punchier",
  "More energetic tone",
  "Stronger Atlanta local angle",
  "Better hashtags for reach",
  "Clearer call to action",
];

function RegenerateFeedbackModal(props: {
  title: string;
  busy: boolean;
  feedback: string;
  onFeedbackChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={props.onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12151C] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-black uppercase tracking-[0.12em] text-[#FFD34E]">{props.title}</p>
        <p className="mt-2 text-sm text-white/55">
          What should change? Pick a suggestion or describe the adjustments you want.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {REGENERATE_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className={adminSecondaryButtonClass}
              onClick={() => props.onFeedbackChange(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <textarea
          className={`${adminInputClassSm} mt-3`}
          rows={4}
          placeholder="Describe what to adjust (tone, length, audience, CTA, hashtags…)"
          value={props.feedback}
          onChange={(e) => props.onFeedbackChange(e.target.value)}
        />
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className={adminSecondaryButtonClass} disabled={props.busy} onClick={props.onClose}>
            Cancel
          </button>
          <button type="button" className={adminPrimaryButtonClass} disabled={props.busy} onClick={props.onConfirm}>
            {props.busy ? "Regenerating…" : "Regenerate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MissedPostBubble(props: {
  post: ClientContentPost;
  onReschedule: (id: string, newDate: string) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [newDate, setNewDate] = useState(props.post.postDate);
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-[#FF7E00]/35 bg-[#12151C]/95 p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#FF7E00]">Missed post</p>
        <button
          type="button"
          className="rounded-lg border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/50 hover:text-white/80"
          onClick={props.onClose}
          aria-label="Close missed post notice"
        >
          Close
        </button>
      </div>
      <p className="mt-2 text-sm text-white/75">
        {props.post.postType} for {CONTENT_CALENDAR_DAYS_LONG[props.post.dayIndex]} was not marked posted. Change the
        post date?
      </p>
      {!showPicker ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className={adminAccentButtonClass}
            onClick={() => setShowPicker(true)}
          >
            Yes
          </button>
          <button
            type="button"
            className={adminSecondaryButtonClass}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void props.onDismiss(props.post.id).finally(() => setBusy(false));
            }}
          >
            No
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <label className={adminLabelClass}>New post date</label>
          <input type="date" className={adminInputClassSm} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <button
            type="button"
            className={`${adminPrimaryButtonClass} min-h-0 py-2.5 text-xs`}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void props.onReschedule(props.post.id, newDate).finally(() => setBusy(false));
            }}
          >
            Save new date
          </button>
        </div>
      )}
    </div>
  );
}

export function ContentCalendarClient(props: { aiStatus: AiStatus }) {
  const [tab, setTab] = useState<"calendar" | "generator">("calendar");
  const [weekStart, setWeekStart] = useState(() => formatCalendarDate(getMondayOfWeek()));
  const [offset, setOffset] = useState(7);
  const [posts, setPosts] = useState<ClientContentPost[]>([]);
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socialSummary, setSocialSummary] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [missedPosts, setMissedPosts] = useState<ClientContentPost[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { caption: string; visualPrompt: string | null }>>({});
  const [missedBubbleDismissed, setMissedBubbleDismissed] = useState(false);
  const [regenModal, setRegenModal] = useState<
    { mode: "single"; post: ClientContentPost } | { mode: "all" } | null
  >(null);
  const [regenFeedback, setRegenFeedback] = useState("");
  const [regenBusy, setRegenBusy] = useState(false);

  const baseMonday = useMemo(() => new Date(`${weekStart}T00:00:00`), [weekStart]);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/content-calendar/schedule?weekStart=${weekStart}`, {
        credentials: "include",
      });
      const data = (await res.json()) as { posts?: ClientContentPost[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load schedule.");
      setPosts(data.posts ?? []);
      const nextDrafts: Record<string, { caption: string; visualPrompt: string | null }> = {};
      for (const p of data.posts ?? []) {
        nextDrafts[p.id] = { caption: p.caption, visualPrompt: p.visualPrompt };
      }
      setDrafts(nextDrafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load schedule.");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  const loadMissed = useCallback(async () => {
    const res = await fetch("/api/admin/content-calendar/missed", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { posts?: ClientContentPost[] };
    setMissedPosts(data.posts ?? []);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadSchedule();
      void loadMissed();
    });
  }, [loadSchedule, loadMissed]);

  async function generateWeek() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/content-calendar/schedule", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, offset }),
      });
      const data = (await res.json()) as { posts?: ClientContentPost[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      setPosts(data.posts ?? []);
      const nextDrafts: Record<string, { caption: string; visualPrompt: string | null }> = {};
      for (const p of data.posts ?? []) {
        nextDrafts[p.id] = { caption: p.caption, visualPrompt: p.visualPrompt };
      }
      setDrafts(nextDrafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function savePost(post: ClientContentPost) {
    const draft = drafts[post.id];
    if (!draft) return;
    const res = await fetch(`/api/admin/content-calendar/posts/${post.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: draft.caption,
        visualPrompt: draft.visualPrompt,
        originalCaption: post.caption,
        originalVisualPrompt: post.visualPrompt,
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not save edits.");
    }
  }

  async function deletePost(id: string) {
    const res = await fetch(`/api/admin/content-calendar/posts/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not delete post.");
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  async function deleteAllPosts() {
    const res = await fetch(`/api/admin/content-calendar/schedule?weekStart=${weekStart}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not delete posts.");
      return;
    }
    setPosts([]);
    setDrafts({});
  }

  async function confirmRegenerate() {
    if (!regenModal) return;
    setRegenBusy(true);
    setError(null);
    try {
      if (regenModal.mode === "all") {
        const res = await fetch("/api/admin/content-calendar/schedule", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekStart,
            offset,
            regenerateAll: true,
            feedback: regenFeedback.trim() || undefined,
          }),
        });
        const data = (await res.json()) as { posts?: ClientContentPost[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Regeneration failed.");
        setPosts(data.posts ?? []);
        const nextDrafts: Record<string, { caption: string; visualPrompt: string | null }> = {};
        for (const p of data.posts ?? []) {
          nextDrafts[p.id] = { caption: p.caption, visualPrompt: p.visualPrompt };
        }
        setDrafts(nextDrafts);
      } else {
        const post = regenModal.post;
        const draft = drafts[post.id];
        const res = await fetch(`/api/admin/content-calendar/posts/${post.id}/actions`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "regenerate",
            weekStart,
            offset,
            dayIndex: post.dayIndex,
            postType: post.postType,
            feedback: regenFeedback.trim() || undefined,
            existingCaption: draft?.caption ?? post.caption,
            existingVisualPrompt: draft?.visualPrompt ?? post.visualPrompt,
          }),
        });
        const data = (await res.json()) as { post?: ClientContentPost; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Regeneration failed.");
        if (data.post) {
          setPosts((prev) => prev.map((p) => (p.id === data.post!.id ? data.post! : p)));
          setDrafts((prev) => ({
            ...prev,
            [data.post!.id]: { caption: data.post!.caption, visualPrompt: data.post!.visualPrompt },
          }));
        }
      }
      setRegenModal(null);
      setRegenFeedback("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed.");
    } finally {
      setRegenBusy(false);
    }
  }

  async function markPosted(id: string) {
    const res = await fetch(`/api/admin/content-calendar/posts/${id}/actions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "posted" }),
    });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      void loadMissed();
    }
  }

  async function generateMedia(post: ClientContentPost) {
    const prompt = drafts[post.id]?.visualPrompt ?? post.visualPrompt;
    if (!prompt) return;
    setError(null);
    const res = await fetch(`/api/admin/content-calendar/posts/${post.id}/actions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_media", prompt }),
    });
    const data = (await res.json()) as { mediaUrl?: string; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Media generation failed.");
      return;
    }
    if (data.mediaUrl) {
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, mediaUrl: data.mediaUrl!, mediaStatus: "ready" } : p)),
      );
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

  function exportWeek() {
    let out = "MATCH FIT — WEEKLY CONTENT EXPORT\n";
    out += `Week of ${baseMonday.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}\n`;
    out += "=".repeat(50) + "\n\n";
    CONTENT_CALENDAR_DAYS_SHORT.forEach((_, di) => {
      out += `${CONTENT_CALENDAR_DAYS_LONG[di].toUpperCase()} — ${shortCalendarDate(baseMonday, di)}\n${"─".repeat(30)}\n\n`;
      const dayPosts = posts.filter((p) => p.dayIndex === di);
      for (const p of dayPosts) {
        const cap = drafts[p.id]?.caption ?? p.caption;
        const prompt = drafts[p.id]?.visualPrompt ?? p.visualPrompt;
        out += `[${p.postType.toUpperCase()} · ${p.platforms} · ${p.targetGroup}]\n${cap}\n`;
        if (prompt) out += `\nVisual prompt:\n${prompt}\n`;
        if (p.hashtags.length) out += `\n${p.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}\n`;
        out += "\n\n";
      }
    });
    void navigator.clipboard.writeText(out);
  }

  const visibleDayIndexes =
    activeDay === null ? [0, 1, 2, 3, 4] : [activeDay];

  const bubblePost = missedBubbleDismissed ? null : missedPosts[0];

  return (
    <AdminPortalShell
      current="content-calendar"
      maxWidth="full"
      title="Content Calendar"
      description="Generate M–F social posts with video, carousel, and static prompts for Instagram, Threads, Facebook, and TikTok."
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
            NI Brain Supabase keys are not set. Add NI_BRAIN_SUPABASE_URL and NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY to
            Vercel production env or store them in platform_secrets (via bootstrap script), then redeploy.
          </AdminPortalAlert>
        ) : null}

        {!props.aiStatus.configured ? (
          <AdminPortalAlert variant="info">{props.aiStatus.message}</AdminPortalAlert>
        ) : null}

        {error ? <AdminPortalAlert>{error}</AdminPortalAlert> : null}

        {socialSummary ? (
          <section className={`${adminPanelClass} p-5`}>
            <p className={adminLabelClass}>Social performance insights</p>
            <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/70">{socialSummary}</pre>
          </section>
        ) : null}

        <div className="flex gap-2 border-b border-white/[0.06] pb-1">
          {(["calendar", "generator"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={
                tab === t
                  ? "border-b-2 border-[#FF7E00] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#FFD34E]"
                  : "px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/40 hover:text-white/70"
              }
              onClick={() => setTab(t)}
            >
              {t === "calendar" ? "Weekly calendar" : "AI generator"}
            </button>
          ))}
        </div>

        {tab === "calendar" ? (
          <div className="space-y-6">
            <section className={`${adminPanelClass} flex flex-wrap items-end gap-4 p-5`}>
              <div>
                <label className={adminLabelClass}>Week start</label>
                <input
                  type="date"
                  className={`${adminInputClassSm} mt-1`}
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                />
              </div>
              <div>
                <label className={adminLabelClass}>Day offset</label>
                <input
                  type="number"
                  min={0}
                  className={`${adminInputClassSm} mt-1 w-20`}
                  value={offset}
                  onChange={(e) => setOffset(Number.parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <button
                type="button"
                className={adminPrimaryButtonClass}
                disabled={generating || !props.aiStatus.configured}
                onClick={() => void generateWeek()}
              >
                {generating ? "Generating Week…" : "Generate Week"}
              </button>
              <button
                type="button"
                className={adminSecondaryButtonClass}
                disabled={!posts.length || generating}
                onClick={() => {
                  setRegenFeedback("");
                  setRegenModal({ mode: "all" });
                }}
              >
                Regenerate All
              </button>
              <button
                type="button"
                className={adminSecondaryButtonClass}
                disabled={!posts.length}
                onClick={() => void deleteAllPosts()}
              >
                Delete All
              </button>
              <button type="button" className={adminSecondaryButtonClass} onClick={exportWeek} disabled={!posts.length}>
                Export Week
              </button>
              <p className="ml-auto max-w-xs text-[10px] leading-relaxed text-white/35">
                Baseline rotation: Carousel→Atlanta Trainers · Static→Virtual Trainers · Video→Atlanta Clients ·
                Text→Virtual Clients
              </p>
            </section>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={activeDay === null ? adminAccentButtonClass : adminSecondaryButtonClass}
                onClick={() => setActiveDay(null)}
              >
                All days
              </button>
              {CONTENT_CALENDAR_DAYS_SHORT.map((_, di) => (
                <button
                  key={di}
                  type="button"
                  className={activeDay === di ? adminAccentButtonClass : adminSecondaryButtonClass}
                  onClick={() => setActiveDay(activeDay === di ? null : di)}
                >
                  {CONTENT_CALENDAR_DAYS_SHORT[di]}{" "}
                  <span className="opacity-50">{shortCalendarDate(baseMonday, di)}</span>
                </button>
              ))}
            </div>

            {loading ? <AdminLoadingBar label="Loading schedule…" /> : null}
            {generating ? <AdminLoadingBar label="AI is generating your week…" /> : null}

            {!loading && posts.length === 0 ? (
              <p className={`${adminPanelClass} p-6 text-sm text-white/55`}>
                No posts scheduled for this week. Click <strong className="text-[#FFD34E]">Generate week</strong> to
                create 20 M–F posts (4 types × 5 days) with captions, hashtags, and visual prompts.
              </p>
            ) : null}

            {visibleDayIndexes.map((di) => {
              const rot = getContentCalendarRotation(di, offset);
              const dayPosts = posts.filter((p) => p.dayIndex === di);
              if (!dayPosts.length) return null;
              return (
                <section key={di} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-[#FF7E00]">{CONTENT_CALENDAR_DAYS_LONG[di]}</h2>
                    <span className="text-xs text-white/35">{shortCalendarDate(baseMonday, di)}</span>
                    <div className="h-px flex-1 bg-[#FF7E00]/15" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {CONTENT_CALENDAR_POST_TYPES.map((type) => {
                      const post = dayPosts.find((p) => p.postType === type);
                      if (!post) {
                        return (
                          <div
                            key={`${di}-${type}`}
                            className={`${adminPanelClass} flex min-h-[12rem] flex-col items-center justify-center p-4 opacity-35`}
                          >
                            <span className="text-xs font-black uppercase tracking-[0.1em] text-white/50">
                              {CONTENT_CALENDAR_TYPE_ICONS[type]} {type}
                            </span>
                            <p className="mt-2 text-xs text-white/40">Not scheduled</p>
                          </div>
                        );
                      }
                      const draft = drafts[post.id] ?? { caption: post.caption, visualPrompt: post.visualPrompt };
                      const promKey = post.id;
                      const isPromptOpen = expandedPrompt === promKey;
                      const overdue = shouldShowMissedPrompt({
                        postDate: post.postDate,
                        posted: post.posted,
                        missedPromptDismissed: post.missedPromptDismissed,
                      });
                      return (
                        <article
                          key={post.id}
                          className={`${adminPanelClass} flex min-h-[12rem] flex-col p-4 ${overdue ? "ring-1 ring-amber-400/40" : ""}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-black uppercase tracking-[0.1em] text-[#FFD34E]">
                              {CONTENT_CALENDAR_TYPE_ICONS[type]} {type}
                            </span>
                            <span className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-white/45">
                              {rot[type]}
                            </span>
                          </div>
                          <p className="mt-2 text-[10px] uppercase tracking-wide text-white/35">{post.platforms}</p>
                          {post.hashtags.length ? (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <p className="text-[11px] text-white/40">
                                {post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
                              </p>
                              <CopyButton
                                text={post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
                                label="Copy hashtags"
                              />
                            </div>
                          ) : null}
                          <textarea
                            className={`${adminInputClassSm} mt-3`}
                            rows={5}
                            value={draft.caption}
                            onChange={(e) =>
                              setDrafts((p) => ({ ...p, [post.id]: { ...draft, caption: e.target.value } }))
                            }
                            onBlur={() => void savePost(post)}
                          />
                          {draft.visualPrompt !== null ? (
                            <>
                              <button
                                type="button"
                                className={`${adminSecondaryButtonClass} mt-2`}
                                onClick={() => setExpandedPrompt(isPromptOpen ? null : promKey)}
                              >
                                {isPromptOpen ? "Hide prompt" : "Visual prompt"}
                              </button>
                              {isPromptOpen ? (
                                <textarea
                                  className={`${adminInputClassSm} mt-2 border-dashed border-[#FF7E00]/25`}
                                  rows={4}
                                  value={draft.visualPrompt ?? ""}
                                  onChange={(e) =>
                                    setDrafts((p) => ({
                                      ...p,
                                      [post.id]: { ...draft, visualPrompt: e.target.value },
                                    }))
                                  }
                                  onBlur={() => void savePost(post)}
                                />
                              ) : null}
                            </>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <CopyButton text={draft.caption} label="Copy Caption" />
                            {draft.visualPrompt ? <CopyButton text={draft.visualPrompt} label="Copy Prompt" /> : null}
                            <button
                              type="button"
                              className={adminSecondaryButtonClass}
                              onClick={() => {
                                setRegenFeedback("");
                                setRegenModal({ mode: "single", post });
                              }}
                            >
                              Regenerate
                            </button>
                            <button
                              type="button"
                              className={adminSecondaryButtonClass}
                              onClick={() => void deletePost(post.id)}
                            >
                              Delete
                            </button>
                            {(type === "Static" || type === "Carousel") && props.aiStatus.media ? (
                              <button
                                type="button"
                                className={adminAccentButtonClass}
                                onClick={() => void generateMedia(post)}
                              >
                                Generate image
                              </button>
                            ) : null}
                            {post.mediaUrl ? (
                              <a
                                href={post.mediaUrl}
                                download={`match-fit-${post.postType.toLowerCase()}-${post.postDate}.png`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={adminSecondaryButtonClass}
                              >
                                Download media
                              </a>
                            ) : null}
                            <button
                              type="button"
                              className={`${adminAccentButtonClass} ml-auto`}
                              onClick={() => void markPosted(post.id)}
                            >
                              Mark posted
                            </button>
                          </div>
                          {post.mediaUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={post.mediaUrl} alt="" className="mt-3 max-h-48 rounded-xl border border-white/10" />
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <GeneratorPanel configured={props.aiStatus.configured} />
        )}

      {regenModal ? (
        <RegenerateFeedbackModal
          title={regenModal.mode === "all" ? "Regenerate entire week" : "Regenerate this post"}
          busy={regenBusy}
          feedback={regenFeedback}
          onFeedbackChange={setRegenFeedback}
          onClose={() => {
            if (!regenBusy) {
              setRegenModal(null);
              setRegenFeedback("");
            }
          }}
          onConfirm={() => void confirmRegenerate()}
        />
      ) : null}

      {bubblePost ? (
        <MissedPostBubble
          post={bubblePost}
          onClose={() => setMissedBubbleDismissed(true)}
          onDismiss={async (id) => {
            await fetch(`/api/admin/content-calendar/posts/${id}/actions`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "dismiss_missed" }),
            });
            void loadMissed();
          }}
          onReschedule={async (id, newDate) => {
            await fetch(`/api/admin/content-calendar/posts/${id}/actions`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "reschedule", newDate }),
            });
            void loadSchedule();
            void loadMissed();
          }}
        />
      ) : null}
    </AdminPortalShell>
  );
}

function GeneratorPanel(props: { configured: boolean }) {
  const [postType, setPostType] = useState<ContentCalendarGeneratorPostType>("Carousel");
  const [contentType, setContentType] = useState("Trainer Recruitment");
  const [tone, setTone] = useState("Bold / Direct");
  const [customNote, setCustomNote] = useState("");
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/content-calendar/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postType, contentType, tone, customNote }),
      });
      const data = (await res.json()) as { result?: GeneratorResult; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      setResult(data.result ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  const fullPost = result
    ? `${result.hook}\n\n${result.body}\n\n${result.cta}\n\n${result.hashtags?.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`
    : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className={`${adminPanelClass} space-y-5 p-5`}>
        <div>
          <p className={adminLabelClass}>Post type</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CONTENT_CALENDAR_GENERATOR_POST_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={postType === t ? adminAccentButtonClass : adminSecondaryButtonClass}
                onClick={() => setPostType(t)}
              >
                {CONTENT_CALENDAR_TYPE_ICONS[t]} {t}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-white/40">
            Platforms: {CONTENT_CALENDAR_PLATFORMS_BY_TYPE[postType]}
          </p>
        </div>
        <div>
          <p className={adminLabelClass}>Content type</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {CONTENT_CALENDAR_CONTENT_TYPES.map((c) => (
              <button
                key={c}
                type="button"
                className={`${c === contentType ? adminAccentButtonClass : adminSecondaryButtonClass} text-left`}
                onClick={() => setContentType(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={adminLabelClass}>Tone</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CONTENT_CALENDAR_TONES.map((t) => (
              <button
                key={t}
                type="button"
                className={tone === t ? adminAccentButtonClass : adminSecondaryButtonClass}
                onClick={() => setTone(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={adminLabelClass}>Prompt</p>
          <textarea
            className={`${adminInputClassSm} mt-2`}
            rows={3}
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="What should this post focus on?"
          />
        </div>
        <button
          type="button"
          className={adminPrimaryButtonClass}
          disabled={loading || !props.configured}
          onClick={() => void generate()}
        >
          {loading ? "Generating…" : "Generate Post"}
        </button>
        {error ? <p className="text-xs text-[#FFB4B4]">{error}</p> : null}
      </aside>

      <section className={`${adminPanelClass} min-h-[320px] p-6`}>
        {!result && !loading ? (
          <p className="text-sm text-white/40">Select options and generate a single post with hook, body, CTA, and hashtags.</p>
        ) : null}
        {loading ? <AdminLoadingBar label="AI is crafting your post…" /> : null}
        {result ? (
          <div className="space-y-4">
            <div className="flex justify-between gap-3">
              <p className={adminLabelClass}>Full post</p>
              <CopyButton text={fullPost} label="Copy full post" />
            </div>
            <div className="text-sm leading-relaxed text-white/75">
              <p className="font-semibold text-[#FF7E00]">{result.hook}</p>
              <p className="mt-3">{result.body}</p>
              <p className="mt-3 font-medium text-[#FFD34E]">{result.cta}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="text-xs text-white/40">
                  {result.hashtags?.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
                </p>
                {result.hashtags?.length ? (
                  <CopyButton
                    text={result.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
                    label="Copy hashtags"
                  />
                ) : null}
              </div>
            </div>
            {result.dmScript ? (
              <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4 text-sm italic text-white/55">
                {result.dmScript}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
