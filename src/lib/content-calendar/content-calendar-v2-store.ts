import "server-only";

import {
  generateBulkContent,
  optimizePostForPlatforms,
  type BulkGeneratedDraft,
} from "@/lib/content-calendar/content-calendar-ai";
import {
  CONTENT_CALENDAR_PLATFORMS_BY_TYPE,
  CONTENT_CALENDAR_POST_TYPES,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import { normalizeTargetGroup } from "@/lib/content-calendar/content-rules";
import { insertGeneratedCalendarRow } from "@/lib/content-calendar/post-group";
import { addWeekdays, formatCalendarDate } from "@/lib/content-calendar/rotation";
import { computeManualPostSchedule } from "@/lib/content-calendar/pending-schedule";
import { createNiBrainClient, type ContentCalendarPostRow } from "@/lib/ni-brain-client";
import { resolveArchivePurgeAfter, queueMiniChromeAgentJob } from "@/lib/content-calendar/cowork-jobs";
import { sendTelegramPing } from "@/lib/content-calendar/telegram-ping";

export type ContentCalendarV2Lane = "scheduled" | "impromptu";
export type ContentCalendarV2Stage = "hub" | "pending" | "publishing" | "scheduled" | "archived";

export const CONTENT_CALENDAR_V2_ARCHIVE_RETENTION_HOURS = 72;

type JsonObject = Record<string, unknown>;

function normalizeJsonStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, row] of Object.entries(value as JsonObject)) {
    if (typeof row === "string") out[key] = row;
  }
  return out;
}

function normalizeJsonHashtagMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, row] of Object.entries(value as JsonObject)) {
    if (Array.isArray(row)) out[key] = row.filter((tag): tag is string => typeof tag === "string");
  }
  return out;
}

function normalizeMediaUrls(row: ContentCalendarPostRow): string[] {
  if (Array.isArray(row.media_urls)) return row.media_urls.filter((url): url is string => typeof url === "string");
  return row.media_url ? [row.media_url] : [];
}

