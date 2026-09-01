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
import { sendTelegramPing } from "@/lib/content-calendar/telegram-ping";
import { normalizeTargetGroup } from "@/lib/content-calendar/content-rules";
import { fireAxonPostingConfirmation } from "@/lib/content-calendar/axon-notify";
import {
  describeEtMoment,
  MEDIA_BUILD_SLOTS_ET,
  nextEtSlotAfter,
  POSTING_SLOTS_ET,
} from "@/lib/content-calendar/pending-schedule";
import { MATCH_FIT_NOREPLY_FROM, sendResendEmail } from "@/lib/resend-client";
import {
  cancelDayApprovalMemo,
  createNiBrainClient,
  hasDayAllPostedEmailBeenSent,
  hasDayScheduledEmailBeenSent,
  recordDayAllPostedEmailSent,
  recordDayApprovalMemo,
  recordDayScheduledEmailSent,
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

/** Fixed recipient trio for both day-level operator emails — always all three, JB's standing rule. */
const DAY_NOTIFICATION_RECIPIENTS = [
  "jb@match-fit.net",
  "jb@northsideintelligence.com",
  "jb@northsideventuresgroup.com",
] as const;

function dayFeedbackLink(postDate: string): string {
  return `${resolveAppBaseUrl()}/admin/content-calendar/v2/day-feedback/${postDate}`;
}

/** Sends one plain-text operator email to all three day-notification recipients. Never throws — a
 * failed send is logged and swallowed so a Resend outage can't block the stage move that triggered it. */
async function sendDayNotificationEmail(args: { subject: string; text: string }): Promise<void> {
  await Promise.all(
    DAY_NOTIFICATION_RECIPIENTS.map((to) =>
      sendResendEmail({ subject: args.subject, text: args.text, to, from: MATCH_FIT_NOREPLY_FROM }).catch((e) => {
        console.error(`[content-calendar day email] send to ${to} failed:`, e);
      }),
    ),
  );
}

/**
 * Fires once a day's media generation is genuinely set in motion. Two callers, two ETA flavors:
 *  - approveContentDay's media branch (etaKind "media", the default) — posts just entered
 *    "pending" and media_generation_started_at is stamped, so the next MEDIA_BUILD_SLOTS_ET slot
 *    is a real ETA regardless of when (or whether) an admin later clicks Fire Cowork.
 *  - manuallyGenerateDayMedia (etaKind "posting") — media generation is bypassed entirely and the
 *    posts already sit in "publishing", so the only ETA left to give is the next posting slot.
 * Guarded via ni-brain-client's hasDayScheduledEmailBeenSent so a retry never double-sends.
 */
export async function notifyDayScheduled(postDate: string, args?: { etaKind?: "media" | "posting" }): Promise<void> {
  if (await hasDayScheduledEmailBeenSent(postDate)) return;
  const now = new Date();
  const etaKind = args?.etaKind ?? "media";
  const etaSlot =
    etaKind === "media" ? nextEtSlotAfter(MEDIA_BUILD_SLOTS_ET, now) : nextEtSlotAfter(POSTING_SLOTS_ET, now);
  const etaLabel = etaKind === "media" ? "Media build ETA" : "Posting ETA";

  const text = [
    `Match Fit content for ${postDate} is scheduled.`,
    `${etaLabel}: ${describeEtMoment(etaSlot, now)}.`,
    "",
    `Leave feedback on this day: ${dayFeedbackLink(postDate)}`,
  ].join("\n");

  await sendDayNotificationEmail({ subject: `Match Fit content scheduled — ${postDate}`, text });
  await recordDayScheduledEmailSent(postDate);
}

/** True when every non-deleted post for a date is archived as posted. */
async function isDayFullyPosted(postDate: string): Promise<boolean> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("workflow_stage, archive_type")
    .eq("post_date", postDate)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { workflow_stage: string | null; archive_type: string | null }[];
  if (!rows.length) return false;
  return rows.every((row) => row.workflow_stage === "archived" && row.archive_type === "posted");
}

/**
 * Checks whether every post for a date has now gone out and, the first time that becomes true,
 * sends the "day fully posted" operator email with each post's live URL. Call this from every
 * place a post for a date gets archived as posted — completePostBatchJob below (the agent path)
 * and manuallyPostV2Post in content-calendar-v2-store.ts (the manual path). Guarded via
 * ni-brain-client's hasDayAllPostedEmailBeenSent so it only ever fires once per date.
 */
