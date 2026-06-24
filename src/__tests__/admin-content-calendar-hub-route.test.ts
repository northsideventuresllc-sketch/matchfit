import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdminSession,
  mockIsNiBrainConfiguredAsync,
  mockEnsureContentHubSchema,
  mockSaveDraftToHub,
  mockLoadHubPosts,
  mockSerializePostForClient,
} = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockIsNiBrainConfiguredAsync: vi.fn(),
  mockEnsureContentHubSchema: vi.fn(),
  mockSaveDraftToHub: vi.fn(),
  mockLoadHubPosts: vi.fn(),
  mockSerializePostForClient: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/ni-brain-client", () => ({
  isNiBrainConfiguredAsync: mockIsNiBrainConfiguredAsync,
}));

vi.mock("@/lib/ensure-content-hub-schema", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ensure-content-hub-schema")>(
    "@/lib/ensure-content-hub-schema",
  );
  return {
    ...actual,
    ensureContentHubSchema: mockEnsureContentHubSchema,
  };
});

vi.mock("@/lib/content-calendar/content-calendar-store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content-calendar/content-calendar-store")>(
    "@/lib/content-calendar/content-calendar-store",
  );
  return {
    ...actual,
    saveDraftToHub: mockSaveDraftToHub,
    loadHubPosts: mockLoadHubPosts,
    serializePostForClient: mockSerializePostForClient,
  };
});

import { POST } from "@/app/api/admin/content-calendar/hub/route";

const draftPayload = {
  draft: {
    tempId: "draft_1",
    dayIndex: 0,
    postType: "Carousel",
    targetGroup: "Join the Team",
    platforms: "Instagram + Facebook",
    caption: "Test caption",
    visualPrompt: "Orange brand visual",
    hashtags: ["MatchFit"],
    postDate: "2026-06-09",
  },
  weekStart: "2026-06-09",
  scheduled: true,
  bulkSessionId: "bulk_123",
};

function postJson(body: unknown): Request {
  return new Request("https://matchfit.test/api/admin/content-calendar/hub", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/content-calendar/hub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({
      adminId: "admin_1",
      testMode: false,
      rememberMe: true,
    });
    mockIsNiBrainConfiguredAsync.mockResolvedValue(true);
    mockEnsureContentHubSchema.mockResolvedValue(undefined);
    mockSaveDraftToHub.mockResolvedValue({ id: "post_1" });
    mockSerializePostForClient.mockReturnValue({ id: "post_1" });
  });

  it("returns saved post after ensuring schema", async () => {
    const response = await POST(postJson(draftPayload));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ post: { id: "post_1" } });
    expect(mockEnsureContentHubSchema).toHaveBeenCalledTimes(1);
    expect(mockSaveDraftToHub).toHaveBeenCalledWith(
      expect.objectContaining({
        weekStart: "2026-06-09",
        bulkSessionId: "bulk_123",
        adminId: "admin_1",
      }),
    );
  });

  it("returns actionable schema errors instead of a generic message", async () => {
    mockEnsureContentHubSchema.mockRejectedValueOnce(
      new Error("Content Hub columns are missing on NI Brain. Set NI_BRAIN_DATABASE_URL"),
    );

    const response = await POST(postJson(draftPayload));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Content Hub columns are missing on NI Brain. Set NI_BRAIN_DATABASE_URL",
    });
  });
});