export function splitPlatforms(platforms: string): string[] {
  return platforms
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function serializeV2Post(row: ContentCalendarPostRow) {
  return {
    id: row.id,
    weekStart: row.week_start,
    postDate: row.post_date ?? "",
    dayIndex: row.day_index,
    postType: row.post_type,
    targetGroup: normalizeTargetGroup(row.target_group),
    platforms: row.platforms,
    platformList: splitPlatforms(row.platforms),
    status: row.status ?? null,
    caption: row.caption,
    visualPrompt: row.visual_prompt,
    hashtags: row.hashtags ?? [],
    mediaUrl: row.media_url,
    mediaUrls: normalizeMediaUrls(row),
    mediaStatus: row.media_status,
    posted: row.posted,
    postedAt: row.posted_at,
    postedRetainUntil: row.posted_retain_until ?? null,
    approvedAt: row.approved_at ?? null,
    scheduledAt: row.scheduled_at ?? null,
    savedToHubAt: row.saved_to_hub_at ?? null,
    isScheduled: row.is_scheduled ?? false,
    theme: row.theme ?? "",
    cta: row.cta ?? "",
    contentLane: row.content_lane ?? "scheduled",
    workflowStage: row.workflow_stage ?? "hub",
    platformCaptions: normalizeJsonStringMap(row.platform_captions),
    platformHashtags: normalizeJsonHashtagMap(row.platform_hashtags),
    optimizeStatus: row.optimize_status ?? "idle",
    optimizeError: row.optimize_error ?? null,
    optimizeStartedAt: row.optimize_started_at ?? null,
    dpmoPhase: row.dpmo_phase ?? null,
    dpmoRationale: row.dpmo_rationale ?? null,
    socialScanSnapshotId: row.social_scan_snapshot_id ?? null,
    hashtagResearchSnapshot: row.hashtag_research_snapshot ?? null,
    archivedAt: row.archived_at ?? null,
    archiveType: row.archive_type ?? null,
    scrapReason: row.scrap_reason ?? null,
    postedUrls: row.posted_urls ?? {},
    purgeAfterAt: row.purge_after_at ?? null,
    bulkSessionId: row.bulk_session_id ?? null,
    deletedAt: row.deleted_at ?? null,
    postGroup: row.post_group ?? null,
    lastGenerationPrompt: row.last_generation_prompt ?? null,
    mediaGenerationStartedAt: row.media_generation_started_at ?? null,
    mediaProgress: typeof row.media_progress === "number" ? row.media_progress : null,
    mediaProgressStage: row.media_progress_stage ?? null,
    mediaProgressUpdatedAt: row.media_progress_updated_at ?? null,
    generationSource: row.generation_source ?? null,
  };
}

export type ClientContentCalendarV2Post = ReturnType<typeof serializeV2Post>;

export async function purgeExpiredV2Posts(): Promise<void> {
  const client = createNiBrainClient();
  const { data } = await client
    .from("match_fit_content_calendar_posts")
    .select("id")
    .not("purge_after_at", "is", null)
    .lte("purge_after_at", new Date().toISOString());

  const ids = (data ?? []).map((row) => row.id as string).filter(Boolean);
  if (!ids.length) return;
  const { error } = await client.from("match_fit_content_calendar_posts").delete().in("id", ids);
  if (error) throw new Error(error.message);
}

/**
 * A manually-posted post confirmed "POSTED" stays on the Scheduled tab as Posted for 48h
 * (posted_retain_until). Once that window passes it rolls into Archives as a posted post — the same
 * end-state a normal agent post reaches — instead of lingering on Scheduled forever.
 */
export async function archiveExpiredPostedScheduled(): Promise<void> {
  const client = createNiBrainClient();
  const nowIso = new Date().toISOString();
  const { data } = await client
    .from("match_fit_content_calendar_posts")
    .select("id")
    .eq("workflow_stage", "scheduled")
    .eq("posted", true)
    .not("posted_retain_until", "is", null)
    .lte("posted_retain_until", nowIso);

  const ids = (data ?? []).map((row) => row.id as string).filter(Boolean);
  if (!ids.length) return;
  const purgeAfter = await resolveArchivePurgeAfter("posted", new Date());
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      workflow_stage: "archived",
      status: "posted",
      archive_type: "posted",
      archived_at: nowIso,
      purge_after_at: purgeAfter,
      updated_at: nowIso,
    })
    .in("id", ids);
  if (error) throw new Error(error.message);
}

export async function listV2Posts(args: {
  stage: ContentCalendarV2Stage;
  lane?: ContentCalendarV2Lane;
}): Promise<ContentCalendarPostRow[]> {
  await purgeExpiredV2Posts();
  await archiveExpiredPostedScheduled();
  const client = createNiBrainClient();
  let query = client
    .from("match_fit_content_calendar_posts")
    .select("*")
    .eq("workflow_stage", args.stage)
    .is("deleted_at", null);

  // Archived posts can be posted=true (posted then archived) or posted=false (scrapped, never
  // posted). The Scheduled tab also shows recently-posted rows — a manually-posted post confirmed
  // "POSTED" stays there as Posted for 48h (posted_retain_until) before rolling into Archives — so
  // only the other non-archived stages exclude posted rows.
  if (args.stage !== "archived" && args.stage !== "scheduled") {
    query = query.eq("posted", false);
  }

  if (args.lane) query = query.eq("content_lane", args.lane);

  const { data, error } =
    args.stage === "scheduled"
      ? await query.order("scheduled_at", { ascending: true, nullsFirst: false })
      : await query.order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ContentCalendarPostRow[];
}

/**
 * @deprecated Pending is now a real workflow_stage ("pending"), not a derived concept spanning
 * hub/publishing/scheduled. Left working for existing callers; nothing new should read this.
 */
const PENDING_V2_STAGES = ["hub", "publishing", "scheduled"] as const;

/**
 * @deprecated See {@link PENDING_V2_STAGES}. "Pending" means JB approved it and it has not gone out
 * yet. That covers three stages: an approved post still waiting in the hub for its media build, a
 * post in publishing waiting for a posting window, and a post with an exact scheduled time.
 * Anything already posted, deleted, or archived is not pending. New code should filter on
 * `workflow_stage === "pending"` directly instead.
 */
