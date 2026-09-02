import { beforeEach, describe, expect, it, vi } from "vitest";

const M = vi.hoisted(() => ({
  hasValidCoworkSecret: vi.fn(),
  hydratePlatformEnv: vi.fn(),
  ensureSchema: vi.fn(),
  getPendingMediaAgentJobs: vi.fn(),
  updateMediaAgentJobStatus: vi.fn(),
  completeGenerateMediaJob: vi.fn(),
  generateStaticMedia: vi.fn(),
  updatePostMedia: vi.fn(),
  // Daily media cap query (getRemainingMediaCapToday) — data:[] means nothing generated yet
  // today, i.e. the cap is fully open, matching every test's prior (uncapped) expectations
  // unless a test overrides it to exercise the cap itself.
  niBrainSelectResult: { data: [] as Array<{ post_type: string }>, error: null as { message: string } | null },
}));

vi.mock("@/lib/require-cowork-secret", () => ({ hasValidCoworkSecret: M.hasValidCoworkSecret }));
vi.mock("@/lib/hydrate-platform-env", () => ({ hydratePlatformEnvFromDatabase: M.hydratePlatformEnv }));
vi.mock("@/lib/ensure-content-hub-schema", () => ({ ensureContentCalendarV22Schema: M.ensureSchema }));
vi.mock("@/lib/content-calendar/cowork-jobs", () => ({
  getPendingMediaAgentJobs: M.getPendingMediaAgentJobs,
  updateMediaAgentJobStatus: M.updateMediaAgentJobStatus,
}));
vi.mock("@/lib/content-calendar/content-calendar-cowork-orchestration", () => ({
  completeGenerateMediaJob: M.completeGenerateMediaJob,
}));
vi.mock("@/lib/content-calendar/content-calendar-ai", () => ({
  generateStaticMedia: M.generateStaticMedia,
}));
vi.mock("@/lib/content-calendar/content-calendar-store", () => ({
  updatePostMedia: M.updatePostMedia,
}));
vi.mock("@/lib/ni-brain-client", () => ({
  createNiBrainClient: () => {
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      eq: () => builder,
      gte: () => Promise.resolve(M.niBrainSelectResult),
    });
    return { from: () => builder };
  },
}));

import { GET } from "@/app/api/cron/content-calendar-generate-media/route";

const req = () => new Request("https://matchfit.test/api/cron/content-calendar-generate-media");

function job(prompts: Record<string, unknown>) {
  return { id: "job_1", brief: { kind: "generate_media", prompts } };
}

function okImage(url: string) {
  return { ok: true as const, url, path: "p", model: "gemini-3.1-flash-image", aspectRatio: "4:5" as const };
}

/** aspect ratios passed to generateStaticMedia, in call order */
function ratios(): string[] {
  return M.generateStaticMedia.mock.calls.map((call) => call[1] as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  M.hasValidCoworkSecret.mockResolvedValue(true);
  M.hydratePlatformEnv.mockResolvedValue(undefined);
  M.ensureSchema.mockResolvedValue(undefined);
  M.updateMediaAgentJobStatus.mockResolvedValue(undefined);
  M.completeGenerateMediaJob.mockResolvedValue({ updated: 1 });
  M.updatePostMedia.mockResolvedValue(undefined);
  M.niBrainSelectResult.data = [];
  M.niBrainSelectResult.error = null;
});

describe("generate-media cron aspect ratios", () => {
  it("maps post type to the platform-correct ratio (Video 9:16, Static/Carousel 4:5)", async () => {
    M.getPendingMediaAgentJobs.mockResolvedValue([
      job({
        video: { postId: "p_video", postType: "Video", prompt: "video hook" },
        static: { postId: "p_static", postType: "Static", prompt: "static still" },
        carousel: { postId: "p_carousel", postType: "Carousel", prompt: "carousel" },
      }),
    ]);
    M.generateStaticMedia.mockResolvedValue(okImage("https://cdn.test/i.png"));

    const res = await GET(req());
    expect(res.status).toBe(200);

    // 1 video frame + 1 static frame + 5 carousel frames
    expect(ratios()).toEqual(["9:16", "4:5", "4:5", "4:5", "4:5", "4:5", "4:5"]);
  });

  it("prefers the brief's dimensions.aspectRatio over the post-type map", async () => {
    M.getPendingMediaAgentJobs.mockResolvedValue([
      job({
        static: {
          postId: "p_static",
          postType: "Static",
          prompt: "still",
          dimensions: { aspectRatio: "16:9" },
        },
      }),
    ]);
    M.generateStaticMedia.mockResolvedValue(okImage("https://cdn.test/i.png"));

    await GET(req());

    expect(ratios()).toEqual(["16:9"]);
  });

  it("ignores an unsupported ratio in the brief and falls back to the post-type map", async () => {
    M.getPendingMediaAgentJobs.mockResolvedValue([
      job({
        video: { postId: "p_video", postType: "Video", prompt: "hook", dimensions: { aspectRatio: "3:2" } },
      }),
    ]);
    M.generateStaticMedia.mockResolvedValue(okImage("https://cdn.test/i.png"));

    await GET(req());

    expect(ratios()).toEqual(["9:16"]);
  });
});

