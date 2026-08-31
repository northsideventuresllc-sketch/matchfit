import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateNiBrainClient, mockResolveArchivePurgeAfter, mockMaybeNotifyDayFullyPosted } = vi.hoisted(() => ({
  mockCreateNiBrainClient: vi.fn(),
  mockResolveArchivePurgeAfter: vi.fn(),
  mockMaybeNotifyDayFullyPosted: vi.fn(),
}));

vi.mock("@/lib/ni-brain-client", () => ({
  createNiBrainClient: mockCreateNiBrainClient,
}));

vi.mock("@/lib/content-calendar/cowork-jobs", () => ({
  resolveArchivePurgeAfter: mockResolveArchivePurgeAfter,
}));

vi.mock("@/lib/content-calendar/content-calendar-cowork-orchestration", () => ({
  maybeNotifyDayFullyPosted: mockMaybeNotifyDayFullyPosted,
}));

import { manuallyPostV2Post, manuallyRedoV2PostMedia } from "@/lib/content-calendar/content-calendar-v2-store";
import { computeManualPostSchedule } from "@/lib/content-calendar/pending-schedule";

const PURGE_AFTER_SENTINEL = "2026-09-01T00:00:00.000Z";

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveArchivePurgeAfter.mockResolvedValue(PURGE_AFTER_SENTINEL);
  mockMaybeNotifyDayFullyPosted.mockResolvedValue({ notified: false });
});

type Row = Record<string, unknown>;

function basePost(overrides: Row = {}): Row {
  return {
    id: "post_1",
    post_date: "2026-07-27",
    post_type: "Static",
    revision: 1,
    ...overrides,
  };
}

function buildPostClient(row: Row | null) {
  const updateCalls: Record<string, unknown>[] = [];
  let currentRow = row;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: currentRow, error: null }),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        updateCalls.push(patch);
        if (currentRow) currentRow = { ...currentRow, ...patch };
        return {
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: currentRow, error: null }),
            }),
          }),
        };
      },
    }),
  };
  return { client, updateCalls };
}

describe("manuallyPostV2Post", () => {
  it("throws when the post cannot be found", async () => {
    const { client } = buildPostClient(null);
    mockCreateNiBrainClient.mockReturnValue(client);

    await expect(manuallyPostV2Post("missing")).rejects.toThrow("Post not found.");
  });

  it("throws when the post has no post_date set", async () => {
    const { client } = buildPostClient(basePost({ post_date: null }));
    mockCreateNiBrainClient.mockReturnValue(client);

    await expect(manuallyPostV2Post("post_1")).rejects.toThrow(
      "This post has no post date set, so a manual posting time cannot be computed.",
    );
  });

  it("archives the post as posted, computes the manual schedule, and fires the all-posted check", async () => {
    const { client, updateCalls } = buildPostClient(basePost());
    mockCreateNiBrainClient.mockReturnValue(client);

    const expectedScheduledAt = computeManualPostSchedule("2026-07-27").toISOString();

    const result = await manuallyPostV2Post("post_1");

    expect(updateCalls).toHaveLength(1);
    const patch = updateCalls[0];
    expect(patch.scheduled_at).toBe(expectedScheduledAt);
    expect(patch.is_scheduled).toBe(true);
    expect(patch.posted).toBe(true);
    expect(patch.status).toBe("posted");
    expect(patch.workflow_stage).toBe("archived");
    expect(patch.archive_type).toBe("posted");
    expect(patch.purge_after_at).toBe(PURGE_AFTER_SENTINEL);
    expect(patch.archived_at).toBeTruthy();
    expect(patch.posted_at).toBeTruthy();

    expect(mockResolveArchivePurgeAfter).toHaveBeenCalledWith("posted", expect.any(Date));
    expect(mockMaybeNotifyDayFullyPosted).toHaveBeenCalledWith("2026-07-27");
    expect((result as Row).id).toBe("post_1");
  });

  it("swallows a failure from the all-posted check instead of throwing", async () => {
    const { client } = buildPostClient(basePost());
    mockCreateNiBrainClient.mockReturnValue(client);
    mockMaybeNotifyDayFullyPosted.mockRejectedValue(new Error("email boom"));

    await expect(manuallyPostV2Post("post_1")).resolves.toMatchObject({ id: "post_1" });
  });
});

describe("manuallyRedoV2PostMedia", () => {
  it("stores the uploaded media as ready with generation_source manual_upload", async () => {
    const { client, updateCalls } = buildPostClient(basePost());
    mockCreateNiBrainClient.mockReturnValue(client);

    const result = await manuallyRedoV2PostMedia("post_1", { mediaUrls: ["https://cdn.test/a.png", "https://cdn.test/b.png"] });

    expect(updateCalls[0]).toMatchObject({
      media_url: "https://cdn.test/a.png",
      media_urls: ["https://cdn.test/a.png", "https://cdn.test/b.png"],
      media_status: "ready",
      generation_source: "manual_upload",
    });
    expect((result as Row).id).toBe("post_1");
  });

  it("stores a null media_url when given an empty mediaUrls array", async () => {
    const { client, updateCalls } = buildPostClient(basePost());
    mockCreateNiBrainClient.mockReturnValue(client);

    await manuallyRedoV2PostMedia("post_1", { mediaUrls: [] });

    expect(updateCalls[0]).toMatchObject({ media_url: null, media_urls: [] });
  });

  it("throws when the update fails", async () => {
    const client = {
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: { message: "db down" } }),
            }),
          }),
        }),
      }),
    };
    mockCreateNiBrainClient.mockReturnValue(client);

    await expect(manuallyRedoV2PostMedia("post_1", { mediaUrls: [] })).rejects.toThrow("db down");
  });
});
