"use client";

import { useMemo, useState } from "react";
import {
  AdminPortalBackdrop,
  adminAccentButtonClass,
  adminCardClass,
  adminInputClassSm,
  adminLabelClass,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import type { BulkGeneratedDraft } from "@/lib/content-calendar/content-calendar-ai";
import {
  CONTENT_CALENDAR_BULK_DEFAULT_PROMPT,
  CONTENT_CALENDAR_BULK_MAX_COUNT,
  CONTENT_CALENDAR_GROUPS,
  CONTENT_CALENDAR_PLATFORM_OPTIONS_BY_TYPE,
  CONTENT_CALENDAR_POST_TYPES,
  CONTENT_CALENDAR_TYPE_ICONS,
  type ContentCalendarGroup,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import { normalizeTargetGroup } from "@/lib/content-calendar/content-rules";
import { ContentCaptionCharLimit } from "@/components/admin/content-caption-char-limit";
import type { ClientContentPost } from "@/lib/content-calendar/content-calendar-store";
import {
  ContentGeneratorPanel,
  ContentHubPanel,
  ScheduleCalendar,
  UnpostedPromptModal,
} from "@/app/admin/content-calendar/content-calendar-panels";

type Tab = "workflow" | "generator" | "bulk" | "hub";

const DEMO_HUB: ClientContentPost[] = [
  {
    id: "demo_1",
    weekStart: "2026-06-09",
    postDate: "2026-06-10",
    dayIndex: 1,
    postType: "Carousel",
    targetGroup: "Join the Team",
    platforms: "Instagram, Threads, Facebook, TikTok",
    caption: "Join the Team — beta spots are filling. Match Fit puts serious Fitness Pros in front of athletes ready to book.",
    visualPrompt: "Dark #07080C hero, orange #FF7E00 accent, Fitness Pro training client.",
    hashtags: ["MatchFit", "FitnessApp"],
    mediaUrl: null,
    mediaStatus: "none",
    posted: false,
    postedAt: null,
    missedPromptDismissed: false,
    savedToHubAt: "2026-06-09T10:00:00.000Z",
    isScheduled: true,
    purgeAfterAt: null,
    bulkSessionId: "demo_bulk",
    deletedAt: null,
  },
  {
    id: "demo_2",
    weekStart: "2026-06-09",
    postDate: "2026-06-08",
    dayIndex: 0,
    postType: "Video",
    targetGroup: "Clients",
    platforms: "Instagram Reels, TikTok",
    caption: "Swipe. Match. Train. Clients discover Fitness Pros without cold DMs.",
    visualPrompt: "UGC-style phone screen showing Match Fit swipe UI.",
    hashtags: ["MatchFit", "FitnessApp"],
    mediaUrl: null,
    mediaStatus: "none",
    posted: false,
    postedAt: null,
    missedPromptDismissed: false,
    savedToHubAt: "2026-06-09T09:30:00.000Z",
    isScheduled: true,
    purgeAfterAt: null,
    bulkSessionId: "demo_bulk",
    deletedAt: null,
  },
];

/** Interactive UI preview — demo data only, no API calls. */
export function ContentCalendarMockupClient() {
  const [tab, setTab] = useState<Tab>("workflow");
  const [showPrompt, setShowPrompt] = useState(false);
  const [hubPosts, setHubPosts] = useState(DEMO_HUB);

  const tabs = [
    { id: "workflow" as const, label: "Locked Workflow" },
    { id: "generator" as const, label: "Content Generator" },
    { id: "bulk" as const, label: "Bulk Content Generator" },
    { id: "hub" as const, label: "Content Hub" },
  ];

  const scheduledPosts = useMemo(() => hubPosts.filter((p) => p.isScheduled), [hubPosts]);

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] px-5 py-10 text-white sm:px-8 sm:py-12">
      <AdminPortalBackdrop />
      <div className="relative mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]">Interactive preview</p>
            <a href="/admin/preview" className={adminSecondaryButtonClass}>
              All previews
            </a>
          </div>
          <h1 className="text-3xl font-black tracking-tight">Content Calendar — UI mockup</h1>
          <p className="max-w-2xl text-sm text-white/55">
            Demo mode with sample data. Start on <strong>Locked Workflow</strong> to walk a post through ADJUST → SAVE
            EDITS → APPROVE → SCHEDULE → OPTIMIZE → PUBLISH, then explore the generator, bulk, and hub tabs.
          </p>
        </header>

        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/[0.08] px-4 py-3 text-sm leading-relaxed text-amber-100">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">Automations on HOLD</p>
          <p className="mt-1 text-amber-100/90">
            Preview only — all actions are local. PUBLISH only <strong>queues</strong> a post; nothing posts to any
            platform until JB says fire. Production uses live AI + NI Brain storage.
          </p>
        </div>

        <nav className="flex flex-wrap gap-2 border-b border-white/[0.06] pb-1">
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
          {tab === "hub" ? (
            <button
              type="button"
              className="ml-auto rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[10px] font-bold uppercase text-amber-100"
              onClick={() => setShowPrompt(true)}
            >
              Preview unposted alert
            </button>
          ) : null}
        </nav>

        {tab === "workflow" ? <LockedWorkflowDemo /> : null}

        {tab === "generator" ? <ContentGeneratorPanel configured /> : null}

        {tab === "bulk" ? (
          <BulkPreviewDemo onSaved={(draft) => {
            setHubPosts((prev) => [
              {
                id: `saved_${Date.now()}`,
                weekStart: "2026-06-09",
                postDate: draft.postDate ?? "2026-06-09",
                dayIndex: draft.dayIndex,
                postType: draft.postType,
                targetGroup: normalizeTargetGroup(draft.targetGroup),
                platforms: draft.platforms,
                caption: draft.caption,
                visualPrompt: draft.visualPrompt,
                hashtags: draft.hashtags,
                mediaUrl: null,
                mediaStatus: "none",
                posted: false,
                postedAt: null,
                missedPromptDismissed: false,
                savedToHubAt: new Date().toISOString(),
                isScheduled: Boolean(draft.postDate),
                purgeAfterAt: null,
                bulkSessionId: "preview",
                deletedAt: null,
              },
              ...prev,
            ]);
          }} />
        ) : null}

        {tab === "hub" ? (
          <ContentHubPanel
            posts={hubPosts}
            loading={false}
            onRefresh={() => undefined}
            onDelete={async (id) => setHubPosts((p) => p.filter((x) => x.id !== id))}
            onMarkPosted={async (id) => setHubPosts((p) => p.filter((x) => x.id !== id))}
            onUpdatePostDate={async (id, postDate) =>
              setHubPosts((p) => p.map((x) => (x.id === id ? { ...x, postDate, isScheduled: true } : x)))
            }
            onSaveFields={async (id, fields) =>
              setHubPosts((p) =>
                p.map((x) =>
                  x.id === id
                    ? { ...x, caption: fields.caption, visualPrompt: fields.visualPrompt, hashtags: fields.hashtags }
                    : x,
                ),
              )
            }
          />
        ) : null}

        {tab === "bulk" ? <ScheduleCalendar posts={scheduledPosts} title="Scheduled content calendar" /> : null}
      </div>

      {showPrompt && hubPosts[1] ? (
        <UnpostedPromptModal
          post={hubPosts[1]}
          busy={false}
          onDismiss={() => setShowPrompt(false)}
          onMarkPosted={async () => {
            setHubPosts((p) => p.filter((x) => x.id !== hubPosts[1].id));
            setShowPrompt(false);
          }}
          onUpdateDate={async () => setShowPrompt(false)}
        />
      ) : null}
    </main>
  );
}