describe("generate-media cron zero-image handling", () => {
  it("does NOT promote anything to publishing and fails the job with the real reason", async () => {
    M.getPendingMediaAgentJobs.mockResolvedValue([
      job({ static: { postId: "p_static", postType: "Static", prompt: "still" } }),
    ]);
    M.generateStaticMedia.mockResolvedValue({
      ok: false,
      reason: "free image quota exhausted for today",
    });

    const res = await GET(req());
    const body = (await res.json()) as { results: Array<{ error?: string }> };

    // The bug: completeGenerateMediaJob used to run anyway, marking the job complete and
    // pushing media-less posts into workflow_stage 'publishing'.
    expect(M.completeGenerateMediaJob).not.toHaveBeenCalled();
    expect(M.updateMediaAgentJobStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job_1",
        status: "failed",
        error: expect.stringContaining("free image quota exhausted for today"),
      }),
    );
    expect(body.results[0]?.error).toContain("free image quota exhausted for today");
  });

  it("promotes only the posts that actually got media and skips the empty one", async () => {
    M.getPendingMediaAgentJobs.mockResolvedValue([
      job({
        static: { postId: "p_ok", postType: "Static", prompt: "still" },
        video: { postId: "p_empty", postType: "Video", prompt: "hook" },
      }),
    ]);
    M.generateStaticMedia
      .mockResolvedValueOnce(okImage("https://cdn.test/ok.png"))
      .mockResolvedValueOnce({ ok: false, reason: "Gemini primary (gemini-3.1-flash-image) HTTP 500" });

    const res = await GET(req());
    const body = (await res.json()) as {
      results: Array<{ generated?: number; skippedPosts?: string[]; mediaErrors?: string[] }>;
    };

    expect(M.completeGenerateMediaJob).toHaveBeenCalledWith({
      jobId: "job_1",
      mediaUrls: { p_ok: ["https://cdn.test/ok.png"] },
    });
    expect(body.results[0]?.skippedPosts).toEqual(["p_empty"]);
    expect(body.results[0]?.generated).toBe(1);
    expect(body.results[0]?.mediaErrors?.[0]).toContain("HTTP 500");
    // FIXED 2026-09-01: the skipped post must be told it failed, not left at whatever
    // media_status it had before (e.g. "generating" forever with no visible error).
    expect(M.updatePostMedia).toHaveBeenCalledWith({
      postId: "p_empty",
      mediaUrl: null,
      mediaStatus: "failed",
    });
    // The post that actually got media is never touched by this reset.
    expect(M.updatePostMedia).not.toHaveBeenCalledWith(expect.objectContaining({ postId: "p_ok" }));
  });

  it("still fails a job whose brief has no usable prompts", async () => {
    M.getPendingMediaAgentJobs.mockResolvedValue([job({ static: { postId: "p_1" } })]);

    await GET(req());

    expect(M.generateStaticMedia).not.toHaveBeenCalled();
    expect(M.completeGenerateMediaJob).not.toHaveBeenCalled();
    expect(M.updateMediaAgentJobStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", error: "Job brief contained no usable prompts." }),
    );
  });

  it("rejects an unauthorized caller", async () => {
    M.hasValidCoworkSecret.mockResolvedValue(false);

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(M.getPendingMediaAgentJobs).not.toHaveBeenCalled();
  });
});

