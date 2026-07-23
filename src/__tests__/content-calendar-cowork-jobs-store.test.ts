import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateNiBrainClient } = vi.hoisted(() => ({
  mockCreateNiBrainClient: vi.fn(),
}));

vi.mock("@/lib/ni-brain-client", () => ({
  createNiBrainClient: mockCreateNiBrainClient,
}));

import {
  createCoworkJob,
  getContentCalendarSettings,
  getMatchFitDpmoPhase,
  getPendingCoworkJobs,
  updateContentCalendarSettings,
  updateCoworkJobStatus,
} from "@/lib/content-calendar/cowork-jobs";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createCoworkJob", () => {
  it("inserts a queued job and returns the row", async () => {
    let captured: Record<string, unknown> | null = null;
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        insert: (row: Record<string, unknown>) => {
          captured = row;
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: "job_1", ...row }, error: null }),
            }),
          };
        },
      }),
    });

    const job = await createCoworkJob({
      jobType: "generate_media",
      brief: { prompt: "make a reel" },
      platformTargets: ["Instagram"],
    });

    expect(captured).toMatchObject({
      job_type: "generate_media",
      status: "queued",
      brief: { prompt: "make a reel" },
      platform_targets: ["Instagram"],
    });
    expect(job.id).toBe("job_1");
  });
});

describe("updateCoworkJobStatus", () => {
  it("stamps completed_at and result when completing", async () => {
    let captured: Record<string, unknown> | null = null;
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        update: (patch: Record<string, unknown>) => {
          captured = patch;
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    });

    await updateCoworkJobStatus({
      jobId: "job_1",
      status: "complete",
      result: { urls: ["https://example.com/a.png"] },
    });

    expect(captured).toMatchObject({ status: "complete", result: { urls: ["https://example.com/a.png"] } });
    expect((captured as Record<string, unknown>).completed_at).toBeTruthy();
  });

  it("stamps dispatched_at when dispatching", async () => {
    let captured: Record<string, unknown> | null = null;
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        update: (patch: Record<string, unknown>) => {
          captured = patch;
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    });

    await updateCoworkJobStatus({ jobId: "job_1", status: "dispatched" });

    expect((captured as Record<string, unknown>).dispatched_at).toBeTruthy();
    expect((captured as Record<string, unknown>).completed_at).toBeUndefined();
  });
});

describe("getPendingCoworkJobs", () => {
  it("returns only queued jobs ordered by creation", async () => {
    let capturedEq: [string, string] | null = null;
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: (col: string, val: string) => {
            capturedEq = [col, val];
            return { order: () => Promise.resolve({ data: [{ id: "job_1" }], error: null }) };
          },
        }),
      }),
    });

    const jobs = await getPendingCoworkJobs();

    expect(capturedEq).toEqual(["status", "queued"]);
    expect(jobs).toHaveLength(1);
  });
});

describe("content calendar settings", () => {
  it("reads the current settings row", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        select: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "s1", posted_retention_hours: 48, scrapped_retention_days: 7, updated_at: "now" },
                  error: null,
                }),
            }),
          }),
        }),
      }),
    });

    const settings = await getContentCalendarSettings();
    expect(settings?.posted_retention_hours).toBe(48);
    expect(settings?.scrapped_retention_days).toBe(7);
  });

  it("updates the existing settings row in place", async () => {
    let capturedPatch: Record<string, unknown> | null = null;
    const existing = { id: "s1", posted_retention_hours: 48, scrapped_retention_days: 7, updated_at: "old" };
    const builder = {
      select: () => ({
        order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: existing, error: null }) }) }),
        single: () =>
          Promise.resolve({ data: { ...existing, posted_retention_hours: 72, updated_at: "new" }, error: null }),
      }),
      update: (patch: Record<string, unknown>) => {
        capturedPatch = patch;
        return builder;
      },
      insert: () => builder,
      eq: () => builder,
    };
    mockCreateNiBrainClient.mockReturnValue({ from: () => builder });

    const updated = await updateContentCalendarSettings({ postedRetentionHours: 72 });

    expect(capturedPatch).toMatchObject({ posted_retention_hours: 72 });
    expect(updated.posted_retention_hours).toBe(72);
  });

  it("inserts a settings row when none exists", async () => {
    let capturedInsert: Record<string, unknown> | null = null;
    const builder = {
      select: () => ({
        order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
        single: () =>
          Promise.resolve({
            data: { id: "s2", posted_retention_hours: 24, scrapped_retention_days: 7, updated_at: "new" },
            error: null,
          }),
      }),
      insert: (row: Record<string, unknown>) => {
        capturedInsert = row;
        return builder;
      },
      update: () => builder,
      eq: () => builder,
    };
    mockCreateNiBrainClient.mockReturnValue({ from: () => builder });

    const created = await updateContentCalendarSettings({ postedRetentionHours: 24 });

    expect(capturedInsert).toMatchObject({ posted_retention_hours: 24, scrapped_retention_days: 7 });
    expect(created.id).toBe("s2");
  });
});

describe("getMatchFitDpmoPhase", () => {
  it("returns the seeded phase1 value for match-fit", async () => {
    let capturedEq: [string, string] | null = null;
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: (col: string, val: string) => {
            capturedEq = [col, val];
            return { maybeSingle: () => Promise.resolve({ data: { phase: "phase1" }, error: null }) };
          },
        }),
      }),
    });

    const phase = await getMatchFitDpmoPhase();

    expect(capturedEq).toEqual(["product_slug", "match-fit"]);
    expect(phase).toBe("phase1");
  });

  it("returns null when no scoreboard row exists", async () => {
    mockCreateNiBrainClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
      }),
    });

    await expect(getMatchFitDpmoPhase()).resolves.toBeNull();
  });
});