/** Bulk tab demo with local generation (no API). */
function BulkPreviewDemo(props: { onSaved: (draft: BulkGeneratedDraft) => void }) {
  const [count, setCount] = useState(3);
  const [scheduleMode, setScheduleMode] = useState<"scheduled" | "unscheduled">("scheduled");
  const [targetGroups, setTargetGroups] = useState<ContentCalendarGroup[]>([...CONTENT_CALENDAR_GROUPS]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [drafts, setDrafts] = useState<BulkGeneratedDraft[]>([]);

  function generate() {
    const types = ["Carousel", "Static", "Video", "Text"] as const;
    const next: BulkGeneratedDraft[] = Array.from({ length: count }, (_, i) => ({
      tempId: `preview_${i}`,
      dayIndex: i % 5,
      postType: types[i % types.length],
      targetGroup: targetGroups[i % targetGroups.length],
      platforms: "Instagram, Facebook",
      caption: `[Preview] Post ${i + 1} for ${targetGroups[i % targetGroups.length]}. ${customPrompt || CONTENT_CALENDAR_BULK_DEFAULT_PROMPT}`,
      visualPrompt: types[i % types.length] === "Text" ? null : "Dark brand graphic, orange accent.",
      hashtags: ["MatchFit", "Preview"],
      postDate: scheduleMode === "scheduled" ? `2026-06-${String(10 + (i % 5)).padStart(2, "0")}` : null,
    }));
    setDrafts(next);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/[0.06] bg-[#12151C]/90 space-y-4 p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Bulk generation setup (preview)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-bold uppercase text-white/40">Number of posts</label>
            <input
              type="number"
              min={1}
              max={CONTENT_CALENDAR_BULK_MAX_COUNT}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-3 py-2 text-sm"
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 1)}
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase text-white/40">Scheduling</label>
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0E1016] px-3 py-2 text-sm"
              value={scheduleMode}
              onChange={(e) => setScheduleMode(e.target.value as "scheduled" | "unscheduled")}
            >
              <option value="scheduled">Scheduled</option>
              <option value="unscheduled">Non-scheduled</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {CONTENT_CALENDAR_GROUPS.map((g) => (
            <label key={g} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={targetGroups.includes(g)}
                onChange={() =>
                  setTargetGroups((prev) =>
                    prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
                  )
                }
              />
              {g}
            </label>
          ))}
        </div>
        <textarea
          className="w-full rounded-lg border border-white/10 bg-[#0E1016] px-3 py-2 text-sm"
          rows={2}
          placeholder={CONTENT_CALENDAR_BULK_DEFAULT_PROMPT}
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
        />
        <button
          type="button"
          className="rounded-xl bg-[#FF7E00] px-4 py-2.5 text-sm font-bold text-black"
          onClick={generate}
        >
          Generate preview batch
        </button>
        <p className="text-[11px] text-amber-200/80">
          ⚠ Max {CONTENT_CALENDAR_BULK_MAX_COUNT} posts per run in production.
        </p>
      </section>

      {drafts.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {drafts.map((d) => (
            <article key={d.tempId} className="rounded-2xl border border-white/[0.06] bg-[#12151C]/90 p-4">
              <div className="flex justify-between gap-2">
                <span className="text-xs font-black uppercase text-[#FFD34E]">{d.postType}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase text-emerald-100"
                    onClick={() => {
                      props.onSaved(d);
                      setDrafts((prev) => prev.filter((x) => x.tempId !== d.tempId));
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-[#E32B2B]/30 px-2 py-1 text-[10px] font-bold uppercase text-[#FFB4B4]"
                    onClick={() => setDrafts((prev) => prev.filter((x) => x.tempId !== d.tempId))}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm text-white/70">{d.caption}</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const WORKFLOW_STAGES = ["Draft", "Scheduled", "Optimized", "Published"] as const;
type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

const WORKFLOW_DEMO_INITIAL_CAPTION =
  "Founding Fitness Pros: this is your window. Match Fit puts you in front of athletes who are already searching — no cold DMs, no chasing. Swipe-based discovery, a real social feed in Fit Hub, and matching that sends ready-to-book clients your way.\n\nBeta pricing is locked for founders and the 60-day free trial starts at registration. Build your roster while the platform is small enough that early pros own the spotlight.\n\nClaim your spot → match-fit.net/trainer/signup";

/** Demonstrates the locked content workflow end-to-end on a single demo post. */
function LockedWorkflowDemo() {
  const [postType, setPostType] = useState<ContentCalendarPostType>("Carousel");
  const [caption, setCaption] = useState(WORKFLOW_DEMO_INITIAL_CAPTION);
  const [savedCaption, setSavedCaption] = useState(WORKFLOW_DEMO_INITIAL_CAPTION);
  const [hashtags] = useState(["MatchFit", "FitnessApp", "FoundingPro", "FitHub"]);
  const [platforms, setPlatforms] = useState<string[]>(CONTENT_CALENDAR_PLATFORM_OPTIONS_BY_TYPE.Carousel);
  const [approved, setApproved] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustNote, setAdjustNote] = useState("");
  const [stage, setStage] = useState<WorkflowStage>("Draft");
  const [scheduleDate, setScheduleDate] = useState("2026-06-15");

  const stageIndex = WORKFLOW_STAGES.indexOf(stage);
  const isDirty = caption !== savedCaption;
  const platformOptions = CONTENT_CALENDAR_PLATFORM_OPTIONS_BY_TYPE[postType];

  function changePostType(next: ContentCalendarPostType) {
    setPostType(next);
    setPlatforms(CONTENT_CALENDAR_PLATFORM_OPTIONS_BY_TYPE[next]);
  }

  function togglePlatform(p: string) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function applyAdjust() {
    const note = adjustNote.trim();
    if (note) setCaption((c) => `${c}\n\n[Adjusted: ${note}]`);
    setAdjustNote("");
    setAdjusting(false);
  }

  const stageHelp: Record<WorkflowStage, string> = {
    Draft: "Edit the caption, pick platforms, and approve when it reads right. Approval is reversible.",
    Scheduled: "Locked to a date. Optimize next to tune best-time and hashtags, or step back to edit.",
    Optimized: "Best-time + hashtag pass applied. Publish to queue it — nothing posts until JB fires the queue.",
    Published: "Queued for publish. On HOLD: this does not post to any platform until JB says fire.",
  };

  return (
    <div className="space-y-6">
      {/* Stage stepper */}
      <section className={`${adminCardClass} space-y-4`}>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">
          Schedule → Optimize → Publish
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {WORKFLOW_STAGES.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className={
                  i <= stageIndex
                    ? "rounded-lg border border-[#FF7E00]/45 bg-[#FF7E00]/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-[#FFD34E]"
                    : "rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-white/40"
                }
              >
                {i + 1}. {s === "Published" ? "Publish (queue)" : s}
              </span>
              {i < WORKFLOW_STAGES.length - 1 ? <span className="text-white/30">→</span> : null}
            </div>
          ))}
        </div>
        <p className="text-sm text-white/55">{stageHelp[stage]}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={adminSecondaryButtonClass}
            disabled={stageIndex === 0}
            onClick={() => setStage(WORKFLOW_STAGES[Math.max(0, stageIndex - 1)])}
          >
            Step back
          </button>
          {stage === "Draft" ? (
            <button
              type="button"
              className={adminPrimaryButtonClass}
              disabled={!approved || platforms.length === 0}
              onClick={() => setStage("Scheduled")}
            >
              Schedule
            </button>
          ) : null}
          {stage === "Scheduled" ? (
            <button type="button" className={adminPrimaryButtonClass} onClick={() => setStage("Optimized")}>
              Optimize
            </button>
          ) : null}
          {stage === "Optimized" ? (
            <button type="button" className={adminPrimaryButtonClass} onClick={() => setStage("Published")}>
              Publish (queue only)
            </button>
          ) : null}
          {!approved && stage === "Draft" ? (
            <span className="text-[11px] text-amber-200/80">Approve the post to enable scheduling.</span>
          ) : null}
        </div>
        {stage === "Published" ? (
          <p className="rounded-lg border border-amber-400/30 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-100">
            ✓ Queued for {platforms.join(", ") || "no platforms"} on {scheduleDate}. HOLD active — nothing posts until
            JB fires the queue.
          </p>
        ) : null}
      </section>

      {/* Post editor */}
      <section className={`${adminPanelClass} space-y-4 p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-black uppercase tracking-[0.1em] text-[#FFD34E]">
            {CONTENT_CALENDAR_TYPE_ICONS[postType]} {postType} · Join the Team
          </span>
          <button
            type="button"
            className={
              approved
                ? "rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100"
                : "rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/20"
            }
            onClick={() => setApproved((a) => !a)}
          >
            {approved ? "✓ Approved (tap to undo)" : "Approve"}
          </button>
        </div>

        {/* Asset type picker */}
        <div>
          <p className={adminLabelClass}>Asset type</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CONTENT_CALENDAR_POST_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={t === postType ? adminAccentButtonClass : adminSecondaryButtonClass}
                onClick={() => changePostType(t)}
              >
                {CONTENT_CALENDAR_TYPE_ICONS[t]} {t}
              </button>
            ))}
          </div>
        </div>

        {/* Platform picker by asset type */}
        <div>
          <p className={adminLabelClass}>Publish platforms ({postType})</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {platformOptions.map((p) => (
              <label
                key={p}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                  platforms.includes(p)
                    ? "border-[#FF7E00]/45 bg-[#FF7E00]/10 text-[#FFD34E]"
                    : "border-white/10 bg-white/[0.03] text-white/60"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[#FF7E00]"
                  checked={platforms.includes(p)}
                  onChange={() => togglePlatform(p)}
                />
                {p}
              </label>
            ))}
          </div>
        </div>

        {/* Full caption — no truncation */}
        <div>
          <label className={adminLabelClass}>Caption (full — no cut)</label>
          <textarea
            className={`${adminInputClassSm} mt-1 min-h-[160px]`}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <ContentCaptionCharLimit caption={caption} hashtags={hashtags} />
        </div>

        <p className="text-xs text-white/45">
          Hashtags: {hashtags.map((h) => `#${h}`).join(" ")}
        </p>

        {/* Edit / adjust controls */}
        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
          <button
            type="button"
            className={adminPrimaryButtonClass}
            disabled={!isDirty}
            onClick={() => setSavedCaption(caption)}
          >
            {isDirty ? "Save edits" : "Saved"}
          </button>
          <button
            type="button"
            className={adjusting ? adminAccentButtonClass : adminSecondaryButtonClass}
            onClick={() => setAdjusting((v) => !v)}
          >
            {adjusting ? "Close adjust" : "Adjust"}
          </button>
          {stage === "Scheduled" || stage === "Optimized" || stage === "Published" ? (
            <label className="flex items-center gap-2 text-xs text-white/55">
              Post date
              <input
                type="date"
                className={adminInputClassSm}
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </label>
          ) : null}
        </div>

        {adjusting ? (
          <div className="rounded-xl border border-[#FF7E00]/25 bg-[#FF7E00]/[0.05] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FFD34E]">
              Adjust — chat the change to the AI
            </p>
            <textarea
              className={`${adminInputClassSm} mt-2`}
              rows={2}
              value={adjustNote}
              placeholder="e.g. Punchier hook, cut the middle paragraph, add urgency…"
              onChange={(e) => setAdjustNote(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" className={adminAccentButtonClass} onClick={applyAdjust}>
                Apply adjustment
              </button>
              <span className="text-[10px] text-white/40">
                Preview appends a note locally. Live panel calls regenerate-with-feedback.
              </span>
            </div>
          </div>
        ) : null}
      </section>

      <WorkflowContentHub />
    </div>
  );
}

/** Content Hub demo with Scheduled + Impromptu sections. */
function WorkflowContentHub() {
  const scheduled = [
    { id: "sch_1", type: "Carousel" as ContentCalendarPostType, group: "Join the Team", date: "Mon Jun 15", platforms: "IG · FB · Threads · TikTok" },
    { id: "sch_2", type: "Video" as ContentCalendarPostType, group: "Clients", date: "Wed Jun 17", platforms: "IG Reels · TikTok" },
    { id: "sch_3", type: "Text" as ContentCalendarPostType, group: "List With Us", date: "Fri Jun 19", platforms: "FB · Threads" },
  ];
  const impromptu = [
    { id: "imp_1", type: "Static" as ContentCalendarPostType, group: "Clients", platforms: "IG · FB · Threads" },
    { id: "imp_2", type: "Text" as ContentCalendarPostType, group: "Join the Team", platforms: "FB · Threads" },
  ];

  return (
    <section className={`${adminCardClass} space-y-5`}>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Content Hub</p>

      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#FF7E00]">Scheduled</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {scheduled.map((p) => (
            <div key={p.id} className="rounded-xl border border-white/[0.08] bg-[#0E1016]/70 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#FF7E00]">{p.date}</p>
              <p className="mt-1 text-sm text-white/75">
                {CONTENT_CALENDAR_TYPE_ICONS[p.type]} {p.type} · {p.group}
              </p>
              <p className="mt-1 text-[11px] text-white/40">{p.platforms}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-white/60">Impromptu (unscheduled)</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {impromptu.map((p) => (
            <div key={p.id} className="rounded-xl border border-dashed border-white/[0.12] bg-[#0E1016]/50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">No date yet</p>
              <p className="mt-1 text-sm text-white/75">
                {CONTENT_CALENDAR_TYPE_ICONS[p.type]} {p.type} · {p.group}
              </p>
              <p className="mt-1 text-[11px] text-white/40">{p.platforms}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