export async function maybeNotifyDayFullyPosted(postDate: string): Promise<{ notified: boolean }> {
  if (!postDate) return { notified: false };
  if (await hasDayAllPostedEmailBeenSent(postDate)) return { notified: false };
  if (!(await isDayFullyPosted(postDate))) return { notified: false };

  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("post_type, posted_urls")
    .eq("post_date", postDate)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  const lines: string[] = [];
  for (const row of (data ?? []) as { post_type: string; posted_urls: Record<string, string> | null }[]) {
    for (const [platform, url] of Object.entries(row.posted_urls ?? {})) {
      lines.push(`${row.post_type} on ${platform}: ${url}`);
    }
  }

  const text = [
    `Every Match Fit post for ${postDate} is now live.`,
    "",
    ...lines,
    "",
    `Leave feedback on this day: ${dayFeedbackLink(postDate)}`,
  ].join("\n");

  await sendDayNotificationEmail({ subject: `Match Fit content fully posted — ${postDate}`, text });
  void sendTelegramPing(`Match Fit: every post for ${postDate} is now live.`);
  await recordDayAllPostedEmailSent(postDate);
  return { notified: true };
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
  // never sees them. Advance them straight to "publishing" here; media posts
  // move into the real "pending" stage, where they wait for the media-build
  // cron (fireCoworkForDay) or a manual bypass (manuallyGenerateDayMedia).
  const textIds = posts.filter((p) => p.post_type === "Text").map((p) => p.id);
  const mediaIds = posts.filter((p) => p.post_type !== "Text").map((p) => p.id);

  if (mediaIds.length) {
    const { error } = await client
      .from("match_fit_content_calendar_posts")
      .update({
        approved_at: now,
        status: "pending",
        workflow_stage: "pending",
        media_generation_started_at: now,
        updated_at: now,
      })
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

  // Only fire when there is media actually queued — media_generation_started_at (set above) is
  // the moment this day genuinely gets a media-build ETA. A text-only day has nothing to build and
  // goes straight to Publishing, so there is no ETA worth emailing about.
  if (mediaIds.length) {
    await notifyDayScheduled(postDate).catch((e) => {
      console.error(`[content-calendar day email] day-scheduled notify failed for ${postDate}:`, e);
    });
  }

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
 * Manual day-level media generation bypass: same precondition and memo write-back as
 * approveContentDay, but skips Cowork entirely — JB is producing the day's media himself outside
 * the agent pipeline, so the media-post branch goes straight to "publishing" instead of "pending"
 * (no Cowork job, no media_generation_started_at). Text posts behave exactly as they do under
 * approveContentDay, since they never had media to build either way.
 */
export async function manuallyGenerateDayMedia(postDate: string): Promise<{ moved: number; memoId: string | null }> {
  const posts = await getHubPostsForDate(postDate);
  if (!posts.length) throw new Error("No hub posts found for this date to approve.");

  const now = new Date().toISOString();
  const client = createNiBrainClient();

  const textIds = posts.filter((p) => p.post_type === "Text").map((p) => p.id);
  const mediaIds = posts.filter((p) => p.post_type !== "Text").map((p) => p.id);
  const allIds = [...mediaIds, ...textIds];

  if (allIds.length) {
    const { error } = await client
      .from("match_fit_content_calendar_posts")
      .update({ approved_at: now, status: "publishing", workflow_stage: "publishing", updated_at: now })
      .in("id", allIds);
    if (error) throw new Error(error.message);
  }

  const summary = [
    `Match Fit content day approved for ${postDate} (manual media bypass — no Cowork job).`,
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
      manualMediaBypass: true,
    },
  });

  // Media is bypassed here, so the "day now has an ETA" moment is a posting ETA (next 5pm/8pm
  // slot), not a media-build ETA — these posts already sit in Publishing waiting on that window.
  if (mediaIds.length) {
    await notifyDayScheduled(postDate, { etaKind: "posting" }).catch((e) => {
      console.error(`[content-calendar day email] day-scheduled notify failed for ${postDate}:`, e);
    });
  }

  return { moved: posts.length, memoId };
}

/** One post's media-generation prompt entry, shared by the day batch job and the single-post job. */
type MediaJobPromptEntry = {
  postId: string;
  postType: MediaPostType;
  platforms: string[];
  dimensions: { aspectRatio: string; pixels: string; orientation: string };
  prompt: string;
};

/**
 * Builds one post's Cowork media-generation prompt entry. Shared by fireCoworkForDay's per-post
 * loop and fireCoworkForPost's single-post job — extracted so both build the exact same shape and
 * so operator feedback (regenerate) only has to be appended in one place.
 */
