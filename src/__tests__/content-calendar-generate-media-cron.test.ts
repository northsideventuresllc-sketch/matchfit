import { beforeEach, describe, expect, it, vi } from "vitest";

const M = vi.hoisted(() => ({
  hasValidCoworkSecret: vi.fn(),
  hydratePlatformEnv: vi.fn(),
  ensureSchema: vi.fn(),
  getPendingMediaAgentJobs: vi.fn(),
  hasLiveMiniJobForPost: vi.fn(),
  queueMiniChromeAgentJob: vi.fn(),
}));

vi.mock("@/lib/require-cowork-secret", () => ({ hasValidCoworkSecret: M.hasValidCoworkSecret }));
vi.mock("@/lib/hydrate-platform-env", () => ({ hydratePlatformEnvFromDatabase: M.hydratePlatformEnv }));
vi.mock("@/lib/ensure-content-hub-schema", () => ({ ensureContentCalendarV22Schema: M.ensureSchema }));
vi.mock("@/lib/content-calendar/cowork-jobs", () => ({
  getPendingMediaAgentJobs: M.getPendingMediaAgentJobs,
  hasLiveMiniJobForPost: M.hasLiveMiniJobForPost,
  queueMiniChromeAgentJob: M.queueMiniChromeAgentJob,
}));

import { GET } from "@/app/api/cron/content-calendar-generate-media/route";

const req = () => new Request("https://matchfit.test/api/cron/content-calendar-generate-media");

function job(prompts: Record<string, unknown>, id = "job_1") {
  return { id, brief: { kind: "generate_media", prompts } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  M.hasValidCoworkSecret.mockResolvedValue(true);
  M.hydratePlatformEnv.mockResolvedValue(undefined);
  M.ensureSchema.mockResolvedValue(undefined);
  M.hasLiveMiniJobForPost.mockResolvedValue(false);
  M.queueMiniChromeAgentJob.mockResolvedValue(undefined);
});

// Corrected 2026-09-03 (Decision #1722 item 4 + same-date Learning, lane D2): this cron used to
// call generateStaticMedia() against a Gemini image API key with zero free quota, then mark the
// post media_status="failed" on every call — clobbering whatever the Mac mini's browser agent
// was doing with the same post. It now only re-queues posts to the mini and never touches a
// post's media_status or fails a job.
describe("generate-media cron — re-queue to the Mac mini only", () => {
  it("queues every post in a job's brief that has no live mini job", async () => {
    M.getPendingMediaAgentJobs.mockResolvedValue([
      job({
        static: { postId: "p_static", postType: "Static", prompt: "still" },
        video: { postId: "p_video", postType: "Video", prompt: "hook" },
      }),
    ]);

    const res = await GET(req());
    const body = (await res.json()) as {
      results: Array<{ jobId: string; queuedToMini: string[]; alreadyLive: string[]; skipped: string[] }>;
    };

    expect(res.status).toBe(200);
    expect(M.queueMiniChromeAgentJob).toHaveBeenCalledWith(
      expect.objectContaining({ ids: ["p_static"] }),
    );
    expect(M.queueMiniChromeAgentJob).toHaveBeenCalledWith(
      expect.objectContaining({ ids: ["p_video"] }),
    );
    expect(body.results[0]?.queuedToMini.sort()).toEqual(["p_static", "p_video"]);
  });

  it("skips a post that already has a live mini job instead of double-queueing", async () => {
    M.hasLiveMiniJobForPost.mockImplementation(async (postId: string) => postId === "p_in_flight");
    M.getPendingMediaAgentJobs.mockResolvedValue([
      job({ static: { postId: "p_in_flight", postType: "Static", prompt: "still" } }),
    ]);

    const res = await GET(req());
    const body = (await res.json()) as { results: Array<{ queuedToMini: string[]; alreadyLive: string[] }> };

    expect(res.status).toBe(200);
    expect(M.queueMiniChromeAgentJob).not.toHaveBeenCalled();
    expect(body.results[0]?.alreadyLive).toEqual(["p_in_flight"]);
    expect(body.results[0]?.queuedToMini).toEqual([]);
  });

  it("never marks a post's media_status, even when queueing fails", async () => {
    M.queueMiniChromeAgentJob.mockRejectedValueOnce(new Error("nvg_mini_jobs insert failed"));
    M.getPendingMediaAgentJobs.mockResolvedValue([
      job({ static: { postId: "p_broken", postType: "Static", prompt: "still" } }),
    ]);

    const res = await GET(req());
    const body = (await res.json()) as { results: Array<{ skipped: string[] }> };

    expect(res.status).toBe(200);
    expect(body.results[0]?.skipped).toEqual(["p_broken"]);
    // No content-calendar-store import in this route at all — a post's media_status can only be
    // written by the admin/orchestration paths or the mini's own write-back, never this cron.
  });

  it("ignores prompt entries with no postId and still returns 200", async () => {
    M.getPendingMediaAgentJobs.mockResolvedValue([job({ static: { prompt: "no id here" } })]);

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(M.queueMiniChromeAgentJob).not.toHaveBeenCalled();
  });

  it("rejects an unauthorized caller", async () => {
    M.hasValidCoworkSecret.mockResolvedValue(false);

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(M.getPendingMediaAgentJobs).not.toHaveBeenCalled();
  });
});
