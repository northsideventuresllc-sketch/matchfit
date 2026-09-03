import { NextResponse } from "next/server";
import {
  getPendingMediaAgentJobs,
  hasLiveMiniJobForPost,
  queueMiniChromeAgentJob,
} from "@/lib/content-calendar/cowork-jobs";
import { ensureContentCalendarV22Schema } from "@/lib/ensure-content-hub-schema";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { hasValidCoworkSecret } from "@/lib/require-cowork-secret";

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
};

/**
 * Re-queues generate_media jobs to the Mac mini — never generates over an API.
 *
 * Corrected 2026-09-03 (Decision #1722 item 4 + same-date Learning, lane D2): this route used
 * to call generateStaticMedia(), which hits generativelanguage.googleapis.com — a key with ZERO
 * image quota, so every single call here failed and this route then marked the post
 * media_status="failed", clobbering whatever the Mac mini's browser agent
 * (scripts/gemini-media-automation.mjs) was doing with the same post at the same time. Media is
 * never generated over an API — it's JB's Gemini subscription in Chrome on the Mac mini.
 *
 * All this route does now: for each queued generate_media job, for each post referenced in its
 * brief that doesn't already have a live nvg_mini_jobs row, queue one via
 * queueMiniChromeAgentJob(). The job itself is left `queued` — it is drained by the same
 * one-liner every run, which is cheap and idempotent (hasLiveMiniJobForPost skips posts already
 * in flight). Nothing here ever writes media_status="failed" to a post; only the mini's own
 * writeMediaResult (scripts/gemini-media-automation.mjs) and its status write-back to
 * match_fit_content_cowork_jobs report success or failure for a post's media.
 */
export async function GET(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await hydratePlatformEnvFromDatabase();
    await ensureContentCalendarV22Schema();

    const jobs = await getPendingMediaAgentJobs("generate_media");
    const results: Array<{ jobId: string; queuedToMini: string[]; alreadyLive: string[]; skipped: string[] }> = [];

    for (const job of jobs) {
      const brief = (job.brief ?? {}) as { prompts?: Record<string, BriefPrompt> };
      const prompts = brief.prompts ?? {};

      const queuedToMini: string[] = [];
      const alreadyLive: string[] = [];
      const skipped: string[] = [];

      for (const entry of Object.values(prompts)) {
        const postId = entry?.postId;
        if (!postId) continue;

        try {
          if (await hasLiveMiniJobForPost(postId)) {
            alreadyLive.push(postId);
            continue;
          }
          await queueMiniChromeAgentJob({ ids: [postId], title: `Content calendar media (cron re-queue): ${postId}` });
          queuedToMini.push(postId);
        } catch (e) {
          // Never mark the post failed from this route — leave it for the next drain / the
          // mini's own status write-back. Just log so the miss is visible.
          skipped.push(postId);
          console.error(`[content-calendar-generate-media] failed to queue ${postId} to the mini:`, e);
        }
      }

      // The job stays "queued" on purpose (never claimed/completed/failed here) so this stays a
      // pure re-queue sweep — the mini's own write-back is what actually resolves the job.
      results.push({ jobId: job.id, queuedToMini, alreadyLive, skipped });
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
