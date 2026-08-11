import "server-only";

import {
  COWORK_MEDIA_GENERATION_ORDER,
  COWORK_TIKTOK_VIDEO_NOTE,
  createCoworkJob,
  getCoworkJob,
  getCoworkMediaDownloadFolder,
  resolveArchivePurgeAfter,
  updateCoworkJobBrief,
  updateCoworkJobStatus,
  type CoworkJobRow,
  type CoworkMediaOrderKey,
} from "@/lib/content-calendar/cowork-jobs";
import {
  buildMediaGenerationPrompt,
  MEDIA_DIMENSION_MATRIX,
  type MediaPostType,
} from "@/lib/content-calendar/content-prompts";
import { splitPlatforms } from "@/lib/content-calendar/content-calendar-v2-store";
import { normalizeTargetGroup } from "@/lib/content-calendar/content-rules";
import { fireAxonPostingConfirmation } from "@/lib/content-calendar/axon-notify";
import {
  cancelDayApprovalMemo,
  createNiBrainClient,
  recordDayApprovalMemo,
  type ContentCalendarPostRow,
} from "@/lib/ni-brain-client";

const POST_TYPE_TO_ORDER_KEY: Record<MediaPostType, CoworkMediaOrderKey> = {
  Video: "video",
  Static: "static",
  Carousel: "carousel",
};

function resolveAppBaseUrl(): string {
  const raw =
    process.env.MATCH_FIT_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "https://match-fit.net";
  const withScheme = raw.startsWith("http") ? raw : `https://${raw}`;
  return withScheme.replace(/\/$/, "");
}

function completeCallbackUrl(jobId: string): string {
  return `${resolveAppBaseUrl()}/api/admin/content-calendar/v2/cowork-jobs/${jobId}/complete`;
}

async function getHubPostsForDate(postDate: string): Promise<ContentCalendarPostRow[]> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("*")
    .eq("post_date", postDate)
    .eq("workflow_stage", "hub")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return (data ?? []) as ContentCalendarPostRow[];
}

/**
 * Approve Day: marks every hub post for the date approved and writes the (cancelable) pending
 * learning memo to NI Brain. The Cowork job is NOT created here — that happens on Fire Cowork.
 */