export function isPendingV2Row(row: ContentCalendarPostRow): boolean {
  if (row.posted) return false;
  if (row.deleted_at) return false;
  const stage = row.workflow_stage ?? "hub";
  if (stage === "publishing" || stage === "scheduled") return true;
  return stage === "hub" && Boolean(row.approved_at);
}

/**
 * @deprecated See {@link PENDING_V2_STAGES}. Every approved-but-not-yet-posted row, soonest post
 * date first. New code should call {@link listV2Posts} with `stage: "pending"` instead.
 */
export async function listPendingV2Posts(): Promise<ContentCalendarPostRow[]> {
  await purgeExpiredV2Posts();
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("*")
    .in("workflow_stage", [...PENDING_V2_STAGES])
    .eq("posted", false)
    .is("deleted_at", null)
    .order("post_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ContentCalendarPostRow[]).filter(isPendingV2Row);
}

/**
 * WF1.01 fix: a catch-up run can build yesterday and queue tomorrow while silently skipping
 * today, and nothing previously asserted that today's four-pack (one post per
 * CONTENT_CALENDAR_POST_TYPES) actually exists. Called from the daily sync cron so a gap fails
 * loudly instead of leaving an empty day nobody notices until send time.
 */
export async function findTodaysMissingPostTypes(today: string): Promise<ContentCalendarPostType[]> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("post_type")
    .eq("post_date", today)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  const present = new Set((data ?? []).map((row) => row.post_type as ContentCalendarPostType));
  return CONTENT_CALENDAR_POST_TYPES.filter((postType) => !present.has(postType));
}

export async function getV2Post(postId: string): Promise<ContentCalendarPostRow | null> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as ContentCalendarPostRow | null;
}

async function resolveUniqueDayIndex(args: {
  weekStart: string;
  postType: ContentCalendarPostType;
  preferredDayIndex: number;
}): Promise<number> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("day_index")
    .eq("week_start", args.weekStart)
    .eq("post_type", args.postType);
  if (error) throw new Error(error.message);

  const used = new Set((data ?? []).map((row) => Number(row.day_index)));
  if (!used.has(args.preferredDayIndex)) return args.preferredDayIndex;
  // day_index is DB-constrained to 0-4 (Mon-Fri, match_fit_content_calendar_posts_day_index_check).
  // Bug fixed 2026-08-02: this used to loop to 500 and hand back an out-of-range value, which the
  // DB then rejected with an opaque check-constraint 500 instead of this clear message.
  for (let dayIndex = 0; dayIndex <= 4; dayIndex += 1) {
    if (!used.has(dayIndex)) return dayIndex;
  }
  throw new Error(
    `No available content calendar slot for ${args.postType} in week ${args.weekStart} — all 5 weekday slots (day_index 0-4) are already taken.`,
  );
}

/**
 * Media is NEVER generated over an API here (Decision #1699 / JB direct 2026-09-03: it is
 * JB's Gemini subscription in Chrome on the Mac mini, never generativelanguage.googleapis.com).
 * This just decides the starting media_status for a new/regenerated post — the actual pixels
 * come later from queueMiniAgentForPost() once the row has an id.
 */
function initialMediaStatus(postType: ContentCalendarPostType): ContentCalendarPostRow["media_status"] {
  return postType === "Text" ? "none" : "generating";
}

/**
 * Queues the real producer — scripts/gemini-media-automation.mjs on the Mac mini, driving JB's
 * own logged-in Gemini web session — for one already-created post. Fire-and-forget: failure to
 * queue is logged, never thrown, so it can't take down draft creation/regeneration. The mini
 * writes media_url/media_urls/media_status back onto the row itself when it finishes (see
 * scripts/gemini-media-automation.mjs writeMediaResult).
 */
function queueMiniAgentForPost(args: { postId: string; postType: ContentCalendarPostType }): void {
  if (args.postType === "Text") return;
  queueMiniChromeAgentJob({ ids: [args.postId], title: `Content calendar media: ${args.postId}` }).catch((e) =>
    console.error(`[content-calendar v2 draft media] queueMiniChromeAgentJob failed for ${args.postId}:`, e),
  );
}

