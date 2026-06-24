import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdminSession,
  mockIsNiBrainConfiguredAsync,
  mockGenerateWeekContent,
  mockRegenerateCalendarPost,
  mockDeleteWeekPosts,
  mockLoadWeekSchedule,
  mockLoadWeekScheduleIncludingPosted,
  mockUpsertWeekPosts,
  mockSerializePostForClient,
} = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockIsNiBrainConfiguredAsync: vi.fn(),
  mockGenerateWeekContent: vi.fn(),
  mockRegenerateCalendarPost: vi.fn(),
  mockDeleteWeekPosts: vi.fn(),
  mockLoadWeekSchedule: vi.fn(),
  mockLoadWeekScheduleIncludingPosted: vi.fn(),
  mockUpsertWeekPosts: vi.fn(),
  mockSerializePostForClient: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/ni-brain-client", () => ({
  isNiBrainConfiguredAsync: mockIsNiBrainConfiguredAsync,
}));

vi.mock("@/lib/content-calendar/content-calendar-ai", () => ({
  generateWeekContent: mockGenerateWeekContent,
  regenerateCalendarPost: mockRegenerateCalendarPost,
}));

vi.mock("@/lib/content-calendar/content-calendar-store", () => ({
  deleteWeekPosts: mockDeleteWeekPosts,
  loadWeekSchedule: mockLoadWeekSchedule,
  loadWeekScheduleIncludingPosted: mockLoadWeekScheduleIncludingPosted,
  upsertWeekPosts: mockUpsertWeekPosts,
  serializePostForClient: mockSerializePostForClient,
}));

import { DELETE, GET, POST } from "@/app/api/admin/content-calendar/schedule/route";

function postJson(body: unknown): Request {
  return new Request("https://matchfit.test/api/admin/content-calendar/schedule", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/admin/content-calendar/schedule route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({
      adminId: "admin_1",
      testMode: false,
      rememberMe: true,
    });
    mockIsNiBrainConfiguredAsync.mockResolvedValue(true);
    mockDeleteWeekPosts.mockResolvedValue(undefined);
    mockLoadWeekSchedule.mockResolvedValue([]);
    mockLoadWeekScheduleIncludingPosted.mockResolvedValue([]);
    mockGenerateWeekContent.mockResolvedValue([
      {
        dayIndex: 0,
        postType: "Text",
        targetGroup: "Join the Team",
        platforms: "Threads",
        caption: "Caption",
        visualPrompt: null,
        hashtags: ["MatchFit"],
      },
    ]);
    mockRegenerateCalendarPost.mockResolvedValue({
      dayIndex: 2,
      postType: "Video",
      targetGroup: "Clients",
      platforms: "Instagram Reels",
      caption: "Regenerated",
      visualPrompt: "Visual",
      hashtags: ["MatchFit"],
    });
    mockUpsertWeekPosts.mockResolvedValue([{ id: "post_1" }]);
    mockSerializePostForClient.mockImplementation((row) => ({ id: row.id }));
  });

  it("returns 401 for GET when admin session is missing", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const res = await GET(new Request("https://matchfit.test/api/admin/content-calendar/schedule?weekStart=2026-06-08"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 400 for GET when weekStart is missing or malformed", async () => {
    const res = await GET(new Request("https://matchfit.test/api/admin/content-calendar/schedule?weekStart=06-08-2026"));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "weekStart query param required (YYYY-MM-DD)." });
    expect(mockLoadWeekSchedule).not.toHaveBeenCalled();
  });

  it("returns 503 when NI Brain is not configured", async () => {
    mockIsNiBrainConfiguredAsync.mockResolvedValueOnce(false);

    const res = await POST(postJson({ weekStart: "2026-06-08", offset: 7 }));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "NI Brain is not configured on the server." });
    expect(mockGenerateWeekContent).not.toHaveBeenCalled();
  });

  it("loads and serializes schedule posts on GET", async () => {
    mockLoadWeekSchedule.mockResolvedValueOnce([{ id: "post_1" }, { id: "post_2" }]);

    const res = await GET(new Request("https://matchfit.test/api/admin/content-calendar/schedule?weekStart=2026-06-08"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      posts: [{ id: "post_1" }, { id: "post_2" }],
    });
    expect(mockLoadWeekSchedule).toHaveBeenCalledWith("2026-06-08");
  });

  it("deletes unposted week posts on DELETE", async () => {
    const res = await DELETE(
      new Request("https://matchfit.test/api/admin/content-calendar/schedule?weekStart=2026-06-08", {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockDeleteWeekPosts).toHaveBeenCalledWith("2026-06-08");
  });

  it("returns 400 for POST when payload is invalid", async () => {
    const res = await POST(postJson({ weekStart: "bad-date" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid request." });
    expect(mockGenerateWeekContent).not.toHaveBeenCalled();
  });

  it("generates and upserts a week when regenerateAll is not requested", async () => {
    mockUpsertWeekPosts.mockResolvedValueOnce([{ id: "post_week_1" }]);

    const res = await POST(postJson({ weekStart: "2026-06-08", offset: 7 }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ posts: [{ id: "post_week_1" }] });
    expect(mockGenerateWeekContent).toHaveBeenCalledWith({ weekStart: "2026-06-08", offset: 7 });
    expect(mockUpsertWeekPosts).toHaveBeenCalledWith(
      expect.objectContaining({
        weekStart: "2026-06-08",
        offset: 7,
        adminId: "admin_1",
      }),
    );
  });

  it("returns 400 when regenerateAll has no active posts to regenerate", async () => {
    mockLoadWeekScheduleIncludingPosted.mockResolvedValueOnce([{ id: "posted", posted: true, post_type: "Text" }]);

    const res = await POST(
      postJson({
        weekStart: "2026-06-08",
        offset: 7,
        regenerateAll: true,
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "No posts to regenerate for this week." });
  });

  it("regenerates active posts and returns serialized rows when regenerateAll is true", async () => {
    mockLoadWeekScheduleIncludingPosted.mockResolvedValueOnce([
      {
        id: "post_old",
        posted: false,
        day_index: 2,
        post_type: "Video",
        caption: "Old caption",
        visual_prompt: "Old visual",
      },
    ]);
    mockUpsertWeekPosts.mockResolvedValueOnce([{ id: "post_regen_1" }]);

    const res = await POST(
      postJson({
        weekStart: "2026-06-08",
        offset: 7,
        feedback: "Lean more into Atlanta beta urgency",
        regenerateAll: true,
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ posts: [{ id: "post_regen_1" }] });
    expect(mockRegenerateCalendarPost).toHaveBeenCalledWith({
      weekStart: "2026-06-08",
      offset: 7,
      dayIndex: 2,
      postType: "Video",
      feedback: "Lean more into Atlanta beta urgency",
      existingCaption: "Old caption",
      existingVisualPrompt: "Old visual",
    });
  });
});
