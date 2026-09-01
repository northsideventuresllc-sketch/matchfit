import { NextResponse } from "next/server";
import { generateStaticMedia } from "@/lib/content-calendar/content-calendar-ai";
import {
  completeGenerateMediaJob,
} from "@/lib/content-calendar/content-calendar-cowork-orchestration";
import { updatePostMedia } from "@/lib/content-calendar/content-calendar-store";
import { isMediaAspectRatio, type MediaAspectRatio } from "@/lib/content-calendar/media-generation";
import { getPendingCoworkJobs, updateCoworkJobStatus } from "@/lib/content-calendar/cowork-jobs";
import { ensureContentCalendarV22Schema } from "@/lib/ensure-content-hub-schema";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { hasValidCoworkSecret } from "@/lib/require-cowork-secret";
import { createNiBrainClient } from "@/lib/ni-brain-client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Accepts EITHER the Vercel `CRON_SECRET` (what GitHub Actions sends) or the DB-backed
 * `COWORK_POLL_SECRET` from `platform_secrets`, via `hasValidCoworkSecret`.
 *
 * The DB fallback exists deliberately (added 2.9.1-beta) so an operator can drive this
 * without Vercel dashboard access. Checking only `process.env.CRON_SECRET` here made the
 * route unfireable by hand whenever the env value and the stored copy had drifted apart —
 * which is exactly what happened on 2026-07-27, leaving an approved batch stuck with no
 * media and no way to kick it.
 */
function authorize(req: Request): Promise<boolean> {
  return hasValidCoworkSecret(req);
}

type BriefPrompt = {
  postId?: string;
  prompt?: string;
  postType?: string;
  dimensions?: { aspectRatio?: string };
};

/** Carousel needs several consistent frames; single-image types need one. */
function frameCountFor(postType: string | undefined): number {
  return postType === "Carousel" ? 5 : 1;
}

/**
 * Platform-correct output shapes: full-screen vertical for short-form video, 4:5 portrait for
 * feed stills and carousels. Mirrors `MEDIA_DIMENSION_MATRIX` in `content-prompts.ts`.
 */
const ASPECT_RATIO_BY_POST_TYPE: Record<string, MediaAspectRatio> = {
  Video: "9:16",
  Static: "4:5",
  Carousel: "4:5",
};

/**
 * The brief already carries the exact ratio each prompt was written for, so prefer it. The
 * post-type map is the fallback for older briefs written before `dimensions` was included.
 * Before this existed every image came out 1:1 because the generator hardcoded 1024x1024.
 */
function aspectRatioFor(entry: BriefPrompt): MediaAspectRatio {
  const fromBrief = entry.dimensions?.aspectRatio;
  if (isMediaAspectRatio(fromBrief)) return fromBrief;
  return ASPECT_RATIO_BY_POST_TYPE[entry.postType ?? ""] ?? "1:1";
}

function summarizeFailures(failures: string[]): string {
  return [...new Set(failures)].slice(0, 6).join(" | ");
}

/** The three media-bearing post types the daily cap applies to. Text needs no media. */
const CAPPED_MEDIA_TYPES = ["Static", "Carousel", "Video"] as const;
type CappedMediaType = (typeof CAPPED_MEDIA_TYPES)[number];

/**
 * JB HARD CAP, locked 2026-08-03: media generation is limited to ONE of each type PER CALENDAR
 * DAY — 1 static, 1 carousel, 1 video, never more. This was never enforced in code (this cron
 * previously had no scheduled runner at all, so the cap only ever held because a human was
 * generating media by hand). Now that this route runs unattended several times a day, it must
 * self-enforce the cap or a single run could burn through the whole day's free Gemini quota (or
 * blow well past 3 generations/day) the moment more than one day's worth of jobs is queued.
 *
 * "Calendar day" here is UTC-day, matching how this cron itself is scheduled (all six fire times
 * are UTC cron expressions) — good enough for a quota guard; it does not need to be ET-exact.
 */
async function getRemainingMediaCapToday(): Promise<Set<CappedMediaType>> {
  const client = createNiBrainClient();
  const startOfUtcDay = new Date();
  startOfUtcDay.setUTCHours(0, 0, 0, 0);

  const { data, error } = await client
    .from("match_fit_content_calendar_posts")
    .select("post_type")
    .eq("media_status", "ready")
    .gte("updated_at", startOfUtcDay.toISOString());
  if (error) throw new Error(error.message);

  const usedToday = new Set((data ?? []).map((row) => row.post_type as string));
  return new Set(CAPPED_MEDIA_TYPES.filter((t) => !usedToday.has(t)));
}

function framePrompt(base: string, postType: string | undefined, index: number, total: number): string {
  if (postType === "Carousel") {
    return `${base}\nCarousel frame ${index + 1} of ${total}. Hold the identical Match Fit visual system, palette, logo placement and 4:5 frame across every slide — vary only the slide headline and composition.`;
  }
  if (postType === "Video") {
    return `${base}\nProduce the opening hook frame / thumbnail keyframe for this short-form video concept.`;
  }
  return base;
}

/**
 * Drains queued generate_media Cowork jobs without needing an external Cowork session.
 *
 * Before this existed, generate_media jobs sat in the queue forever — nothing was scheduled to
 * claim them, so approved posts never reached the publishing window and the post-batch cron had
 * nothing to send. A post_batch job sat queued from 2026-07-24 to 2026-07-27 for exactly this
 * reason. Runs on a schedule ahead of each posting window.
 */