export async function createV2Draft(args: {
  draft: BulkGeneratedDraft;
  weekStart: string;
  lane: ContentCalendarV2Lane;
  adminId: string;
  theme?: string;
  cta?: string;
  postDate?: string | null;
  generateMedia?: boolean;
  dpmoPhase?: string | null;
  dpmoRationale?: string | null;
  socialScanSnapshotId?: string | null;
  hashtagResearchSnapshot?: Record<string, unknown> | null;
}): Promise<ContentCalendarPostRow> {
  const client = createNiBrainClient();
  const now = new Date().toISOString();
  const dayIndex = await resolveUniqueDayIndex({
    weekStart: args.weekStart,
    postType: args.draft.postType,
    preferredDayIndex: args.draft.dayIndex,
  });
  // Bug fixed 2026-08-13: when resolveUniqueDayIndex bumps a post to a different day than the
  // caller planned for (its preferred day_index was already taken in this week), the caller's
  // postDate still points at the ORIGINAL day. That desync shipped a scheduled post with e.g.
  // day_index=3 but post_date stamped for day_index=0's date -- the admin calendar then showed
  // it on the wrong day (proven live: a weekly-generate backfill for week 2026-08-10 created
  // Thu/Fri posts with day_index 3/4 but post_date stuck at the Monday week_start). Recompute
  // post_date from the RESOLVED day_index whenever the post is week-anchored (weekStart-based
  // scheduling), so the stored date always matches the slot it actually landed in.
  const callerPostDate = args.postDate ?? args.draft.postDate ?? null;
  const postDate =
    dayIndex !== args.draft.dayIndex && args.weekStart
      ? formatCalendarDate(addWeekdays(new Date(`${args.weekStart}T00:00:00`), dayIndex))
      : callerPostDate;
  const mediaStatus = args.generateMedia ? initialMediaStatus(args.draft.postType) : "none";

  const row = {
    week_start: args.weekStart,
    post_date: postDate,
    day_index: dayIndex,
    post_type: args.draft.postType,
    target_group: args.draft.targetGroup,
    platforms: args.draft.platforms || CONTENT_CALENDAR_PLATFORMS_BY_TYPE[args.draft.postType],
    status: "draft",
    caption: args.draft.caption,
    visual_prompt: args.draft.postType === "Text" ? null : args.draft.visualPrompt,
    hashtags: args.draft.hashtags ?? [],
    media_url: null,
    media_urls: [],
    media_status: mediaStatus,
    posted: false,
    missed_prompt_dismissed: false,
    saved_to_hub_at: now,
    is_scheduled: Boolean(args.postDate ?? args.draft.postDate),
    content_lane: args.lane,
    workflow_stage: "hub",
    theme: args.theme ?? "",
    cta: args.cta ?? "",
    platform_captions: {},
    platform_hashtags: {},
    optimize_status: "idle",
    optimize_error: null,
    optimize_started_at: null,
    dpmo_phase: args.dpmoPhase ?? null,
    dpmo_rationale: args.dpmoRationale ?? null,
    social_scan_snapshot_id: args.socialScanSnapshotId ?? null,
    hashtag_research_snapshot: args.hashtagResearchSnapshot ?? null,
    archived_at: null,
    purge_after_at: null,
    bulk_session_id: args.draft.tempId,
    admin_id: args.adminId,
    created_at: now,
    updated_at: now,
  };

  // post_group is resolved and asserted here, never left to the column default.
  // A row that cannot get a valid 5pm/8pm group is written as `blocked` with a reason
  // instead of a draft that would silently never post.
  const inserted = await insertGeneratedCalendarRow({
    client,
    row,
    weekStart: args.weekStart,
    dayIndex,
    source: "createV2Draft",
  });
  if (args.generateMedia) {
    queueMiniAgentForPost({ postId: inserted.id, postType: inserted.post_type });
  }
  return inserted;
}

