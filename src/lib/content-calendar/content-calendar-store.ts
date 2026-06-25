import "server-only";

import {
  CONTENT_CALENDAR_PLATFORMS_BY_TYPE,
  CONTENT_CALENDAR_POST_TYPES,
  CONTENT_HUB_DELETE_RETENTION_HOURS,
} from "@/lib/content-calendar/constants";
import { addWeekdays, formatCalendarDate, getContentCalendarRotation } from "@/lib/content-calendar/rotation";
import { normalizeTargetGroup } from "@/lib/content-calendar/content-rules";
import type { GeneratedWeekPost, BulkGeneratedDraft } from "@/lib/content-calendar/content-calendar-ai";
import { createNiBrainClient, type ContentCalendarPostRow } from "@/lib/ni-brain-client";

export async function loadWeekSchedule(weekStart: string): Promise<ContentCalendarPostRow[]> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("*")
    .eq("week_start", weekStart)
    .eq("posted", false)
    .order("day_index")
    .order("post_type");

  if (error) throw new Error(error.message);
  return (data ?? []) as ContentCalendarPostRow[];
}

export async function loadWeekScheduleIncludingPosted(weekStart: string): Promise<ContentCalendarPostRow[]> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("*")
    .eq("week_start", weekStart)
    .order("day_index")
    .order("post_type");

  if (error) throw new Error(error.message);
  return (data ?? []) as ContentCalendarPostRow[];
}

export async function upsertWeekPosts(args: {
  weekStart: string;
  offset: number;
  posts: GeneratedWeekPost[];
  adminId: string;
}): Promise<ContentCalendarPostRow[]> {
  const client = createNiBrainClient();
  const monday = new Date(`${args.weekStart}T00:00:00`);
  const rows = args.posts.map((p) => {
    const postDate = formatCalendarDate(addWeekdays(monday, p.dayIndex));
    const rot = getContentCalendarRotation(p.dayIndex, args.offset);
    return {
      week_start: args.weekStart,
      post_date: postDate,
      day_index: p.dayIndex,
      post_type: p.postType,
      target_group: p.targetGroup ?? rot[p.postType],
      platforms: p.platforms ?? CONTENT_CALENDAR_PLATFORMS_BY_TYPE[p.postType],
      caption: p.caption,
      visual_prompt: p.visualPrompt,
      hashtags: p.hashtags ?? [],
      media_status: "none" as const,
      posted: false,
      missed_prompt_dismissed: false,
      saved_to_hub_at: null,
      is_scheduled: false,
      purge_after_at: null,
      bulk_session_id: null,
      admin_id: args.adminId,
      updated_at: new Date().toISOString(),
    };
  });

  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .upsert(rows, { onConflict: "week_start,day_index,post_type" })
    .select("*");

  if (error) throw new Error(error.message);
  return (data ?? []) as ContentCalendarPostRow[];
}

export async function updatePostFields(args: {
  postId: string;
  caption?: string;
  visualPrompt?: string | null;
  hashtags?: string[];
}): Promise<void> {
  const client = createNiBrainClient();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (args.caption !== undefined) patch.caption = args.caption;
  if (args.visualPrompt !== undefined) patch.visual_prompt = args.visualPrompt;
  if (args.hashtags !== undefined) patch.hashtags = args.hashtags;
  const { error } = await client.from("match_fit_content_calendar_posts").update(patch).eq("id", args.postId);
  if (error) throw new Error(error.message);
}

/** @deprecated Use updatePostFields */
export async function updatePostCaption(args: {
  postId: string;
  caption: string;
  visualPrompt?: string | null;
}): Promise<void> {
  await updatePostFields(args);
}

export async function markPostPosted(postId: string, autoPurgeAfter24h = false): Promise<void> {
  const client = createNiBrainClient();
  const now = new Date();
  const purgeAfter = autoPurgeAfter24h ? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() : null;
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      posted: true,
      posted_at: now.toISOString(),
      purge_after_at: purgeAfter,
      updated_at: now.toISOString(),
    })
    .eq("id", postId);
  if (error) throw new Error(error.message);
}

export async function reschedulePost(args: { postId: string; newDate: string }): Promise<void> {
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      post_date: args.newDate,
      missed_prompt_dismissed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.postId);
  if (error) throw new Error(error.message);
}

export async function softDeletePost(postId: string): Promise<void> {
  const client = createNiBrainClient();
  const now = new Date();
  const purgeAfter = new Date(now.getTime() + CONTENT_HUB_DELETE_RETENTION_HOURS * 60 * 60 * 1000);
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      deleted_at: now.toISOString(),
      purge_after_at: purgeAfter.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", postId);
  if (error) throw new Error(error.message);
}

export async function restoreDeletedPost(postId: string): Promise<void> {
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      deleted_at: null,
      purge_after_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
  if (error) throw new Error(error.message);
}

/** @deprecated Use softDeletePost */
export async function deletePost(postId: string): Promise<void> {
  await softDeletePost(postId);
}

export async function deleteWeekPosts(weekStart: string): Promise<void> {
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .delete()
    .eq("week_start", weekStart)
    .eq("posted", false);
  if (error) throw new Error(error.message);
}

