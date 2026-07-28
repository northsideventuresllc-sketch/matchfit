import { beforeEach, describe, expect, it, vi } from "vitest";

const M = vi.hoisted(() => ({
  hasValidCoworkSecret: vi.fn(),
  hydratePlatformEnv: vi.fn(),
  ensureSchema: vi.fn(),
  getPendingCoworkJobs: vi.fn(),
  updateCoworkJobStatus: vi.fn(),
  completeGenerateMediaJob: vi.fn(),
  generateStaticMedia: vi.fn(),
}));

vi.mock("@/lib/require-cowork-secret", () => ({ hasValidCoworkSecret: M.hasValidCoworkSecret }));
vi.mock("@/lib/hydrate-platform-env", () => ({ hydratePlatformEnvFromDatabase: M.hydratePlatformEnv }));
vi.mock("@/lib/ensure-content-hub-schema", () => ({ ensureContentCalendarV22Schema: M.ensureSchema }));
vi.mock("@/lib/content-calendar/cowork-jobs", () => ({
  getPendingCoworkJobs: M.getPendingCoworkJobs,
  updateCoworkJobStatus: M.updateCoworkJobStatus,
}));
vi.mock("@/lib/content-calendar/content-calendar-cowork-orchestration", () => ({
  completeGenerateMediaJob: M.completeGenerateMediaJob,
}));
vi.mock("@/lib/content-calendar/content-calendar-ai", () => ({
  generateStaticMedia: M.generateStaticMedia,
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
  M.updateCoworkJobStatus.mockResolvedValue(undefined);
  M.completeGenerateMediaJob.mockResolvedValue({ updated: 1 });
});

describe("generate-media cron aspect ratios", () => {
  it("maps post type to the platform-correct ratio (Video 9:16, Static/Carousel 4:5)", async () => {
    M.getPendingCoworkJobs.mockResolvedValue([
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
    M.getPendingCoworkJobs.mockResolvedValue([
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
    M.getPendingCoworkJobs.mockResolvedValue([
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
    M.getPendingCoworkJobs.mockResolvedValue([
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
    expect(M.updateCoworkJobStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job_1",
        status: "failed",
        error: expect.stringContaining("free image quota exhausted for today"),
      }),
    );
    expect(body.results[0]?.error).toContain("free image quota exhausted for today");
  });

  it("promotes only the posts that actually got media and skips the empty one", async () => {
    M.getPendingCoworkJobs.mockResolvedValue([
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
  });

  it("still fails a job whose brief has no usable prompts", async () => {
    M.getPendingCoworkJobs.mockResolvedValue([job({ static: { postId: "p_1" } })]);

    await GET(req());

    expect(M.generateStaticMedia).not.toHaveBeenCalled();
    expect(M.completeGenerateMediaJob).not.toHaveBeenCalled();
    expect(M.updateCoworkJobStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", error: "Job brief contained no usable prompts." }),
    );
  });

  it("rejects an unauthorized caller", async () => {
    M.hasValidCoworkSecret.mockResolvedValue(false);

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(M.getPendingCoworkJobs).not.toHaveBeenCalled();
  });
});
