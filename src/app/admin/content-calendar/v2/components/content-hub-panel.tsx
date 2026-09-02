"use client";

import { useCallback, useState } from "react";
import {
  adminCardClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import type { ClientContentCalendarV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { HubPostBubble } from "./hub-post-bubble";
import { ProgressBar } from "./ui-bits";
import { useSimulatedProgress } from "./use-simulated-progress";
import { groupHubPosts, WEEKLY_GENERATION_TIME_LABEL, type HubDayGroup } from "./helpers";

export type DayActionResult = {
  memoId?: string | null;
  approved?: number;
  reverted?: number;
  memosCanceled?: number;
  jobId?: string;
  mediaPostCount?: number;
  moved?: number;
};

type BubbleWiring = {
  busyId: string | null;
  onPatch: (id: string, fields: Partial<ClientContentCalendarV2Post>) => Promise<void>;
  register: (key: string, dirty: boolean, save: () => Promise<void>) => void;
  unregister: (key: string) => void;
};

function BubbleGrid({
  posts,
  wiring,
  onSubmitForGeneration,
}: {
  posts: ClientContentCalendarV2Post[];
  wiring: BubbleWiring;
  onSubmitForGeneration: (id: string) => Promise<void>;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {posts.map((post) => (
        <HubPostBubble
          key={post.id}
          post={post}
          busy={wiring.busyId === post.id}
          onPatch={wiring.onPatch}
          register={wiring.register}
          unregister={wiring.unregister}
          onSubmitForGeneration={onSubmitForGeneration}
        />
      ))}
    </div>
  );
}

function DayContainer({
  group,
  wiring,
  onApproveDay,
  onReturnToEditing,
  onFireMediaAgent,
  onManuallyGenerateMedia,
  onSubmitForGeneration,
}: {
  group: HubDayGroup;
  wiring: BubbleWiring;
  onApproveDay: (postDate: string) => Promise<DayActionResult>;
  onReturnToEditing: (postDate: string) => Promise<DayActionResult>;
  onFireMediaAgent: (postDate: string) => Promise<DayActionResult>;
  onManuallyGenerateMedia: (postDate: string) => Promise<DayActionResult>;
  onSubmitForGeneration: (id: string) => Promise<void>;
}) {
  const [action, setAction] = useState<"approve" | "return" | "fire" | "manual-media" | null>(null);
  const [memoNote, setMemoNote] = useState<string | null>(null);
  const [canceledNote, setCanceledNote] = useState<string | null>(null);
  const [jobNote, setJobNote] = useState<string | null>(null);
  const [manualMediaNote, setManualMediaNote] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const progress = useSimulatedProgress();

  const run = useCallback(
    async (kind: "approve" | "return" | "fire" | "manual-media", fn: () => Promise<DayActionResult>) => {
      setAction(kind);
      setDayError(null);
      if (kind === "fire") progress.start();
      try {
        const result = await fn();
        if (kind === "approve") {
          setCanceledNote(null);
          setManualMediaNote(null);
          setMemoNote(
            result.memoId
              ? `Self-learning memo recorded (${result.memoId}).`
              : "Self-learning memo recorded on approval.",
          );
          setJobNote(
            result.jobId
              ? `Media agent job queued${result.jobId ? ` (${result.jobId})` : ""}. The agent on the Mac mini will pick it up — it does not finish here.`
              : null,
          );
        }
        if (kind === "return") {
          setMemoNote(null);
          setJobNote(null);
          setManualMediaNote(null);
          setCanceledNote(
            `Approval reverted — self-learning memo canceled (${result.memosCanceled ?? 0}).`,
          );
        }
        if (kind === "fire") {
          progress.finish();
          setManualMediaNote(null);
          setJobNote(
            `Media agent job queued${result.jobId ? ` (${result.jobId})` : ""}. The agent on the Mac mini will pick it up — it does not finish here.`,
          );
        }
        if (kind === "manual-media") {
          setMemoNote(null);
          setCanceledNote(null);
          setJobNote(null);
          setManualMediaNote(
            typeof result.moved === "number"
              ? `Media generation bypassed — ${result.moved} post${result.moved === 1 ? "" : "s"} moved straight to Publishing. Use Manually Redo there to upload your own media.`
              : "Media generation bypassed — this day's posts moved straight to Publishing. Use Manually Redo there to upload your own media.",
          );
        }
      } catch (e) {
        if (kind === "fire") progress.fail();
        setDayError(e instanceof Error ? e.message : "Day action failed.");
      } finally {
        setAction(null);
      }
    },
    [progress],
  );

  return (
    <section className={adminCardClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.14em] text-white">{group.label}</h3>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/40">
            {group.posts.length} post{group.posts.length === 1 ? "" : "s"} · {group.approved ? "Approved" : "Editing"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!group.approved ? (
            <>
              <button
                type="button"
                className={adminPrimaryButtonClass}
                disabled={action !== null}
                onClick={() => void run("approve", () => onApproveDay(group.date))}
                title="Approves the day and immediately fires the media agent — no separate click needed."
              >
                {action === "approve" ? "APPROVING…" : "APPROVE DAY"}
              </button>
              <button
                type="button"
                className={adminSecondaryButtonClass}
                disabled={action !== null}
                onClick={() => void run("manual-media", () => onManuallyGenerateMedia(group.date))}
                title="Skip the media agent and send this day's posts straight to Publishing."
              >
                {action === "manual-media" ? "WORKING…" : "MANUALLY GENERATE MEDIA"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={adminSecondaryButtonClass}
                disabled={action !== null}
                onClick={() => void run("return", () => onReturnToEditing(group.date))}
              >
                {action === "return" ? "REVERTING…" : "RETURN TO EDITING"}
              </button>
              <button
                type="button"
                className={adminSecondaryButtonClass}
                disabled={action !== null}
                onClick={() => void run("manual-media", () => onManuallyGenerateMedia(group.date))}
                title="Skip the media agent and send this day's posts straight to Publishing."
              >
                {action === "manual-media" ? "WORKING…" : "MANUALLY GENERATE MEDIA"}
              </button>
              <button
                type="button"
                className={adminSecondaryButtonClass}
                disabled={action !== null}
                onClick={() => void run("fire", () => onFireMediaAgent(group.date))}
                title="Approve Day already fires the media agent automatically — use this only to retry if that didn't queue (e.g. the mini was unreachable)."
              >
                {action === "fire" ? "QUEUING…" : "RETRY FIRE MEDIA AGENT"}
              </button>
            </>
          )}
        </div>
      </div>

      {progress.active ? (
        <div className="mt-4">
          <ProgressBar percent={progress.percent} label="Queuing media agent job" />
        </div>
      ) : null}
      {memoNote ? <p className="mt-3 text-xs font-semibold text-emerald-300">{memoNote}</p> : null}
      {canceledNote ? <p className="mt-3 text-xs font-semibold text-[#FFD34E]">{canceledNote}</p> : null}
      {jobNote ? <p className="mt-3 text-xs font-semibold text-emerald-300">{jobNote}</p> : null}
      {manualMediaNote ? <p className="mt-3 text-xs font-semibold text-emerald-300">{manualMediaNote}</p> : null}
      {dayError ? <p className="mt-3 text-xs font-semibold text-[#FFB4B4]">{dayError}</p> : null}

      <div className="mt-4">
        <BubbleGrid posts={group.scheduled} wiring={wiring} onSubmitForGeneration={onSubmitForGeneration} />
      </div>

      {group.impromptu.length ? (
        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#FF7E00]">
            Impromptu drafts for this day
          </p>
          <BubbleGrid posts={group.impromptu} wiring={wiring} onSubmitForGeneration={onSubmitForGeneration} />
        </div>
      ) : null}
    </section>
  );
}

export function ContentHubPanel({
  posts,
  wiring,
  onApproveDay,
  onReturnToEditing,
  onFireMediaAgent,
  onManuallyGenerateMedia,
  onPostAction,
}: {
  posts: ClientContentCalendarV2Post[];
  wiring: BubbleWiring;
  onApproveDay: (postDate: string) => Promise<DayActionResult>;
  onReturnToEditing: (postDate: string) => Promise<DayActionResult>;
  onFireMediaAgent: (postDate: string) => Promise<DayActionResult>;
  /** Fetch + reload hub/publishing stages + tab switch, owned by the parent shell. */
  onManuallyGenerateMedia: (postDate: string) => Promise<DayActionResult>;
  /** Mirrors the `onAction` prop threaded into PendingTabPanel / PublishingPanel from the parent's `postAction`. */
  onPostAction: (id: string, body: Record<string, unknown>, success?: string) => Promise<void>;
}) {
  // Optimistic local hide, independent of the parent's post list — a successful manual-media or
  // submit-for-generation call moves posts out of the "hub" stage server-side, but this panel has no
  // callback to force the parent to refetch `posts` immediately (the parent's own 15s hub poll will
  // pick it up eventually). Hiding locally gives the operator instant feedback either way. A stale id
  // left in these sets after the parent's own refetch has already dropped that post from `posts` is
  // harmless — it simply has nothing left to filter out.
  const [hiddenPostIds, setHiddenPostIds] = useState<Set<string>>(new Set());
  const [hiddenDates, setHiddenDates] = useState<Set<string>>(new Set());

  const runManuallyGenerateMedia = useCallback(
    async (postDate: string): Promise<DayActionResult> => {
      const result = await onManuallyGenerateMedia(postDate);
      setHiddenDates((prev) => new Set(prev).add(postDate));
      return result;
    },
    [onManuallyGenerateMedia],
  );

  const submitForGeneration = useCallback(
    async (id: string) => {
      await onPostAction(id, { action: "submit_for_generation" }, "Submitted for generation.");
      setHiddenPostIds((prev) => new Set(prev).add(id));
    },
    [onPostAction],
  );

  const visiblePosts = posts.filter((p) => !hiddenPostIds.has(p.id));
  const { days, undated } = groupHubPosts(visiblePosts);
  const visibleDays = days.filter((d) => !hiddenDates.has(d.date));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#FF7E00]/30 bg-[#FF7E00]/10 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FFD34E]">Content Hub</p>
        <p className="mt-2 text-sm leading-relaxed text-white/75">
          Match Fit posts four times a day, Monday–Friday — Static, Carousel, Text, and Video. The full week is
          generated automatically {WEEKLY_GENERATION_TIME_LABEL}. Edit any post below, approve the whole day, then
          fire the media agent to generate it.
        </p>
      </section>

      {visibleDays.map((group) => (
        <DayContainer
          key={group.date}
          group={group}
          wiring={wiring}
          onApproveDay={onApproveDay}
          onReturnToEditing={onReturnToEditing}
          onFireMediaAgent={onFireMediaAgent}
          onManuallyGenerateMedia={runManuallyGenerateMedia}
          onSubmitForGeneration={submitForGeneration}
        />
      ))}

      {undated.length ? (
        <section className={adminCardClass}>
          <h3 className="text-sm font-black uppercase tracking-[0.14em] text-white">Impromptu drafts (no scheduled day)</h3>
          <p className="mt-0.5 text-[11px] text-white/40">
            These impromptu drafts have no post date, so day-level approve / fire media agent does not apply. Edit and copy
            them here, or use them as source material.
          </p>
          <div className="mt-4">
            <BubbleGrid posts={undated} wiring={wiring} onSubmitForGeneration={submitForGeneration} />
          </div>
        </section>
      ) : null}

      {!visibleDays.length && !undated.length ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-white/45">
          No Content Hub posts yet. The weekly generation job fills this in {WEEKLY_GENERATION_TIME_LABEL}, or add
          impromptu drafts from the Impromptu Content Generation tab.
        </div>
      ) : null}
    </div>
  );
}