export async function generateWeeklyPlannerDay(args: {
  weekStart: string;
  dayIndex: number;
  theme: string;
  targetAudience: string;
  cta: string;
  prompts: Record<ContentCalendarPostType, string>;
  adminId: string;
}): Promise<ContentCalendarPostRow[]> {
  const items = CONTENT_CALENDAR_POST_TYPES.map((postType) => ({
    postType,
    targetGroup: normalizeTargetGroup(args.targetAudience),
  }));
  const customPrompt = [
    `Weekly planner day theme: ${args.theme}`,
    `Target audience: ${args.targetAudience}`,
    `CTA: ${args.cta}`,
    ...CONTENT_CALENDAR_POST_TYPES.map((postType) => `${postType} prompt: ${args.prompts[postType]}`),
    "Generate exactly the four locked daily post types: Static, Carousel, Text, Video. Keep each prompt's intent distinct.",
  ].join("\n");

  const { drafts } = await generateBulkContent({
    items,
    scheduled: false,
    customPrompt,
    weekStart: args.weekStart,
  });
  const monday = new Date(`${args.weekStart}T00:00:00`);
  const postDate = formatCalendarDate(addWeekdays(monday, args.dayIndex));
  const rows: ContentCalendarPostRow[] = [];
  for (const postType of CONTENT_CALENDAR_POST_TYPES) {
    const draft = drafts.find((d) => d.postType === postType) ?? drafts[CONTENT_CALENDAR_POST_TYPES.indexOf(postType)];
    if (!draft) continue;
    rows.push(
      await createV2Draft({
        draft: { ...draft, postType, dayIndex: args.dayIndex, postDate },
        weekStart: args.weekStart,
        lane: "scheduled",
        adminId: args.adminId,
        theme: args.theme,
        cta: args.cta,
        postDate,
        generateMedia: true,
      }),
    );
  }
  return rows;
}

export async function updateV2PostFields(args: {
  postId: string;
  caption?: string;
  hashtags?: string[];
  visualPrompt?: string | null;
  theme?: string;
  targetGroup?: string;
  cta?: string;
  dpmoRationale?: string | null;
  postDate?: string | null;
  platformCaptions?: Record<string, string>;
  platformHashtags?: Record<string, string[]>;
}): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (args.caption !== undefined) patch.caption = args.caption;
  if (args.hashtags !== undefined) patch.hashtags = args.hashtags;
  if (args.visualPrompt !== undefined) patch.visual_prompt = args.visualPrompt;
  if (args.theme !== undefined) patch.theme = args.theme;
  if (args.targetGroup !== undefined) patch.target_group = normalizeTargetGroup(args.targetGroup);
  if (args.cta !== undefined) patch.cta = args.cta;
  if (args.dpmoRationale !== undefined) patch.dpmo_rationale = args.dpmoRationale;
  // Content Hub scheduling: the operator picks which day a hub/impromptu post goes up, without
  // moving it out of the hub. Empty string clears the date back to unscheduled.
  if (args.postDate !== undefined) patch.post_date = args.postDate ? args.postDate : null;
  if (args.platformCaptions !== undefined) patch.platform_captions = args.platformCaptions;
  if (args.platformHashtags !== undefined) patch.platform_hashtags = args.platformHashtags;

  const client = createNiBrainClient();
  const { error } = await client.from("match_fit_content_calendar_posts").update(patch).eq("id", args.postId);
  if (error) throw new Error(error.message);
}

export async function approveV2Post(postId: string): Promise<void> {
  const now = new Date().toISOString();
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({ approved_at: now, status: "approved", updated_at: now })
    .eq("id", postId);
  if (error) throw new Error(error.message);
}

