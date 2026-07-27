import { NextResponse } from "next/server";
import { generateStaticMedia } from "@/lib/content-calendar/content-calendar-ai";
import {
  completeGenerateMediaJob,
} from "@/lib/content-calendar/content-calendar-cowork-orchestration";
import { getPendingCoworkJobs, updateCoworkJobStatus } from "@/lib/content-calendar/cowork-jobs";
import { ensureContentCalendarV22Schema } from "@/lib/ensure-content-hub-schema";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q === secret;
}

type BriefPrompt = {
  postId?: string;
  prompt?: string;
  postType?: string;
};

/** Carousel needs several consistent frames; single-image types need one. */
function frameCountFor(postType: string | undefined): number {
  return postType === "Carousel" ? 5 : 1;
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
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await hydratePlatformEnvFromDatabase();
    await ensureContentCalendarV22Schema();

    const jobs = await getPendingCoworkJobs("generate_media");
    const results: Array<{ jobId: string; updated?: number; generated?: number; error?: string }> = [];

    for (const job of jobs) {
      // Claim it first so a concurrent run cannot double-generate, and so dispatched_at is
      // finally populated — it was never being set, leaving the queue with no liveness signal.
      await updateCoworkJobStatus({ jobId: job.id, status: "running" });

      try {
        const brief = (job.brief ?? {}) as { prompts?: Record<string, BriefPrompt> };
        const prompts = brief.prompts ?? {};
        const mediaUrls: Record<string, string[]> = {};
        let generated = 0;

        for (const entry of Object.values(prompts)) {
          const postId = entry?.postId;
          const base = entry?.prompt?.trim();
          if (!postId || !base) continue;

          const total = frameCountFor(entry.postType);
          const urls: string[] = [];
          for (let i = 0; i < total; i += 1) {
            const result = await generateStaticMedia(framePrompt(base, entry.postType, i, total));
            if (result?.url) {
              urls.push(result.url);
              generated += 1;
            }
          }
          mediaUrls[postId] = urls;
        }

        if (!Object.keys(mediaUrls).length) {
          throw new Error("Job brief contained no usable prompts.");
        }

        // Moves every post to workflow_stage/status "publishing" so it lands in the publishing
        // window and the post-batch cron can pick it up.
        const { updated } = await completeGenerateMediaJob({ jobId: job.id, mediaUrls });
        results.push({ jobId: job.id, updated, generated });
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
