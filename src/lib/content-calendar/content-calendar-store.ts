import "server-only";

import {
  CONTENT_CALENDAR_PLATFORMS_BY_TYPE,
  CONTENT_CALENDAR_POST_TYPES,
} from "@/lib/content-calendar/constants";
import { addWeekdays, formatCalendarDate, getContentCalendarRotation } from "@/lib/content-calendar/rotation";
import type { GeneratedWeekPost } from "@/lib/content-calendar/content-calendar-ai";
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

export async function updatePostCaption(args: {
  postId: string;
  caption: string;
  visualPrompt?: string | null;
}): Promise<void> {
  const client = createNiBrainClient();
  const patch: Record<string, unknown> = {
    caption: args.caption,
    updated_at: new Date().toISOString(),
  };
  if (args.visualPrompt !== undefined) patch.visual_prompt = args.visualPrompt;
  const { error } = await client.from("match_fit_content_calendar_posts").update(patch).eq("id", args.postId);
  if (error) throw new Error(error.message);
}

export async function markPostPosted(postId: string): Promise<void> {
  const client = createNiBrainClient();
  const { error } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      posted: true,
      posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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

export function serializePostForClient(row: ContentCalendarPostRow) {
  return {
    id: row.id,
    weekStart: row.week_start,
    postDate: row.post_date,
    dayIndex: row.day_index,
    postType: row.post_type,
    targetGroup: row.target_group,
    platforms: row.platforms,
    caption: row.caption,
    visualPrompt: row.visual_prompt,
    hashtags: row.hashtags ?? [],
    mediaUrl: row.media_url,
    mediaStatus: row.media_status,
    posted: row.posted,
    postedAt: row.posted_at,
    missedPromptDismissed: row.missed_prompt_dismissed,
  };
}

export type ClientContentPost = ReturnType<typeof serializePostForClient>;