function buildMediaJobPromptEntry(
  post: ContentCalendarPostRow & { post_type: MediaPostType },
  args?: { feedback?: string },
): MediaJobPromptEntry {
  const dims = MEDIA_DIMENSION_MATRIX[post.post_type];
  let prompt = buildMediaGenerationPrompt({
    postType: post.post_type,
    visualPrompt: post.visual_prompt,
    caption: post.caption,
    targetGroup: normalizeTargetGroup(post.target_group),
  });
  if (args?.feedback?.trim()) {
    prompt = `${prompt}\n\nOPERATOR FEEDBACK — apply these adjustments:\n${args.feedback.trim()}`;
  }
  return {
    postId: post.id,
    postType: post.post_type,
    platforms: splitPlatforms(post.platforms),
    dimensions: { aspectRatio: dims.aspectRatio, pixels: dims.pixels, orientation: dims.orientation },
    prompt,
  };
}

/**
 * Fire Cowork for a pending day: creates ONE generate_media Cowork job whose brief carries the
 * day's video/static/carousel prompts in priority order (video first), the Mac Mini download
 * folder convention, and the completion callback contract. The learning memo is already committed
 * at Approve Day, so it is NOT re-triggered here. Reads workflow_stage "pending" (not "hub") — that
 * stage now IS "day approved, media generation queued".
 */
export async function fireCoworkForDay(postDate: string): Promise<{ job: CoworkJobRow; mediaPostCount: number }> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("*")
    .eq("post_date", postDate)
    .eq("workflow_stage", "pending")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  const posts = (data ?? []) as ContentCalendarPostRow[];

  const pendingMedia = posts.filter(
    (p): p is ContentCalendarPostRow & { post_type: MediaPostType } => p.post_type !== "Text",
  );
  if (!pendingMedia.length) {
    throw new Error("No pending media posts (Static/Carousel/Video) found for this date. Approve the day first.");
  }

  const prompts: Partial<Record<CoworkMediaOrderKey, MediaJobPromptEntry>> = {};
  const platformTargets = new Set<string>();
  const now = new Date().toISOString();
  for (const post of pendingMedia) {
    const key = POST_TYPE_TO_ORDER_KEY[post.post_type];
    const entry = buildMediaJobPromptEntry(post);
    splitPlatforms(post.platforms).forEach((p) => platformTargets.add(p));
    prompts[key] = entry;

    const { error: promptError } = await client
      .from("match_fit_content_calendar_posts")
      .update({ last_generation_prompt: entry.prompt, media_status: "generating", updated_at: now })
      .eq("id", post.id);
    if (promptError) throw new Error(promptError.message);
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

  return { job: { ...job, brief: briefWithCallback }, mediaPostCount: pendingMedia.length };
}

/**
 * Single-post version of fireCoworkForDay: creates ONE generate_media Cowork job scoped to just
 * this post. Two callers use this — Impromptu's "submit for generation" (post starts in "hub") and
 * Publishing's "Regenerate" (post starts in "publishing", with existing media already attached) —
 * so this makes no assumption about the post's starting stage; it only requires the post to have
 * media at all (Text posts never generate media). Existing media/media_urls are left in place until
 * the job's callback lands (completeGenerateMediaJob), so Regenerate never blanks out a live post
 * mid-flight.
 */