export async function submitApprovedV2Posts(args: {
  lane: ContentCalendarV2Lane;
  postDate?: string;
}): Promise<number> {
  const client = createNiBrainClient();
  let read = client
    .from("match_fit_content_calendar_posts")
    .select("id, post_type")
    .eq("workflow_stage", "hub")
    .eq("content_lane", args.lane)
    .not("approved_at", "is", null)
    .is("deleted_at", null);

  if (args.lane === "impromptu") {
    if (!args.postDate) throw new Error("Select a post date before submitting impromptu drafts.");
    read = read.or(`post_date.is.null,post_date.eq.${args.postDate}`);
  }

  const { data, error } = await read;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; post_type: ContentCalendarPostType }[];
  if (!rows.length) return 0;

  const now = new Date().toISOString();
  // Impromptu posts get their date/scheduled flag stamped regardless of which stage they land in.
  const impromptuExtra: Record<string, unknown> =
    args.lane === "impromptu" ? { post_date: args.postDate, is_scheduled: true } : {};

  // Media posts still need a build (or a bypass) before they can post, so they land in "pending".
  // Text posts have nothing to build and go straight to "publishing", same as before.
  const mediaIds = rows.filter((row) => row.post_type !== "Text").map((row) => row.id);
  const textIds = rows.filter((row) => row.post_type === "Text").map((row) => row.id);

  if (mediaIds.length) {
    const { error: updateError } = await client
      .from("match_fit_content_calendar_posts")
      .update({ workflow_stage: "pending", status: "pending", updated_at: now, ...impromptuExtra })
      .in("id", mediaIds);
    if (updateError) throw new Error(updateError.message);
  }

  if (textIds.length) {
    const { error: updateError } = await client
      .from("match_fit_content_calendar_posts")
      .update({ workflow_stage: "publishing", status: "publishing", updated_at: now, ...impromptuExtra })
      .in("id", textIds);
    if (updateError) throw new Error(updateError.message);
  }

  return rows.length;
}

export async function moveV2PostToDrafts(postId: string): Promise<void> {
  const now = new Date().toISOString();
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      workflow_stage: "hub",
      status: "draft",
      approved_at: null,
      optimize_status: "idle",
      optimize_error: null,
      optimize_started_at: null,
      updated_at: now,
    })
    .eq("id", postId);
  if (error) throw new Error(error.message);
}

/**
 * Pulls an approved post back out of the batch and returns it to drafts so it can be edited again.
 * Generated media is deliberately left attached — JB may want to keep the pictures.
 *
 * Refuses on an already-posted row rather than pretending a post can be un-sent.
 */
export async function sendV2PostBackToDrafts(postId: string): Promise<ContentCalendarPostRow> {
  const post = await getV2Post(postId);
  if (!post) throw new Error("That post could not be found.");
  if (post.posted) {
    throw new Error("That post has already gone out, so it cannot be pulled back. Nothing was changed.");
  }

  const now = new Date().toISOString();
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      workflow_stage: "hub",
      status: "draft",
      approved_at: null,
      scheduled_at: null,
      revision: (post.revision ?? 1) + 1,
      updated_at: now,
    })
    .eq("id", postId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContentCalendarPostRow;
}

export async function regenerateV2PostMedia(postId: string): Promise<ContentCalendarPostRow> {
  const post = await getV2Post(postId);
  if (!post) throw new Error("Post not found.");
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      media_url: null,
      media_urls: [],
      media_status: initialMediaStatus(post.post_type),
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  queueMiniAgentForPost({ postId, postType: post.post_type });
  return data as ContentCalendarPostRow;
}

export async function startV2Optimization(args: { postId: string; platforms: string[] }): Promise<void> {
  if (!args.platforms.length) throw new Error("Select at least one platform before optimizing.");
  const now = new Date().toISOString();
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      platforms: args.platforms.join(", "),
      optimize_status: "running",
      optimize_error: null,
      optimize_started_at: now,
      updated_at: now,
    })
    .eq("id", args.postId);
  if (error) throw new Error(error.message);
}

