"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminLoadingBar,
  adminAccentButtonClass,
  adminCardClass,
  adminInputClass,
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
  CONTENT_CALENDAR_GROUP_DESCRIPTIONS,
  CONTENT_CALENDAR_POST_TYPES,
  CONTENT_CALENDAR_TYPE_ICONS,
  type ContentCalendarGroup,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import {
  assignDefaultScheduleAudiences,
  assignRandomAudiences,
  buildBulkSlots,
  bulkTypeCountsTotal,
  initialAudienceMap,
  type BulkAssignmentMode,
  type BulkContentSlot,
  type BulkTypeCounts,
} from "@/lib/content-calendar/bulk-content-slots";
import type { ClientContentPost } from "@/lib/content-calendar/content-calendar-store";
import { formatCalendarDate, getMondayOfWeek } from "@/lib/content-calendar/rotation";
import { formatUserFacingError } from "@/lib/read-json-response";
import { isPostMissed } from "@/lib/content-calendar/schedule-utils";

export function CopyButton({
  text,
  label = "Copy",
  disabled = false,
  disabledHint = "Save to Content Hub to copy",
}: {
  text: string;
  label?: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (disabled) {
    return (
      <span className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/30">
        {disabledHint}
      </span>
    );
  }
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

function DraftBubble(props: {
  draft: BulkGeneratedDraft;
  onSave: () => Promise<void>;
  onDelete: () => void;
  saving: boolean;
  saveDisabled: boolean;
}) {
  return (
    <article className={contentCalendarDraftCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-xs font-black uppercase tracking-[0.1em] text-[#FFD34E]">
            {CONTENT_CALENDAR_TYPE_ICONS[props.draft.postType]} {props.draft.postType}
          </span>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-white/40">{props.draft.targetGroup}</p>
          {props.draft.postDate ? (
            <p className="text-[10px] text-[#FF7E00]/80">Scheduled: {props.draft.postDate}</p>
          ) : (
            <p className="text-[10px] text-white/35">Unscheduled</p>
          )}
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-200/70">Pending approval</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={props.saving || props.saveDisabled}
            className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
            onClick={() => void props.onSave()}
          >
            {props.saving ? "Saving…" : "Approve & save"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4] hover:bg-[#E32B2B]/20"
            onClick={props.onDelete}
          >
            Delete
          </button>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{props.draft.caption}</p>
      {props.draft.visualPrompt ? (
        <p className="mt-2 rounded-lg border border-dashed border-[#FF7E00]/20 bg-black/20 p-3 text-xs text-white/50">
          {props.draft.visualPrompt}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton
          text={`${props.draft.caption}\n\n${props.draft.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`}
          label="Copy post"
          disabled
          disabledHint="Approve & save to copy"
        />
      </div>
    </article>
  );
}

function bulkAssignmentToggleClass(active: boolean) {
  return active
    ? "border-[#FF7E00]/45 bg-[#FF7E00]/15 text-[#FFD34E]"
    : "border-white/12 bg-white/[0.03] text-white/55 hover:border-white/20 hover:bg-white/[0.06]";
}

const contentCalendarSlotListClass =
  "overflow-hidden rounded-xl border border-white/[0.08] bg-[#0E1016]/60";

const contentCalendarSlotRowClass =
  "grid gap-2 border-b border-white/[0.06] px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] sm:items-center sm:gap-4";

const contentCalendarDraftCardClass =
  "rounded-xl border border-white/[0.08] bg-[#0E1016]/80 p-4 sm:p-5";

export function BulkContentGeneratorPanel(props: {
  configured: boolean;
  niBrainConfigured: boolean;
  onHubRefresh: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [typeCounts, setTypeCounts] = useState<BulkTypeCounts>(() => ({
    Video: 2,
    Static: 2,
    Carousel: 2,
    Text: 2,
  }));
  const [scheduleMode, setScheduleMode] = useState<"scheduled" | "unscheduled">("scheduled");
  const [customPrompt, setCustomPrompt] = useState("");
  const [weekStart] = useState(() => formatCalendarDate(getMondayOfWeek()));
  const [slots, setSlots] = useState<BulkContentSlot[]>([]);
  const [audienceBySlot, setAudienceBySlot] = useState<Record<string, ContentCalendarGroup>>({});
  const [assignmentMode, setAssignmentMode] = useState<BulkAssignmentMode | null>(null);
  const [assigningAudiences, setAssigningAudiences] = useState(false);
  const [manualEditNotice, setManualEditNotice] = useState(false);
  const [drafts, setDrafts] = useState<BulkGeneratedDraft[]>([]);
  const [bulkSessionId, setBulkSessionId] = useState<string | null>(null);
  const [scheduledPosts, setScheduledPosts] = useState<ClientContentPost[]>([]);
  const [generating, setGenerating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const saveDisabled = !props.niBrainConfigured;

  const totalPosts = useMemo(() => bulkTypeCountsTotal(typeCounts), [typeCounts]);

  const loadScheduled = useCallback(async () => {
    const res = await fetch("/api/admin/content-calendar/hub?view=scheduled", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { posts?: ClientContentPost[] };
    setScheduledPosts(data.posts ?? []);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadScheduled());
  }, [loadScheduled]);

  function setTypeCount(postType: ContentCalendarPostType, value: number) {
    const next = Math.max(0, Math.min(CONTENT_CALENDAR_BULK_MAX_COUNT, value));
    setTypeCounts((prev) => {
      const otherTotal = bulkTypeCountsTotal(prev) - (prev[postType] ?? 0);
      const capped = Math.min(next, CONTENT_CALENDAR_BULK_MAX_COUNT - otherTotal);
      return { ...prev, [postType]: capped };
    });
  }

  function goToAudienceStep() {
    if (totalPosts < 1) {
      setError("Add at least one post to generate.");
      return;
    }
    const nextSlots = buildBulkSlots(typeCounts);
    setSlots(nextSlots);
    setAudienceBySlot(initialAudienceMap(nextSlots));
    setAssignmentMode(null);
    setManualEditNotice(false);
    setError(null);
    setStep(2);
  }

  function toggleAssignmentMode(mode: BulkAssignmentMode) {
    if (assignmentMode === mode) {
      setAssignmentMode(null);
      setManualEditNotice(false);
      return;
    }
    setAssignmentMode(mode);
    setManualEditNotice(false);
    if (mode === "randomize") {
      setAudienceBySlot(assignRandomAudiences(slots));
    } else if (mode === "default_schedule") {
      setAudienceBySlot(assignDefaultScheduleAudiences(slots));
    } else {
      void applyAiChoiceAssignments();
    }
  }

  async function applyAiChoiceAssignments() {
    setAssigningAudiences(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/content-calendar/bulk-assign-audiences", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: slots.map((slot) => ({ id: slot.id, postType: slot.postType })),
        }),
      });
      const data = (await res.json()) as { assignments?: Record<string, string>; error?: string };
      if (!res.ok) throw new Error(data.error ?? "AI audience assignment failed.");
      const next: Record<string, ContentCalendarGroup> = {};
      for (const slot of slots) {
        const group = data.assignments?.[slot.id];
        next[slot.id] = CONTENT_CALENDAR_GROUPS.includes(group as ContentCalendarGroup)
          ? (group as ContentCalendarGroup)
          : audienceBySlot[slot.id] ?? CONTENT_CALENDAR_GROUPS[0];
      }
      setAudienceBySlot(next);
    } catch (e) {
      setAssignmentMode(null);
      setError(e instanceof Error ? e.message : "AI audience assignment failed.");
    } finally {
      setAssigningAudiences(false);
    }
  }

  function handleManualAudienceAttempt() {
    if (assignmentMode) {
      setManualEditNotice(true);
    }
  }

  function setSlotAudience(slotId: string, group: ContentCalendarGroup) {
    setAudienceBySlot((prev) => ({ ...prev, [slotId]: group }));
  }

  async function generate() {
    if (!slots.length) return;
    setGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const items = slots.map((slot) => ({
        postType: slot.postType,
        targetGroup: audienceBySlot[slot.id] ?? CONTENT_CALENDAR_GROUPS[0],
      }));
      const res = await fetch("/api/admin/content-calendar/bulk-generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          scheduled: scheduleMode === "scheduled",
          customPrompt: customPrompt.trim() || undefined,
          weekStart,
        }),
      });
      const data = (await res.json()) as {
        drafts?: BulkGeneratedDraft[];
        bulkSessionId?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      const sessionId = data.bulkSessionId ?? `bulk_${Date.now()}_local`;
      setDrafts(data.drafts ?? []);
      setBulkSessionId(sessionId);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft(draft: BulkGeneratedDraft, options?: { bulk?: boolean }): Promise<boolean> {
    if (!bulkSessionId) {
      setError("Missing bulk session — regenerate your batch to save posts.");
      return false;
    }
    if (saveDisabled) {
      setError("NI Brain is not configured — add NI Brain Supabase keys to save to Content Hub.");
      return false;
    }
    setSavingId(draft.tempId);
    if (!options?.bulk) {
      setError(null);
    }
    try {
      const res = await fetch("/api/admin/content-calendar/hub", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          weekStart,
          scheduled: scheduleMode === "scheduled",
          bulkSessionId,
        }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) throw new Error(formatUserFacingError(data.error, "Save failed."));
      setDrafts((prev) => prev.filter((d) => d.tempId !== draft.tempId));
      if (!options?.bulk) {
        setSuccess("Saved to Content Hub.");
        props.onHubRefresh();
        void loadScheduled();
      }
      return true;
    } catch (e) {
      setError(formatUserFacingError(e, "Save failed."));
      return false;
    } finally {
      if (!options?.bulk) {
        setSavingId(null);
      }
    }
  }

  async function saveAllDrafts() {
    if (drafts.length === 0 || bulkSaving) return;
    if (!bulkSessionId) {
      setError("Missing bulk session — regenerate your batch to save posts.");
      return;
    }
    if (saveDisabled) {
      setError("NI Brain is not configured — add NI Brain Supabase keys to save to Content Hub.");
      return;
    }
    setBulkSaving(true);
    setError(null);
    setSuccess(null);
    const pending = [...drafts];
    let saved = 0;
    let failed = 0;
    try {
      for (const draft of pending) {
        const ok = await saveDraft(draft, { bulk: true });
        if (ok) saved += 1;
        else failed += 1;
      }
      if (saved > 0) {
        props.onHubRefresh();
        void loadScheduled();
      }
      if (saved > 0 && failed === 0) {
        setSuccess(`Saved ${saved} post${saved === 1 ? "" : "s"} to Content Hub.`);
      } else if (saved > 0) {
        setSuccess(`Saved ${saved} of ${pending.length} posts to Content Hub.`);
        setError(`${failed} post${failed === 1 ? "" : "s"} could not be saved — see the error above.`);
      }
    } finally {
      setBulkSaving(false);
      setSavingId(null);
    }
  }

  function deleteAllDrafts() {
    if (drafts.length === 0) return;
    setDrafts([]);
    setSuccess(null);
    setError(null);
  }

  return (
    <div className="space-y-8">
      {step === 1 ? (
        <section className={`${adminCardClass} space-y-5 p-5`}>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Bulk generation setup</p>
          <p className="text-sm text-white/55">
            Choose how many posts to generate for each content type, then continue to assign target audiences.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CONTENT_CALENDAR_POST_TYPES.map((postType) => (
              <div key={postType}>
                <label className={adminLabelClass}>
                  {CONTENT_CALENDAR_TYPE_ICONS[postType]} {postType} posts
                </label>
                <input
                  type="number"
                  min={0}
                  max={CONTENT_CALENDAR_BULK_MAX_COUNT}
                  className={`${adminInputClass} mt-1`}
                  value={typeCounts[postType]}
                  onChange={(e) => setTypeCount(postType, Number(e.target.value) || 0)}
                />
              </div>
            ))}
          </div>

          <p className="text-xs text-white/45">
            Total: <strong className="text-[#FFD34E]">{totalPosts}</strong> / {CONTENT_CALENDAR_BULK_MAX_COUNT} posts
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={adminLabelClass}>Scheduling</label>
              <select
                className={`${adminInputClassSm} mt-1 w-full`}
                value={scheduleMode}
                onChange={(e) => setScheduleMode(e.target.value as "scheduled" | "unscheduled")}
              >
                <option value="scheduled">Scheduled (assign to calendar days)</option>
                <option value="unscheduled">Non-scheduled (set dates in Content Hub)</option>
              </select>
            </div>
          </div>

          <div>
            <label className={adminLabelClass}>Optional prompt (what should posts be about?)</label>
            <textarea
              className={`${adminInputClassSm} mt-2`}
              rows={3}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={CONTENT_CALENDAR_BULK_DEFAULT_PROMPT}
            />
            <p className="mt-1 text-[10px] text-white/35">Default: {CONTENT_CALENDAR_BULK_DEFAULT_PROMPT}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={adminPrimaryButtonClass}
              disabled={totalPosts < 1}
              onClick={goToAudienceStep}
            >
              Next
            </button>
          </div>

          <p className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-100/80">
            You can generate up to <strong>{CONTENT_CALENDAR_BULK_MAX_COUNT}</strong> posts in one run. Larger batches
            use more AI tokens and take longer — save the ones you want to Content Hub before generating again.
          </p>

          {error ? <p className="text-sm text-[#FFB4B4]">{error}</p> : null}
        </section>
      ) : (
        <section className={`${adminCardClass} space-y-5 p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Assign target audiences</p>
            <button
              type="button"
              className={adminSecondaryButtonClass}
              onClick={() => {
                setStep(1);
                setAssignmentMode(null);
                setManualEditNotice(false);
              }}
            >
              Back
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["randomize", "Randomize"],
                ["default_schedule", "Default Schedule"],
                ["ai_choice", "AI Choice"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                disabled={assigningAudiences && mode === "ai_choice"}
                className={`rounded-xl border px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] transition ${bulkAssignmentToggleClass(assignmentMode === mode)} disabled:opacity-40`}
                onClick={() => toggleAssignmentMode(mode)}
              >
                {mode === "ai_choice" && assigningAudiences ? "Scanning…" : label}
              </button>
            ))}
          </div>

          {assignmentMode ? (
            <p className="text-[11px] text-white/45">
              {assignmentMode === "randomize"
                ? "Target audiences are randomly assigned to each post."
                : assignmentMode === "default_schedule"
                  ? "Target audiences follow the content schedule rotation."
                  : "Target audiences are assigned from a social media scan."}
            </p>
          ) : null}

          {manualEditNotice ? (
            <p className="rounded-lg border border-amber-400/25 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-100/90">
              Deselect the option at the top to manually choose a target audience for each post.
            </p>
          ) : null}

          <div className={`${contentCalendarSlotListClass} px-4 py-3`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Audience key</p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              {CONTENT_CALENDAR_GROUPS.map((group) => (
                <div key={group} className="min-w-0">
                  <dt className="text-[11px] font-bold text-white/80">{group}</dt>
                  <dd className="mt-0.5 text-[11px] leading-relaxed text-white/45">
                    {CONTENT_CALENDAR_GROUP_DESCRIPTIONS[group]}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={contentCalendarSlotListClass}>
            <div className="hidden border-b border-white/[0.06] px-4 py-2 sm:grid sm:grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] sm:gap-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Post</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Target audience</span>
            </div>
            {slots.map((slot) => (
              <div
                key={slot.id}
                className={`${contentCalendarSlotRowClass} ${assignmentMode ? "opacity-75" : ""}`}
              >
                <span className="truncate text-sm font-semibold text-white/85">
                  {CONTENT_CALENDAR_TYPE_ICONS[slot.postType]} {slot.label}
                </span>
                <div
                  className="min-w-0"
                  onClick={handleManualAudienceAttempt}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleManualAudienceAttempt();
                  }}
                  role="presentation"
                >
                  <select
                    className={`${adminInputClassSm} max-w-full ${assignmentMode ? "cursor-not-allowed opacity-50" : ""}`}
                    value={audienceBySlot[slot.id] ?? CONTENT_CALENDAR_GROUPS[0]}
                    disabled={!!assignmentMode || assigningAudiences}
                    onChange={(e) => setSlotAudience(slot.id, e.target.value as ContentCalendarGroup)}
                    aria-label={`Target audience for ${slot.label}`}
                  >
                    {CONTENT_CALENDAR_GROUPS.map((group) => (
                      <option
                        key={group}
                        value={group}
                        title={CONTENT_CALENDAR_GROUP_DESCRIPTIONS[group]}
                      >
                        {group}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className={adminPrimaryButtonClass}
            disabled={generating || !props.configured || assigningAudiences}
            onClick={() => void generate()}
          >
            {generating ? "Generating…" : "Generate"}
          </button>

          {error ? <p className="text-sm text-[#FFB4B4]">{error}</p> : null}
        </section>
      )}

      {generating ? <AdminLoadingBar label="AI is generating your bulk content…" /> : null}

      {drafts.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white/70">
              Generated {drafts.length} post{drafts.length === 1 ? "" : "s"} — review and approve to save to Content Hub
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={bulkSaving || savingId !== null || saveDisabled}
                className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
                onClick={() => void saveAllDrafts()}
              >
                {bulkSaving ? "Saving all…" : `Save all (${drafts.length})`}
              </button>
              <button
                type="button"
                disabled={bulkSaving || savingId !== null}
                className="rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4] hover:bg-[#E32B2B]/20 disabled:opacity-40"
                onClick={deleteAllDrafts}
              >
                Delete all
              </button>
            </div>
          </div>
          {saveDisabled ? (
            <p className="rounded-lg border border-amber-400/25 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-100/90">
              NI Brain Supabase keys are required to save posts to Content Hub.
            </p>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {drafts.map((draft) => (
              <DraftBubble
                key={draft.tempId}
                draft={draft}
                saving={savingId === draft.tempId || bulkSaving}
                saveDisabled={saveDisabled}
                onSave={async () => {
                  await saveDraft(draft);
                }}
                onDelete={() => setDrafts((prev) => prev.filter((d) => d.tempId !== draft.tempId))}
              />
            ))}
          </div>
        </section>
      ) : null}

      {success ? <p className="text-sm text-emerald-200">{success}</p> : null}

      <ScheduleCalendar posts={scheduledPosts} title="Scheduled content calendar" />
    </div>
  );
}

export function ContentHubPanel(props: {
  posts: ClientContentPost[];
  loading: boolean;
  autoPurge: boolean;
  onAutoPurgeChange: (v: boolean) => void;
  onRefresh: () => void;
  onDelete: (id: string) => Promise<void>;
  onMarkPosted: (id: string) => Promise<void>;
  onUpdatePostDate: (id: string, postDate: string) => Promise<void>;
}) {
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const p of props.posts) next[p.id] = p.postDate;
    queueMicrotask(() => setDateDrafts(next));
  }, [props.posts]);

  return (
    <div className="space-y-8">
      <section className={`${adminCardClass} space-y-4 p-5`}>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Content Hub</p>
        <p className="text-sm text-white/55">
          Saved posts from bulk generation. Set a post date, mark as posted when live, and optionally auto-remove posted
          items after 24 hours.
        </p>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-white/70">
          <input
            type="checkbox"
            className="accent-[#FF7E00]"
            checked={props.autoPurge}
            onChange={(e) => props.onAutoPurgeChange(e.target.checked)}
          />
          Automatically delete saved posts 24 hours after they are marked posted
        </label>
        <button type="button" className={adminSecondaryButtonClass} onClick={props.onRefresh}>
          Refresh hub
        </button>
      </section>

      {props.loading ? <AdminLoadingBar label="Loading Content Hub…" /> : null}

      {!props.loading && props.posts.length === 0 ? (
        <p className={`${adminPanelClass} p-6 text-center text-sm text-white/45`}>
          No saved content yet. Generate bulk content and tap Save on any bubble.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {props.posts.map((post) => (
            <article key={post.id} className={contentCalendarDraftCardClass}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-black uppercase tracking-[0.1em] text-[#FFD34E]">
                    {CONTENT_CALENDAR_TYPE_ICONS[post.postType]} {post.postType}
                  </span>
                  <p className="mt-1 text-[10px] uppercase text-white/40">{post.targetGroup}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className={adminAccentButtonClass} onClick={() => void props.onMarkPosted(post.id)}>
                    Mark posted
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4]"
                    onClick={() => void props.onDelete(post.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <label className={adminLabelClass}>Post date</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="date"
                    className={adminInputClassSm}
                    value={dateDrafts[post.id] ?? post.postDate}
                    onChange={(e) => setDateDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className={adminSecondaryButtonClass}
                    onClick={() => void props.onUpdatePostDate(post.id, dateDrafts[post.id] ?? post.postDate)}
                  >
                    Save date
                  </button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-white/75">{post.caption}</p>
              {post.visualPrompt ? (
                <p className="mt-2 rounded-lg border border-dashed border-white/10 p-3 text-xs text-white/45">
                  {post.visualPrompt}
                </p>
              ) : null}
              <CopyButton
                text={`${post.caption}\n\n${post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`}
                label="Copy post"
              />
            </article>
          ))}
        </div>
      )}

      <ScheduleCalendar
        posts={props.posts.filter((p) => p.isScheduled || Boolean(p.postDate))}
        title="Hub schedule overview"
      />
    </div>
  );
}

export function ScheduleCalendar(props: { posts: ClientContentPost[]; title: string }) {
  const byDate = useMemo(() => {
    const map = new Map<string, ClientContentPost[]>();
    for (const p of props.posts) {
      const list = map.get(p.postDate) ?? [];
      list.push(p);
      map.set(p.postDate, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [props.posts]);

  if (!props.posts.length) {
    return (
      <section className={`${adminPanelClass} p-5`}>
        <p className={adminLabelClass}>{props.title}</p>
        <p className="mt-2 text-sm text-white/40">No scheduled content yet.</p>
      </section>
    );
  }

  return (
    <section className={`${adminPanelClass} space-y-4 p-5`}>
      <p className={adminLabelClass}>{props.title}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {byDate.map(([date, items]) => (
          <div key={date} className="rounded-xl border border-white/[0.06] bg-[#0E1016]/80 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[#FF7E00]">
              {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
            <ul className="mt-2 space-y-1.5">
              {items.map((p) => (
                <li key={p.id} className="text-[11px] text-white/60">
                  {CONTENT_CALENDAR_TYPE_ICONS[p.postType]} {p.postType} · {p.targetGroup}
                  {isPostMissed({ postDate: p.postDate, posted: p.posted }) ? (
                    <span className="ml-1 text-amber-300">· overdue</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UnpostedPromptModal(props: {
  post: ClientContentPost;
  onMarkPosted: () => Promise<void>;
  onUpdateDate: (date: string) => Promise<void>;
  onDismiss: () => void;
  busy: boolean;
}) {
  const [newDate, setNewDate] = useState(props.post.postDate);
  const [mode, setMode] = useState<"prompt" | "date">("prompt");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#FF7E00]/35 bg-[#12151C] p-5 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#FF7E00]">Not marked posted</p>
        <p className="mt-2 text-sm text-white/75">
          <strong>{props.post.postType}</strong> for {props.post.targetGroup} (scheduled {props.post.postDate}) has
          not been marked as posted on this tab.
        </p>
        {mode === "prompt" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={adminAccentButtonClass} disabled={props.busy} onClick={() => void props.onMarkPosted()}>
              Mark posted
            </button>
            <button type="button" className={adminSecondaryButtonClass} onClick={() => setMode("date")}>
              Change date
            </button>
            <button type="button" className={adminSecondaryButtonClass} disabled={props.busy} onClick={props.onDismiss}>
              Remind me later
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <label className={adminLabelClass}>New post date</label>
            <input type="date" className={adminInputClassSm} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <button type="button" className={adminPrimaryButtonClass} disabled={props.busy} onClick={() => void props.onUpdateDate(newDate)}>
              Save new date
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ContentGeneratorPanel(props: { configured: boolean }) {
  const [postType, setPostType] = useState<"Carousel" | "Static" | "Video">("Carousel");
  const [contentType, setContentType] = useState("Trainer Recruitment");
  const [tone, setTone] = useState("Bold / Direct");
  const [customNote, setCustomNote] = useState("");
  const [result, setResult] = useState<{
    hook: string;
    body: string;
    cta: string;
    hashtags: string[];
    dmScript?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CONTENT_TYPES = [
    "Trainer Recruitment",
    "Brand Awareness",
    "FitHub Feature",
    "Client Pain Point",
    "How It Works",
    "Social Proof",
  ];
  const TONES = ["Hype / Energetic", "Professional", "Conversational", "Bold / Direct"];
  const POST_TYPES = ["Carousel", "Static", "Video"] as const;

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
      const data = (await res.json()) as { result?: typeof result; error?: string };
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
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Content generator</p>
        <div>
          <p className={adminLabelClass}>Post type</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {POST_TYPES.map((t) => (
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
        </div>
        <div>
          <p className={adminLabelClass}>Content type</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {CONTENT_TYPES.map((c) => (
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
            {TONES.map((t) => (
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
        <button type="button" className={adminPrimaryButtonClass} disabled={loading || !props.configured} onClick={() => void generate()}>
          {loading ? "Generating…" : "Generate post"}
        </button>
        {error ? <p className="text-xs text-[#FFB4B4]">{error}</p> : null}
      </aside>
      <section className={`${adminPanelClass} min-h-[320px] p-6`}>
        {!result && !loading ? (
          <p className="text-sm text-white/40">Single-post generator — hook, body, CTA, and hashtags.</p>
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
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
