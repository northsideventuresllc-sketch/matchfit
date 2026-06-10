import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdminSession,
  mockIsNiBrainConfiguredAsync,
  mockLoadMissedPosts,
  mockShouldShowMissedPrompt,
  mockSerializePostForClient,
} = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockIsNiBrainConfiguredAsync: vi.fn(),
  mockLoadMissedPosts: vi.fn(),
  mockShouldShowMissedPrompt: vi.fn(),
  mockSerializePostForClient: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/ni-brain-client", () => ({
  isNiBrainConfiguredAsync: mockIsNiBrainConfiguredAsync,
}));

vi.mock("@/lib/content-calendar/content-calendar-store", () => ({
  loadMissedPosts: mockLoadMissedPosts,
  serializePostForClient: mockSerializePostForClient,
}));

vi.mock("@/lib/content-calendar/schedule-utils", () => ({
  shouldShowMissedPrompt: mockShouldShowMissedPrompt,
}));

import { GET } from "@/app/api/admin/content-calendar/missed/route";

describe("GET /api/admin/content-calendar/missed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({
      adminId: "admin_1",
      testMode: false,
      rememberMe: true,
    });
    mockIsNiBrainConfiguredAsync.mockResolvedValue(true);
    mockLoadMissedPosts.mockResolvedValue([
      {
        id: "post_1",
        post_date: "2026-06-10",
        posted: false,
        missed_prompt_dismissed: false,
      },
      {
        id: "post_2",
        post_date: "2026-06-11",
        posted: false,
        missed_prompt_dismissed: true,
      },
    ]);
    mockShouldShowMissedPrompt.mockImplementation(({ missedPromptDismissed }) => !missedPromptDismissed);
    mockSerializePostForClient.mockImplementation((row) => ({ id: row.id, serialized: true }));
  });

  it("returns 401 when admin session is missing", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const res = await GET();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockIsNiBrainConfiguredAsync).not.toHaveBeenCalled();
    expect(mockLoadMissedPosts).not.toHaveBeenCalled();
  });

  it("returns empty posts when NI Brain is not configured", async () => {
    mockIsNiBrainConfiguredAsync.mockResolvedValueOnce(false);

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ posts: [] });
    expect(mockLoadMissedPosts).not.toHaveBeenCalled();
  });

  it("filters candidate rows and returns only serializable missed posts", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      posts: [{ id: "post_1", serialized: true }],
    });
    expect(mockShouldShowMissedPrompt).toHaveBeenCalledTimes(2);
    expect(mockShouldShowMissedPrompt).toHaveBeenNthCalledWith(1, {
      postDate: "2026-06-10",
      posted: false,
      missedPromptDismissed: false,
    });
    expect(mockSerializePostForClient).toHaveBeenCalledTimes(1);
    expect(mockSerializePostForClient).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "post_1",
      }),
    );
  });

  it("returns empty posts and logs when loading throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockLoadMissedPosts.mockRejectedValueOnce(new Error("database unavailable"));

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ posts: [] });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
