import "server-only";

import {
  generateBulkContent,
  generateStaticMedia,
  optimizePostForPlatforms,
  type BulkGeneratedDraft,
} from "@/lib/content-calendar/content-calendar-ai";
import {
  CONTENT_CALENDAR_PLATFORMS_BY_TYPE,
  CONTENT_CALENDAR_POST_TYPES,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import { MEDIA_DIMENSION_MATRIX } from "@/lib/content-calendar/content-prompts";
import { normalizeTargetGroup } from "@/lib/content-calendar/content-rules";
import { isMediaAspectRatio } from "@/lib/content-calendar/media-generation";
import { addWeekdays, formatCalendarDate } from "@/lib/content-calendar/rotation";
import { createNiBrainClient, type ContentCalendarPostRow } from "@/lib/ni-brain-client";
import { resolveArchivePurgeAfter } from "@/lib/content-calendar/cowork-jobs";

export type ContentCalendarV2Lane = "scheduled" | "impromptu";
export type ContentCalendarV2Stage = "hub" | "publishing" | "scheduled" | "archived";

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

export async function listV2Posts(args: {
  stage: ContentCalendarV2Stage;
  lane?: ContentCalendarV2Lane;
}): Promise<ContentCalendarPostRow[]> {
  await purgeExpiredV2Posts();
  const client = createNiBrainClient();
  let query = client
    .from("match_fit_content_calendar_posts")
    .select("*")
    .eq("workflow_stage", args.stage)
    .is("deleted_at", null);

  // Archived posts can be posted=true (posted then archived) or posted=false
  // (scrapped, never posted) — only non-archived stages exclude posted rows.
  if (args.stage !== "archived") {
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

/** Stages a post can sit in while it is approved but has not gone out yet. */
const PENDING_V2_STAGES = ["hub", "publishing", "scheduled"] as const;

/**
 * "Pending" means JB approved it and it has not gone out yet. That covers three stages: an approved
 * post still waiting in the hub for its media build, a post in publishing waiting for a posting
 * window, and a post with an exact scheduled time. Anything already posted, deleted, or archived is
 * not pending.
 */
export function isPendingV2Row(row: ContentCalendarPostRow): boolean {
  if (row.posted) return false;
  if (row.deleted_at) return false;
  const stage = row.workflow_stage ?? "hub";
  if (stage === "publishing" || stage === "scheduled") return true;
  return stage === "hub" && Boolean(row.approved_at);
}

/** Every approved-but-not-yet-posted row, soonest post date first. */
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

async function buildMediaUrls(args: {
  postType: ContentCalendarPostType;
  visualPrompt: string | null;
  caption: string;
}): Promise<{ urls: string[]; status: ContentCalendarPostRow["media_status"] }> {
  if (args.postType === "Text") return { urls: [], status: "none" };

  const prompt = args.visualPrompt?.trim() || args.caption;
  const count = args.postType === "Carousel" ? 3 : 1;
  // Real platform output shape, not the old hardcoded square.
  const aspectRatio = MEDIA_DIMENSION_MATRIX[args.postType].aspectRatio;
  const urls: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const framePrompt =
      args.postType === "Carousel"
        ? `${prompt}\nCarousel frame ${i + 1} of ${count}. Keep the same Match Fit visual system but vary the frame headline and composition.`
        : args.postType === "Video"
          ? `${prompt}\nCreate a storyboard keyframe / thumbnail preview for this short-form video concept.`
          : prompt;
    const result = await generateStaticMedia(
      framePrompt,
      isMediaAspectRatio(aspectRatio) ? aspectRatio : "1:1",
    );
    if (result.ok) urls.push(result.url);
    else console.error(`[content-calendar v2 draft media] ${args.postType} frame ${i + 1}: ${result.reason}`);
  }

  return { urls, status: urls.length ? "ready" : "failed" };
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
  const media = args.generateMedia
    ? await buildMediaUrls({
        postType: args.draft.postType,
        visualPrompt: args.draft.visualPrompt,
        caption: args.draft.caption,
      })
    : { urls: [] as string[], status: args.draft.postType === "Text" ? "none" : "none" };

  const row = {
    week_start: args.weekStart,
    post_date: args.postDate ?? args.draft.postDate ?? null,
    day_index: dayIndex,
    post_type: args.draft.postType,
    target_group: args.draft.targetGroup,
    platforms: args.draft.platforms || CONTENT_CALENDAR_PLATFORMS_BY_TYPE[args.draft.postType],
    status: "draft",
    caption: args.draft.caption,
    visual_prompt: args.draft.postType === "Text" ? null : args.draft.visualPrompt,
    hashtags: args.draft.hashtags ?? [],
    media_url: media.urls[0] ?? null,
    media_urls: media.urls,
    media_status: media.status,
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

  const { data, error } = await client.from("match_fit_content_calendar_posts").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as ContentCalendarPostRow;
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
    .select("id")
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
  const ids = (data ?? []).map((row) => row.id as string);
  if (!ids.length) return 0;

  const patch: Record<string, unknown> = {
    workflow_stage: "publishing",
    status: "publishing",
    updated_at: new Date().toISOString(),
  };
  if (args.lane === "impromptu") {
    patch.post_date = args.postDate;
    patch.is_scheduled = true;
  }

  const { error: updateError } = await client.from("match_fit_content_calendar_posts").update(patch).in("id", ids);
  if (updateError) throw new Error(updateError.message);
  return ids.length;
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
  await client
    .from("match_fit_content_calendar_posts")
    .update({ media_status: post.post_type === "Text" ? "none" : "generating", updated_at: new Date().toISOString() })
    .eq("id", postId);

  const media = await buildMediaUrls({
    postType: post.post_type,
    visualPrompt: post.visual_prompt,
    caption: post.caption,
  });
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      media_url: media.urls[0] ?? null,
      media_urls: media.urls,
      media_status: media.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
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