export async function runV2OptimizationJob(postId: string): Promise<void> {
  const post = await getV2Post(postId);
  if (!post) return;
  const client = createNiBrainClient();
  try {
    const platforms = splitPlatforms(post.platforms);
    const optimized = await optimizePostForPlatforms({
      postType: post.post_type,
      targetGroup: post.target_group,
      theme: post.theme,
      cta: post.cta,
      caption: post.caption,
      hashtags: post.hashtags ?? [],
      platforms,
    });
    const captions = Object.fromEntries(Object.entries(optimized).map(([platform, row]) => [platform, row.caption]));
    const hashtags = Object.fromEntries(Object.entries(optimized).map(([platform, row]) => [platform, row.hashtags]));
    const { error } = await client
      .from("match_fit_content_calendar_posts")
      .update({
        platform_captions: captions,
        platform_hashtags: hashtags,
        optimize_status: "done",
        optimize_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);
    if (error) throw new Error(error.message);
  } catch (e) {
    await client
      .from("match_fit_content_calendar_posts")
      .update({
        optimize_status: "failed",
        optimize_error: e instanceof Error ? e.message : "Optimization failed.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);
  }
}

export async function resumeRunningV2Optimizations(posts: ContentCalendarPostRow[]): Promise<void> {
  for (const post of posts) {
    if (post.optimize_status === "running") {
      void runV2OptimizationJob(post.id);
    }
  }
}

export async function scheduleV2Post(args: { postId: string; scheduledAt: string }): Promise<void> {
  const scheduled = new Date(args.scheduledAt);
  if (Number.isNaN(scheduled.getTime())) throw new Error("Pick a valid schedule date and time.");
  const now = new Date().toISOString();
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      workflow_stage: "scheduled",
      status: "scheduled",
      scheduled_at: scheduled.toISOString(),
      post_date: formatCalendarDate(scheduled),
      is_scheduled: true,
      updated_at: now,
    })
    .eq("id", args.postId);
  if (error) throw new Error(error.message);
}

export async function cancelV2ScheduledPost(postId: string): Promise<void> {
  const now = new Date().toISOString();
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      workflow_stage: "hub",
      status: "draft",
      scheduled_at: null,
      approved_at: null,
      updated_at: now,
    })
    .eq("id", postId);
  if (error) throw new Error(error.message);
}

/**
 * Manually archives a post that was never posted ("scrapped"). Purge window comes from settings
 * (scrapped_retention_days) rather than a hardcoded constant.
 */
export async function archiveV2Post(postId: string, args?: { scrapReason?: string | null }): Promise<void> {
  const now = new Date();
  const purgeAfter = await resolveArchivePurgeAfter("scrapped", now);
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      workflow_stage: "archived",
      status: "archived",
      archive_type: "scrapped",
      scrap_reason: args?.scrapReason ?? null,
      archived_at: now.toISOString(),
      purge_after_at: purgeAfter,
      updated_at: now.toISOString(),
    })
    .eq("id", postId);
  if (error) throw new Error(error.message);
}

/**
 * "Manually Post" (JB 2026-09-03): pressing Manually Post no longer archives the post. It moves the
 * post to the Scheduled tab awaiting a POSTED confirmation — JB posts it himself, then presses
 * POSTED to confirm it actually went out (markV2PostPosted). Until then it sits on Scheduled as
 * "Waiting for you to confirm". Computes the same placeholder schedule the Pending page math uses
 * when the post has no explicit scheduled_at yet.
 */
export async function manuallyPostV2Post(postId: string): Promise<ContentCalendarPostRow> {
  const post = await getV2Post(postId);
  if (!post) throw new Error("Post not found.");
  if (!post.post_date) {
    throw new Error("This post has no post date set, so a manual posting time cannot be computed.");
  }

  const now = new Date().toISOString();
  const scheduledAt = post.scheduled_at ?? computeManualPostSchedule(post.post_date).toISOString();
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      scheduled_at: scheduledAt,
      is_scheduled: true,
      posted: false,
      workflow_stage: "scheduled",
      status: "ready_to_post",
      updated_at: now,
    })
    .eq("id", postId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContentCalendarPostRow;
}

const POSTED_RETAIN_HOURS = 48;

/**
 * POSTED confirmation on the Scheduled tab: the operator confirms the post actually went out. It
 * flips to Posted and stays on the Scheduled tab for 48h (posted_retain_until) before
 * archiveExpiredPostedScheduled rolls it into Archives. Fires the same per-post-type Telegram ping
 * and day-fully-posted check the agent post-batch path fires.
 */