export async function dismissMissedPrompt(postId: string): Promise<void> {
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({ missed_prompt_dismissed: true, updated_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw new Error(error.message);
}

export async function updatePostMedia(args: {
  postId: string;
  mediaUrl: string | null;
  mediaStatus: ContentCalendarPostRow["media_status"];
}): Promise<void> {
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      media_url: args.mediaUrl,
      media_status: args.mediaStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.postId);
  if (error) throw new Error(error.message);
}

export async function loadMissedPosts(): Promise<ContentCalendarPostRow[]> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("*")
    .eq("posted", false)
    .eq("missed_prompt_dismissed", false)
    .order("post_date");

  if (error) throw new Error(error.message);
  return ((data ?? []) as ContentCalendarPostRow[]).filter((p) =>
    CONTENT_CALENDAR_POST_TYPES.includes(p.post_type),
  );
}

export async function loadHubPosts(): Promise<ContentCalendarPostRow[]> {
  const client = createNiBrainClient();
  await purgeExpiredHubPosts();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("*")
    .not("saved_to_hub_at", "is", null)
    .is("deleted_at", null)
    .eq("posted", false)
    .order("saved_to_hub_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ContentCalendarPostRow[];
}

export async function loadDeletedHubPosts(): Promise<ContentCalendarPostRow[]> {
  const client = createNiBrainClient();
  await purgeExpiredHubPosts();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ContentCalendarPostRow[];
}

export async function loadScheduledPosts(): Promise<ContentCalendarPostRow[]> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("*")
    .eq("is_scheduled", true)
    .is("deleted_at", null)
    .eq("posted", false)
    .order("post_date");

  if (error) throw new Error(error.message);
  return (data ?? []) as ContentCalendarPostRow[];
}

export async function purgeExpiredHubPosts(): Promise<number> {
  const client = createNiBrainClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("id")
    .not("purge_after_at", "is", null)
    .lte("purge_after_at", now);

  if (error || !data?.length) return 0;

  const ids = data.map((r) => r.id as string);
  const { error: delErr } = await client.from("match_fit_content_calendar_posts").delete().in("id", ids);
  if (delErr) throw new Error(delErr.message);
  return ids.length;
}

/** Avoid unique (week_start, day_index, post_type) collisions when saving multiple hub drafts. */
export async function resolveUniqueHubDayIndex(args: {
  weekStart: string;
  postType: ContentCalendarPostRow["post_type"];
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

  for (let dayIndex = 0; dayIndex < 100; dayIndex += 1) {
    if (!used.has(dayIndex)) return dayIndex;
  }

  throw new Error(`No available slot for ${args.postType} posts in week ${args.weekStart}.`);
}

export async function saveDraftToHub(args: {
  draft: BulkGeneratedDraft;
  weekStart: string;
  scheduled: boolean;
  adminId: string;
  bulkSessionId: string;
}): Promise<ContentCalendarPostRow> {
  const client = createNiBrainClient();
  const now = new Date().toISOString();
  const dayIndex = await resolveUniqueHubDayIndex({
    weekStart: args.weekStart,
    postType: args.draft.postType,
    preferredDayIndex: args.draft.dayIndex,
  });
  const postDate = args.scheduled
    ? formatCalendarDate(addWeekdays(new Date(`${args.weekStart}T00:00:00`), Math.min(4, dayIndex)))
    : args.draft.postDate ?? args.weekStart;

  const row = {
    week_start: args.weekStart,
    post_date: postDate,
    day_index: dayIndex,
    post_type: args.draft.postType,
    target_group: args.draft.targetGroup,
    platforms: args.draft.platforms,
    caption: args.draft.caption,
    visual_prompt: args.draft.visualPrompt,
    hashtags: args.draft.hashtags ?? [],
    media_status: "none" as const,
    posted: false,
    missed_prompt_dismissed: false,
    saved_to_hub_at: now,
    is_scheduled: args.scheduled,
    purge_after_at: null,
    bulk_session_id: args.bulkSessionId,
    admin_id: args.adminId,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await client.from("match_fit_content_calendar_posts").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as ContentCalendarPostRow;
}

export async function updateHubPostDate(args: { postId: string; postDate: string }): Promise<void> {
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      post_date: args.postDate,
      is_scheduled: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.postId);
  if (error) throw new Error(error.message);
}

export function serializePostForClient(row: ContentCalendarPostRow) {
  return {
    id: row.id,
    weekStart: row.week_start,
    postDate: row.post_date,
    dayIndex: row.day_index,
    postType: row.post_type,
    targetGroup: normalizeTargetGroup(row.target_group),
    platforms: row.platforms,
    caption: row.caption,
    visualPrompt: row.visual_prompt,
    hashtags: row.hashtags ?? [],
    mediaUrl: row.media_url,
    mediaStatus: row.media_status,
    posted: row.posted,
    postedAt: row.posted_at,
    missedPromptDismissed: row.missed_prompt_dismissed,
    savedToHubAt: row.saved_to_hub_at ?? null,
    isScheduled: row.is_scheduled ?? false,
    purgeAfterAt: row.purge_after_at ?? null,
    bulkSessionId: row.bulk_session_id ?? null,
    deletedAt: row.deleted_at ?? null,
  };
}

export type ClientContentPost = ReturnType<typeof serializePostForClient>;
