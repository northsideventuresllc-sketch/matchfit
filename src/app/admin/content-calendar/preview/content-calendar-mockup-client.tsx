"use client";

import { useState } from "react";
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
import {
  CONTENT_CALENDAR_PLATFORM_OPTIONS_BY_TYPE,
  CONTENT_CALENDAR_POST_TYPES,
  CONTENT_CALENDAR_TYPE_ICONS,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import { ContentCaptionCharLimit } from "@/components/admin/content-caption-char-limit";

/** Public interactive UI preview — local-only demo, no admin API calls. */
export function ContentCalendarMockupClient() {
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
            Demo mode with sample data only. This public preview mounts <strong>no live admin panels</strong> and makes
            <strong> no live admin API calls</strong>. Use <strong>Locked Workflow</strong> to test ADJUST → SAVE EDITS
            → APPROVE → SCHEDULE → OPTIMIZE → PUBLISH on local demo state only.
          </p>
        </header>

        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/[0.08] px-4 py-3 text-sm leading-relaxed text-amber-100">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">Automations on HOLD</p>
          <p className="mt-1 text-amber-100/90">
            Preview only — every edit, approval, and queue action stays inside local demo data. PUBLISH only
            <strong> queues</strong> a post visually; nothing posts to any platform and this route never calls live
            admin content APIs.
          </p>
        </div>

        <section className={`${adminCardClass} space-y-3`}>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Public preview scope</p>
          <p className="text-sm text-white/60">
            This route intentionally exposes only the local <strong>Locked Workflow</strong> demo and a local
            <strong> Content Hub snapshot</strong>. Live generator, live bulk generation, and admin-save flows stay in
            the authenticated production tools.
          </p>
        </section>

        <LockedWorkflowDemo />
      </div>
    </main>
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