export async function fireCoworkForPost(
  postId: string,
  args?: { feedback?: string },
): Promise<{ job: CoworkJobRow; post: ContentCalendarPostRow }> {
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const post = data as ContentCalendarPostRow | null;
  if (!post) throw new Error("Post not found.");
  if (post.post_type === "Text") {
    throw new Error("Text posts have no media to generate.");
  }
  const mediaPost = post as ContentCalendarPostRow & { post_type: MediaPostType };

  const now = new Date().toISOString();
  const entry = buildMediaJobPromptEntry(mediaPost, { feedback: args?.feedback });
  const key = POST_TYPE_TO_ORDER_KEY[mediaPost.post_type];

  const { error: updateError } = await client
    .from("match_fit_content_calendar_posts")
    .update({
      workflow_stage: "pending",
      status: "pending",
      media_status: "generating",
      media_generation_started_at: now,
      last_generation_prompt: entry.prompt,
      updated_at: now,
    })
    .eq("id", postId);
  if (updateError) throw new Error(updateError.message);

  const job = await createCoworkJob({
    jobType: "generate_media",
    platformTargets: entry.platforms,
    brief: {
      kind: "generate_media",
      postDate: post.post_date,
      order: [key],
      prompts: { [key]: entry },
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
    postDate: post.post_date,
    order: [key],
    prompts: { [key]: entry },
    downloadFolder: getCoworkMediaDownloadFolder(),
    logoReference: "public/logo.png",
    callback: {
      method: "POST",
      url: completeCallbackUrl(job.id),
      bodyShape: { mediaUrls: { "<postId>": ["<downloadedMediaUrl>"] } },
    },
  };
  await updateCoworkJobBrief(job.id, briefWithCallback);

  const { data: updated, error: reloadError } = await client
    .from("match_fit_content_calendar_posts")
    .select("*")
    .eq("id", postId)
    .single();
  if (reloadError) throw new Error(reloadError.message);

  return { job: { ...job, brief: briefWithCallback }, post: updated as ContentCalendarPostRow };
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

/**
 * Completes a generate_media job: attaches media to posts and advances them to Publishing. Guarded
 * on workflow_stage still being "pending" — a post moved off pending before this callback landed
 * (e.g. JB hit Stop, or manuallyGenerateDayMedia already bypassed it to Publishing) is skipped
 * silently instead of being incorrectly resurrected into Publishing out from under whatever state
 * it's actually in now.
 */
export async function completeGenerateMediaJob(args: {
  jobId: string;
  mediaUrls: Record<string, string[]>;
}): Promise<{ updated: number }> {
  const client = createNiBrainClient();
  const now = new Date().toISOString();
  let updated = 0;

  for (const [postId, urls] of Object.entries(args.mediaUrls)) {
    const cleanUrls = (Array.isArray(urls) ? urls : []).filter((u): u is string => typeof u === "string" && Boolean(u));
    const { data, error } = await client
      .from("match_fit_content_calendar_posts")
      .update({
        media_url: cleanUrls[0] ?? null,
        media_urls: cleanUrls,
        media_status: cleanUrls.length ? "ready" : "failed",
        workflow_stage: "publishing",
        status: "publishing",
        generation_source: "cowork_gemini",
        updated_at: now,
      })
      .eq("id", postId)
      .eq("workflow_stage", "pending")
      .select("id");
    if (error) throw new Error(error.message);
    if ((data ?? []).length) updated += 1;
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

  // Resolved up front, defensively — used for the best-effort day-fully-posted check and the
  // per-post Telegram ping below, so a lookup failure here should never block the archive
  // writes that actually matter.
  const postDatesTouched = new Set<string>();
  const postTypeById = new Map<string, string>();
  try {
    const { data: dateRows, error: dateError } = await client
      .from("match_fit_content_calendar_posts")
      .select("id, post_date, post_type")
      .in("id", [...byPost.keys()]);
    if (dateError) throw new Error(dateError.message);
    for (const row of (dateRows ?? []) as { id: string; post_date: string | null; post_type: string | null }[]) {
      if (row.post_date) postDatesTouched.add(row.post_date);
      if (row.post_type) postTypeById.set(row.id, row.post_type);
    }
  } catch (e) {
    console.error("[content-calendar day email] could not resolve touched post dates:", e);
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

    // WF1.18 fix: a Telegram ping was supposed to fire after every posted post type and never
    // did, because it depended on an agent remembering to send it by hand.
    const postType = postTypeById.get(postId) ?? "post";
    const platforms = Object.keys(urls).join(", ");
    void sendTelegramPing(`Match Fit: ${postType} posted (${platforms}).`);
  }

  await updateCoworkJobStatus({ jobId: args.jobId, status: "complete", result: { postedUrls: args.postedUrls } });

  await fireAxonPostingConfirmation({
    batchId: args.jobId,
    posts: args.postedUrls
      .filter((p) => p?.platform && p.url)
      .map((p) => ({ platform: p.platform, url: p.url, postedAt: nowIso })),
  });

  // Day-fully-posted check: this batch may have just posted the last outstanding post for one or
  // more of the dates it touched. Guarded per-date in ni-brain-client (hasDayAllPostedEmailBeenSent)
  // so it only ever fires once.
  for (const postDate of postDatesTouched) {
    await maybeNotifyDayFullyPosted(postDate).catch((e) => {
      console.error(`[content-calendar day email] all-posted check failed for ${postDate}:`, e);
    });
  }

  return { updated };
}

/** Loads a job and asserts its type before running a completion handler. */
export async function loadJobForCompletion(jobId: string): Promise<CoworkJobRow | null> {
  return getCoworkJob(jobId);
}
