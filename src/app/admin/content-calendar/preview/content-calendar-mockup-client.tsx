"use client";

import { useMemo, useState } from "react";
import { AdminPortalBackdrop } from "@/components/admin/admin-portal-ui";
import type { BulkGeneratedDraft } from "@/lib/content-calendar/content-calendar-ai";
import {
  CONTENT_CALENDAR_BULK_DEFAULT_PROMPT,
  CONTENT_CALENDAR_BULK_MAX_COUNT,
  CONTENT_CALENDAR_GROUPS,
  type ContentCalendarGroup,
} from "@/lib/content-calendar/constants";
import { normalizeTargetGroup } from "@/lib/content-calendar/content-rules";
import type { ClientContentPost } from "@/lib/content-calendar/content-calendar-store";
import {
  ContentGeneratorPanel,
  ContentHubPanel,
  ScheduleCalendar,
  UnpostedPromptModal,
} from "@/app/admin/content-calendar/content-calendar-panels";

type Tab = "generator" | "bulk" | "hub";

const DEMO_HUB: ClientContentPost[] = [
  {
    id: "demo_1",
    weekStart: "2026-06-09",
    postDate: "2026-06-10",
    dayIndex: 1,
    postType: "Carousel",
    targetGroup: "Fitness Pros",
    platforms: "Instagram, Threads, Facebook, TikTok",
    caption: "Fitness Pros — beta spots are filling. Match Fit puts serious coaches in front of athletes ready to book.",
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
  },
];

/** Interactive UI preview — demo data only, no API calls. */
export function ContentCalendarMockupClient() {
  const [tab, setTab] = useState<Tab>("generator");
  const [showPrompt, setShowPrompt] = useState(false);
  const [autoPurge, setAutoPurge] = useState(true);
  const [hubPosts, setHubPosts] = useState(DEMO_HUB);

  const tabs = [
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
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]">Interactive preview</p>
          <h1 className="text-3xl font-black tracking-tight">Content Calendar — UI mockup</h1>
          <p className="max-w-2xl text-sm text-white/55">
            Demo mode with sample data. Tab order: Content Generator → Bulk Content Generator → Content Hub. Try the
            bulk workflow and open the unposted prompt on the Hub tab.
          </p>
        </header>

        <div className="rounded-xl border border-[#FF7E00]/30 bg-[#FF7E00]/10 px-4 py-3 text-sm text-[#FFD34E]">
          Preview only — buttons on Bulk/Hub simulate save/delete locally. Production uses live AI + NI Brain storage.
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
              },
              ...prev,
            ]);
          }} />
        ) : null}

        {tab === "hub" ? (
          <ContentHubPanel
            posts={hubPosts}
            loading={false}
            autoPurge={autoPurge}
            onAutoPurgeChange={setAutoPurge}
            onRefresh={() => undefined}
            onDelete={async (id) => setHubPosts((p) => p.filter((x) => x.id !== id))}
            onMarkPosted={async (id) => setHubPosts((p) => p.filter((x) => x.id !== id))}
            onUpdatePostDate={async (id, postDate) =>
              setHubPosts((p) => p.map((x) => (x.id === id ? { ...x, postDate, isScheduled: true } : x)))
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