describe("generate-media cron daily cap (JB locked 2026-08-03: 1 static + 1 carousel + 1 video/day)", () => {
  it("does not generate a type already completed today, and re-queues instead of failing", async () => {
    M.niBrainSelectResult.data = [{ post_type: "Static" }];
    M.getPendingMediaAgentJobs.mockResolvedValue([
      job({ static: { postId: "p_static", postType: "Static", prompt: "still" } }),
    ]);

    const res = await GET(req());
    const body = (await res.json()) as { results: Array<{ cappedPosts?: string[] }> };

    expect(M.generateStaticMedia).not.toHaveBeenCalled();
    expect(M.completeGenerateMediaJob).not.toHaveBeenCalled();
    // Left queued for a future run once the cap resets — not marked failed.
    expect(M.updateMediaAgentJobStatus).toHaveBeenCalledWith({ jobId: "job_1", status: "queued" });
    expect(M.updateMediaAgentJobStatus).not.toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
    expect(body.results[0]?.cappedPosts).toEqual(["p_static"]);
  });

  it("generates the still-open types and caps only the exhausted one within the same job", async () => {
    M.niBrainSelectResult.data = [{ post_type: "Video" }];
    M.getPendingMediaAgentJobs.mockResolvedValue([
      job({
        static: { postId: "p_static", postType: "Static", prompt: "still" },
        video: { postId: "p_video", postType: "Video", prompt: "hook" },
      }),
    ]);
    M.generateStaticMedia.mockResolvedValue(okImage("https://cdn.test/i.png"));

    await GET(req());

    // Only the Static frame gets generated — Video is capped, Static's single frame goes out.
    expect(M.generateStaticMedia).toHaveBeenCalledTimes(1);
    expect(M.completeGenerateMediaJob).toHaveBeenCalledWith({
      jobId: "job_1",
      mediaUrls: { p_static: ["https://cdn.test/i.png"] },
    });
  });

  it("never generates a second post of the same type within one run, even across two jobs", async () => {
    M.getPendingMediaAgentJobs.mockResolvedValue([
      job({ static: { postId: "p_static_1", postType: "Static", prompt: "still 1" } }),
      { id: "job_2", brief: { kind: "generate_media", prompts: { static: { postId: "p_static_2", postType: "Static", prompt: "still 2" } } } },
    ]);
    M.generateStaticMedia.mockResolvedValue(okImage("https://cdn.test/i.png"));

    await GET(req());

    // Job 1 claims today's only Static slot; job 2's Static prompt is capped in-memory even
    // though the DB write from job 1 hasn't landed yet.
    expect(M.generateStaticMedia).toHaveBeenCalledTimes(1);
    expect(M.completeGenerateMediaJob).toHaveBeenCalledWith({
      jobId: "job_1",
      mediaUrls: { p_static_1: ["https://cdn.test/i.png"] },
    });
    expect(M.completeGenerateMediaJob).not.toHaveBeenCalledWith(expect.objectContaining({ jobId: "job_2" }));
    expect(M.updateMediaAgentJobStatus).toHaveBeenCalledWith({ jobId: "job_2", status: "queued" });
  });
});

describe("generate-media cron pending-stage guard (completeGenerateMediaJob's own workflow_stage='pending' check)", () => {
  // completeGenerateMediaJob is mocked at the top of this file, so its real guard (a post moved
  // off "pending" — e.g. JB hit Stop — before this callback lands is skipped, not resurrected into
  // "publishing") is unit-tested directly in content-calendar-cowork-orchestration.test.ts. What
  // this cron route can and must do on its own: pass every generated post through unconditionally
  // and trust whatever `updated` count comes back, never assuming updated === the number of
  // mediaUrls entries it sent.
  it("reports whatever updated count completeGenerateMediaJob returns, even when it's less than the posts generated (one already moved off pending)", async () => {
    M.getPendingMediaAgentJobs.mockResolvedValue([
      job({
        static: { postId: "p_still_pending", postType: "Static", prompt: "still" },
        video: { postId: "p_moved_away", postType: "Video", prompt: "hook" },
      }),
    ]);
    M.generateStaticMedia.mockResolvedValue(okImage("https://cdn.test/i.png"));
    // Both posts got media generated here, but only one was genuinely still "pending" by the time
    // the (mocked) store function's own guard ran — it reports 1 updated, not 2.
    M.completeGenerateMediaJob.mockResolvedValue({ updated: 1 });

    const res = await GET(req());
    const body = (await res.json()) as { results: Array<{ updated?: number; generated?: number }> };

    expect(res.status).toBe(200);
    expect(body.results[0]?.updated).toBe(1);
    // Still reports every frame it actually generated (2) — the cron doesn't silently reconcile
    // "generated" against the guarded "updated" count, it just passes both through honestly.
    expect(body.results[0]?.generated).toBe(2);
    expect(M.completeGenerateMediaJob).toHaveBeenCalledWith({
      jobId: "job_1",
      mediaUrls: {
        p_still_pending: ["https://cdn.test/i.png"],
        p_moved_away: ["https://cdn.test/i.png"],
      },
    });
  });
});