export async function GET(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await hydratePlatformEnvFromDatabase();
    await ensureContentCalendarV22Schema();

    const jobs = await getPendingCoworkJobs("generate_media");
    const remainingCapToday = await getRemainingMediaCapToday();
    const results: Array<{
      jobId: string;
      updated?: number;
      generated?: number;
      skippedPosts?: string[];
      mediaErrors?: string[];
      cappedPosts?: string[];
      error?: string;
    }> = [];

    for (const job of jobs) {
      // Claim it first so a concurrent run cannot double-generate, and so dispatched_at is
      // finally populated — it was never being set, leaving the queue with no liveness signal.
      await updateCoworkJobStatus({ jobId: job.id, status: "running" });

      try {
        const brief = (job.brief ?? {}) as { prompts?: Record<string, BriefPrompt> };
        const prompts = brief.prompts ?? {};
        const mediaUrls: Record<string, string[]> = {};
        const failures: string[] = [];
        const skippedPosts: string[] = [];
        const cappedPosts: string[] = [];
        let usablePrompts = 0;
        let generated = 0;

        for (const entry of Object.values(prompts)) {
          const postId = entry?.postId;
          const base = entry?.prompt?.trim();
          if (!postId || !base) continue;
          usablePrompts += 1;

          // JB's daily media cap (1 static + 1 carousel + 1 video, see getRemainingMediaCapToday)
          // — a type already used up today stays queued for tomorrow instead of generating.
          const cappedType = CAPPED_MEDIA_TYPES.find((t) => t === entry.postType);
          if (cappedType && !remainingCapToday.has(cappedType)) {
            cappedPosts.push(postId);
            continue;
          }

          const total = frameCountFor(entry.postType);
          const aspectRatio = aspectRatioFor(entry);
          const urls: string[] = [];
          for (let i = 0; i < total; i += 1) {
            const result = await generateStaticMedia(
              framePrompt(base, entry.postType, i, total),
              aspectRatio,
            );
            if (result.ok) {
              urls.push(result.url);
              generated += 1;
            } else {
              failures.push(`${entry.postType ?? "post"} ${postId} frame ${i + 1}: ${result.reason}`);
            }
          }

          // A post with zero images must NOT be handed to completeGenerateMediaJob — that would
          // push it to workflow_stage "publishing" with no media and it would go out blank.
          // Leaving it out keeps it in the hub as approved for the next run.
          if (urls.length) {
            mediaUrls[postId] = urls;
            // Claim this type's daily slot immediately — in-memory, so a second job (or a second
            // entry in this same job) processed later in this same run can't also slip through
            // before completeGenerateMediaJob's DB write would otherwise reflect it.
            if (cappedType) remainingCapToday.delete(cappedType);
          } else {
            skippedPosts.push(postId);
            // FIXED 2026-09-01 (JB direct live order — reported two approved posts stuck showing
            // "generating" forever with no error visible): this post was set to media_status
            // "generating" before the job ran and, without this, was left exactly there on
            // failure — the queue-drain path never told the individual post it failed, unlike
            // the single-post admin "generate_media" action, which always did. The post still
            // stays approved in the hub (untouched status/workflow_stage, same as before) so a
            // fresh generate attempt can pick it up — only media_status changes, so the operator
            // sees "failed" instead of a spinner that never resolves.
            await updatePostMedia({ postId, mediaUrl: null, mediaStatus: "failed" }).catch((err) => {
              console.error(`[content-calendar-generate-media] failed to mark post ${postId} failed:`, err);
            });
          }
        }

        if (!usablePrompts) {
          throw new Error("Job brief contained no usable prompts.");
        }

        if (!Object.keys(mediaUrls).length) {
          if (cappedPosts.length && !failures.length) {
            // Every prompt in this job hit the daily cap — not a failure, just not this job's turn
            // yet. Leave it queued (not failed) so it's picked up automatically once the cap
            // resets tomorrow, instead of burying a healthy job under a false "failed" status.
            await updateCoworkJobStatus({ jobId: job.id, status: "queued" });
            results.push({ jobId: job.id, generated: 0, cappedPosts });
            continue;
          }
          // Fail the job with the real reason and touch no posts, so they stay approved in the hub.
          throw new Error(
            `No images were generated for any post. ${summarizeFailures(failures) || "No failure reason was reported."}`,
          );
        }

        // Moves every post that actually has media to workflow_stage/status "publishing" so it
        // lands in the publishing window and the post-batch cron can pick it up.
        const { updated } = await completeGenerateMediaJob({ jobId: job.id, mediaUrls });
        results.push({
          jobId: job.id,
          updated,
          generated,
          ...(skippedPosts.length ? { skippedPosts } : {}),
          ...(failures.length ? { mediaErrors: [...new Set(failures)] } : {}),
          ...(cappedPosts.length ? { cappedPosts } : {}),
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Media generation failed.";
        await updateCoworkJobStatus({ jobId: job.id, status: "failed", error: message });
        results.push({ jobId: job.id, error: message });
      }
    }

    return NextResponse.json({ ok: true, count: results.length, results });
  } catch (e) {
    console.error("[cron content-calendar-generate-media]", e);
    return NextResponse.json({ error: "Media generation sweep failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