export async function markV2PostPosted(postId: string): Promise<ContentCalendarPostRow> {
  const post = await getV2Post(postId);
  if (!post) throw new Error("Post not found.");
  const now = new Date();
  const retainUntil = new Date(now.getTime() + POSTED_RETAIN_HOURS * 60 * 60 * 1000).toISOString();
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      posted: true,
      posted_at: now.toISOString(),
      posted_retain_until: retainUntil,
      status: "posted",
      workflow_stage: "scheduled",
      updated_at: now.toISOString(),
    })
    .eq("id", postId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  void sendTelegramPing(`Match Fit: ${post.post_type} posted.`);
  if (post.post_date) {
    const { maybeNotifyDayFullyPosted } = await import(
      "@/lib/content-calendar/content-calendar-cowork-orchestration"
    );
    await maybeNotifyDayFullyPosted(post.post_date).catch((e) => {
      console.error(`[content-calendar day email] all-posted check failed for ${post.post_date}:`, e);
    });
  }
  return data as ContentCalendarPostRow;
}

/** Undo a POSTED confirmation — the operator can change the status back to not-yet-posted. */
export async function markV2PostUnposted(postId: string): Promise<ContentCalendarPostRow> {
  const now = new Date().toISOString();
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      posted: false,
      posted_at: null,
      posted_retain_until: null,
      status: "ready_to_post",
      workflow_stage: "scheduled",
      updated_at: now,
    })
    .eq("id", postId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContentCalendarPostRow;
}

/** Send a scheduled post back to Publishing (JB: "send the post back to publishing from the scheduled tab"). */
export async function sendV2PostBackToPublishing(postId: string): Promise<ContentCalendarPostRow> {
  const now = new Date().toISOString();
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      workflow_stage: "publishing",
      status: "publishing",
      posted: false,
      posted_at: null,
      posted_retain_until: null,
      scheduled_at: null,
      is_scheduled: false,
      updated_at: now,
    })
    .eq("id", postId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContentCalendarPostRow;
}

/**
 * Manual-prompt flow (JB 2026-09-03): the operator uploaded their own media on the Pending tab and
 * pressed APPROVE FOR PUBLISHING. Attach the uploaded media (if any) and advance pending→publishing.
 * Text/no-media posts are allowed through with whatever media they already carry.
 */
export async function approveV2PostForPublishing(
  postId: string,
  args?: { mediaUrls?: string[] },
): Promise<ContentCalendarPostRow> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    workflow_stage: "publishing",
    status: "publishing",
    updated_at: now,
  };
  if (args?.mediaUrls?.length) {
    patch.media_url = args.mediaUrls[0] ?? null;
    patch.media_urls = args.mediaUrls;
    patch.media_status = "ready";
    patch.generation_source = "manual_upload";
    patch.media_progress = 100;
    patch.media_progress_stage = "done";
    patch.media_progress_updated_at = now;
  }
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .update(patch)
    .eq("id", postId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContentCalendarPostRow;
}

/** Remove the media from a post (Publishing tab), leaving it in place to re-upload or regenerate. */
export async function removeV2PostMedia(postId: string): Promise<ContentCalendarPostRow> {
  const now = new Date().toISOString();
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      media_url: null,
      media_urls: [],
      media_status: "none",
      generation_source: null,
      media_progress: null,
      media_progress_stage: null,
      media_progress_updated_at: null,
      updated_at: now,
    })
    .eq("id", postId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContentCalendarPostRow;
}

/**
 * Manual media replacement: JB uploaded new media directly instead of regenerating it. Plain field
 * update — the post stays in "publishing", nothing about its stage changes.
 */
export async function manuallyRedoV2PostMedia(
  postId: string,
  args: { mediaUrls: string[] },
): Promise<ContentCalendarPostRow> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      media_url: args.mediaUrls[0] ?? null,
      media_urls: args.mediaUrls,
      media_status: "ready",
      generation_source: "manual_upload",
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContentCalendarPostRow;
}

export async function reviveV2Post(postId: string): Promise<void> {
  const now = new Date().toISOString();
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      workflow_stage: "hub",
      status: "draft",
      approved_at: null,
      archived_at: null,
      archive_type: null,
      scrap_reason: null,
      purge_after_at: null,
      updated_at: now,
    })
    .eq("id", postId);
  if (error) throw new Error(error.message);
}
