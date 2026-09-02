import { NextResponse } from "next/server";
import { z } from "zod";
import {
  completeGenerateMediaJob,
  completePostBatchJob,
  loadJobForCompletion,
} from "@/lib/content-calendar/content-calendar-cowork-orchestration";
import { updateMediaAgentJobStatus } from "@/lib/content-calendar/cowork-jobs";
import {
  ensureContentCalendarV22Schema,
  isMissingContentCalendarV22SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { hasValidCoworkSecret } from "@/lib/require-cowork-secret";

export const dynamic = "force-dynamic";

const bodySchema = z.union([
  z.object({
    mediaUrls: z.record(z.string(), z.array(z.string())),
    error: z.string().optional(),
  }),
  z.object({
    postedUrls: z.array(
      z.object({ postId: z.string().min(1), platform: z.string().min(1), url: z.string().min(1) }),
    ),
    error: z.string().optional(),
  }),
  z.object({ error: z.string().min(1) }),
]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await hasValidCoworkSecret(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid media agent job completion payload." }, { status: 400 });
  const { id } = await ctx.params;

  try {
    await ensureContentCalendarV22Schema();
    const job = await loadJobForCompletion(id);
    if (!job) return NextResponse.json({ error: "Media agent job not found." }, { status: 404 });

    const body = parsed.data;

    if ("error" in body && body.error && !("mediaUrls" in body) && !("postedUrls" in body)) {
      await updateMediaAgentJobStatus({ jobId: id, status: "failed", error: body.error });
      return NextResponse.json({ ok: true, status: "failed" });
    }

    if ("mediaUrls" in body) {
      if (job.job_type !== "generate_media") {
        return NextResponse.json({ error: "Job is not a generate_media job." }, { status: 400 });
      }
      const result = await completeGenerateMediaJob({ jobId: id, mediaUrls: body.mediaUrls });
      return NextResponse.json({ ok: true, jobType: "generate_media", ...result });
    }

    if ("postedUrls" in body) {
      if (job.job_type !== "post_batch") {
        return NextResponse.json({ error: "Job is not a post_batch job." }, { status: 400 });
      }
      const result = await completePostBatchJob({ jobId: id, postedUrls: body.postedUrls });
      return NextResponse.json({ ok: true, jobType: "post_batch", ...result });
    }

    return NextResponse.json({ error: "Unrecognized completion payload." }, { status: 400 });
  } catch (e) {
    console.error("[content-calendar v2 media-agent-job complete]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not complete media agent job.") },
      { status: isMissingContentCalendarV22SchemaError(e) ? 503 : 500 },
    );
  }
}