export async function approveContentDay(postDate: string): Promise<{ approved: number; memoId: string | null }> {
  const posts = await getHubPostsForDate(postDate);
  if (!posts.length) throw new Error("No hub posts found for this date to approve.");

  const now = new Date().toISOString();
  const client = createNiBrainClient();

  // Text posts need no media generation — fireCoworkForDay excludes them and
  // completeGenerateMediaJob (the only other place that flips workflow_stage)
  // never sees them. Left at workflow_stage "hub" they never reach Publishing.
  // Advance them straight to "publishing" here; media posts stay in "hub"
  // until the media job completes (unchanged behavior).
  const textIds = posts.filter((p) => p.post_type === "Text").map((p) => p.id);
  const mediaIds = posts.filter((p) => p.post_type !== "Text").map((p) => p.id);

  if (mediaIds.length) {
    const { error } = await client
      .from("match_fit_content_calendar_posts")
      .update({ approved_at: now, status: "approved", updated_at: now })
      .in("id", mediaIds);
    if (error) throw new Error(error.message);
  }

  if (textIds.length) {
    const { error } = await client
      .from("match_fit_content_calendar_posts")
      .update({
        approved_at: now,
        status: "publishing",
        workflow_stage: "publishing",
        updated_at: now,
      })
      .in("id", textIds);
    if (error) throw new Error(error.message);
  }

  const summary = [
    `Match Fit content day approved for ${postDate}.`,
    `Posts: ${posts.map((p) => `${p.post_type}→${normalizeTargetGroup(p.target_group)}`).join(", ")}.`,
    posts[0]?.dpmo_phase ? `DPMO phase: ${posts[0].dpmo_phase}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const { id: memoId } = await recordDayApprovalMemo({
    postDate,
    summary,
    meta: {
      postCount: posts.length,
      postTypes: posts.map((p) => p.post_type),
      dpmoPhase: posts[0]?.dpmo_phase ?? null,
    },
  });

  return { approved: posts.length, memoId };
}

/**
 * Return to Editing: cancels the still-pending day-approval memo and reverts the date's approved
 * hub posts back to editable drafts.
 */
export async function returnContentDayToEditing(postDate: string): Promise<{ reverted: number; memosCanceled: number }> {
  const now = new Date().toISOString();
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .update({ approved_at: null, status: "draft", updated_at: now })
    .eq("post_date", postDate)
    .eq("workflow_stage", "hub")
    .not("approved_at", "is", null)
    .is("deleted_at", null)
    .select("id");
  if (error) throw new Error(error.message);

  const memosCanceled = await cancelDayApprovalMemo(postDate);
  return { reverted: (data ?? []).length, memosCanceled };
}

/**
 * Fire Cowork for an approved day: creates ONE generate_media Cowork job whose brief carries the
 * day's video/static/carousel prompts in priority order (video first), the Mac Mini download
 * folder convention, and the completion callback contract. The learning memo is already committed
 * at Approve Day, so it is NOT re-triggered here.
 */
export async function fireCoworkForDay(postDate: string): Promise<{ job: CoworkJobRow; mediaPostCount: number }> {
  const posts = await getHubPostsForDate(postDate);
  const approvedMedia = posts.filter(
    (p): p is ContentCalendarPostRow & { post_type: MediaPostType } =>
      p.post_type !== "Text" && Boolean(p.approved_at),
  );
  if (!approvedMedia.length) {
    throw new Error("No approved media posts (Static/Carousel/Video) found for this date. Approve the day first.");
  }

  const prompts: Partial<Record<CoworkMediaOrderKey, unknown>> = {};
  const platformTargets = new Set<string>();
  for (const post of approvedMedia) {
    const key = POST_TYPE_TO_ORDER_KEY[post.post_type];
    const dims = MEDIA_DIMENSION_MATRIX[post.post_type];
    splitPlatforms(post.platforms).forEach((p) => platformTargets.add(p));
    prompts[key] = {
      postId: post.id,
      postType: post.post_type,
      platforms: splitPlatforms(post.platforms),
      dimensions: { aspectRatio: dims.aspectRatio, pixels: dims.pixels, orientation: dims.orientation },
      prompt: buildMediaGenerationPrompt({
        postType: post.post_type,
        visualPrompt: post.visual_prompt,
        caption: post.caption,
        targetGroup: normalizeTargetGroup(post.target_group),
      }),
    };
  }

  const order = COWORK_MEDIA_GENERATION_ORDER.filter((key) => prompts[key]);

  const job = await createCoworkJob({
    jobType: "generate_media",
    platformTargets: [...platformTargets],
    brief: {
      kind: "generate_media",
      postDate,
      order,
      prompts,
      downloadFolder: getCoworkMediaDownloadFolder(),
      logoReference: "public/logo.png",
      callback: {
        method: "POST",
        url: "",
        bodyShape: { mediaUrls: { "<postId>": ["<downloadedMediaUrl>"] } },
      },
    },
  });

  const briefWithCallback = {
    kind: "generate_media",
    postDate,
    order,
    prompts,
    downloadFolder: getCoworkMediaDownloadFolder(),
    logoReference: "public/logo.png",
    callback: {
      method: "POST",
      url: completeCallbackUrl(job.id),
      bodyShape: { mediaUrls: { "<postId>": ["<downloadedMediaUrl>"] } },
    },
  };
  await updateCoworkJobBrief(job.id, briefWithCallback);

  return { job: { ...job, brief: briefWithCallback }, mediaPostCount: approvedMedia.length };
}

/**
 * APPROVE FOR POSTING: batches Publishing-window posts into ONE post_batch Cowork job. When
 * postIds are supplied (the UI's checked/filtered selection) only those are included; otherwise
 * every publishing-stage post is batched. `platformOverrides` (postId → included platform list)
 * lets the UI exclude platforms per post; a post with no override entry uses its stored platforms
 * unchanged. TikTok video routing is flagged in platformNotes.
 */
export async function approvePublishingPostsForPosting(args: {
  postIds?: string[];
  platformOverrides?: Record<string, string[]>;
}): Promise<{ job: CoworkJobRow; postCount: number }> {
  const client = createNiBrainClient();
  const overrides = args.platformOverrides ?? {};
  const platformsForPost = (post: ContentCalendarPostRow): string[] =>
    post.id in overrides ? overrides[post.id] : splitPlatforms(post.platforms);
  let read = client
    .from("match_fit_content_calendar_posts")
    .select("*")
    .eq("workflow_stage", "publishing")
    .eq("posted", false)
    .is("deleted_at", null);
  if (args.postIds?.length) read = read.in("id", args.postIds);

  const { data, error } = await read;
  if (error) throw new Error(error.message);
  const posts = (data ?? []) as ContentCalendarPostRow[];
  if (!posts.length) throw new Error("No publishing posts matched to approve for posting.");

  const briefPosts = posts.map((post) => {
    const platformList = platformsForPost(post);
    const perPlatform = platformList.map((platform) => {
      const caption =
        (post.platform_captions && post.platform_captions[platform]) || post.caption;
      const hashtags =
        (post.platform_hashtags && post.platform_hashtags[platform]) || post.hashtags || [];
      const isTikTokVideo = post.post_type === "Video" && /tiktok/i.test(platform);
      return {
        platform,
        caption,
        hashtags,
        routeVia: isTikTokVideo ? "tiktok_studio" : "native",
      };
    });
    return {
      postId: post.id,
      postDate: post.post_date,
      postType: post.post_type,
      targetGroup: normalizeTargetGroup(post.target_group),
      mediaUrls: Array.isArray(post.media_urls) ? post.media_urls : post.media_url ? [post.media_url] : [],
      platforms: perPlatform,
    };
  });

  const job = await createCoworkJob({
    jobType: "post_batch",
    platformTargets: [...new Set(posts.flatMap((p) => platformsForPost(p)))],
    brief: {
      kind: "post_batch",
      posts: briefPosts,
      platformNotes: { tiktokVideo: COWORK_TIKTOK_VIDEO_NOTE },
    },
  });

  const briefWithCallback = {
    kind: "post_batch",
    posts: briefPosts,
    platformNotes: { tiktokVideo: COWORK_TIKTOK_VIDEO_NOTE },
    callback: {
      method: "POST",
      url: completeCallbackUrl(job.id),
      bodyShape: { postedUrls: [{ postId: "<postId>", platform: "<platform>", url: "<postedUrl>" }] },
    },
  };
  await updateCoworkJobBrief(job.id, briefWithCallback);

  const now = new Date().toISOString();
  const { error: markError } = await client
    .from("match_fit_content_calendar_posts")
    .update({ status: "posting_queued", updated_at: now })
    .in("id", posts.map((p) => p.id));
  if (markError) throw new Error(markError.message);

  return { job: { ...job, brief: briefWithCallback }, postCount: posts.length };
}

/** Completes a generate_media job: attaches media to posts and advances them to Publishing. */
export async function completeGenerateMediaJob(args: {
  jobId: string;
  mediaUrls: Record<string, string[]>;
}): Promise<{ updated: number }> {
  const client = createNiBrainClient();
  const now = new Date().toISOString();
  let updated = 0;

  for (const [postId, urls] of Object.entries(args.mediaUrls)) {
    const cleanUrls = (Array.isArray(urls) ? urls : []).filter((u): u is string => typeof u === "string" && Boolean(u));
    const { error } = await client
      .from("match_fit_content_calendar_posts")
      .update({
        media_url: cleanUrls[0] ?? null,
        media_urls: cleanUrls,
        media_status: cleanUrls.length ? "ready" : "failed",
        workflow_stage: "publishing",
        status: "publishing",
        updated_at: now,
      })
      .eq("id", postId);
    if (error) throw new Error(error.message);
    updated += 1;
  }

  await updateCoworkJobStatus({ jobId: args.jobId, status: "complete", result: { mediaUrls: args.mediaUrls } });
  return { updated };
}

/**
 * Completes a post_batch job: marks each post posted, stores per-platform URLs, sets the posted
 * purge window from settings, and fires the AXON posting-confirmation webhook (exact contract).
 */
export async function completePostBatchJob(args: {
  jobId: string;
  postedUrls: { postId: string; platform: string; url: string }[];
}): Promise<{ updated: number }> {
  const client = createNiBrainClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const purgeAfter = await resolveArchivePurgeAfter("posted", now);

  const byPost = new Map<string, Record<string, string>>();
  for (const entry of args.postedUrls) {
    if (!entry?.postId || !entry.platform || !entry.url) continue;
    const map = byPost.get(entry.postId) ?? {};
    map[entry.platform] = entry.url;
    byPost.set(entry.postId, map);
  }

  let updated = 0;
  for (const [postId, urls] of byPost.entries()) {
    const { error } = await client
      .from("match_fit_content_calendar_posts")
      .update({
        posted: true,
        posted_at: nowIso,
        posted_urls: urls,
        status: "posted",
        workflow_stage: "archived",
        archive_type: "posted",
        archived_at: nowIso,
        purge_after_at: purgeAfter,
        updated_at: nowIso,
      })
      .eq("id", postId);
    if (error) throw new Error(error.message);
    updated += 1;
  }

  await updateCoworkJobStatus({ jobId: args.jobId, status: "complete", result: { postedUrls: args.postedUrls } });

  await fireAxonPostingConfirmation({
    batchId: args.jobId,
    posts: args.postedUrls
      .filter((p) => p?.platform && p.url)
      .map((p) => ({ platform: p.platform, url: p.url, postedAt: nowIso })),
  });

  return { updated };
}

/** Loads a job and asserts its type before running a completion handler. */
export async function loadJobForCompletion(jobId: string): Promise<CoworkJobRow | null> {
  return getCoworkJob(jobId);
}
