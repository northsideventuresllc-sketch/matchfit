import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdminSession,
  mockIsNiBrainConfiguredAsync,
  mockRecordContentLearning,
  mockMarkPostPosted,
  mockDismissMissedPrompt,
  mockReschedulePost,
  mockUpsertWeekPosts,
  mockSerializePostForClient,
  mockUpdatePostMedia,
  mockRegenerateCalendarPost,
  mockGenerateStaticMedia,
} = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockIsNiBrainConfiguredAsync: vi.fn(),
  mockRecordContentLearning: vi.fn(),
  mockMarkPostPosted: vi.fn(),
  mockDismissMissedPrompt: vi.fn(),
  mockReschedulePost: vi.fn(),
  mockUpsertWeekPosts: vi.fn(),
  mockSerializePostForClient: vi.fn(),
  mockUpdatePostMedia: vi.fn(),
  mockRegenerateCalendarPost: vi.fn(),
  mockGenerateStaticMedia: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/ni-brain-client", () => ({
  isNiBrainConfiguredAsync: mockIsNiBrainConfiguredAsync,
  recordContentLearning: mockRecordContentLearning,
}));

vi.mock("@/lib/content-calendar/content-calendar-store", () => ({
  dismissMissedPrompt: mockDismissMissedPrompt,
  markPostPosted: mockMarkPostPosted,
  reschedulePost: mockReschedulePost,
  serializePostForClient: mockSerializePostForClient,
  updatePostMedia: mockUpdatePostMedia,
  upsertWeekPosts: mockUpsertWeekPosts,
}));

vi.mock("@/lib/content-calendar/content-calendar-ai", () => ({
  generateStaticMedia: mockGenerateStaticMedia,
  regenerateCalendarPost: mockRegenerateCalendarPost,
}));

import { POST } from "@/app/api/admin/content-calendar/posts/[id]/actions/route";

function postJson(body: unknown): Request {
  return new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const routeCtx = { params: Promise.resolve({ id: "post_1" }) };

describe("POST /api/admin/content-calendar/posts/[id]/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRequireAdminSession.mockResolvedValue({
      adminId: "admin_1",
      testMode: false,
      rememberMe: true,
    });
    mockIsNiBrainConfiguredAsync.mockResolvedValue(true);
    mockRegenerateCalendarPost.mockResolvedValue({
      date: "2026-06-03",
      dayIndex: 2,
      postType: "Video",
      targetGroup: "Atlanta Trainers",
      hook: "New class opening",
      cta: "Book now",
      caption: "Caption copy",
      hashtags: ["#matchfit"],
      visualPrompt: "A trainer in studio",
      status: "draft",
    });
    mockUpsertWeekPosts.mockResolvedValue([
      {
        id: "row_1",
        day_index: 2,
        post_type: "Video",
      },
    ]);
    mockSerializePostForClient.mockReturnValue({ id: "row_1_client" });
    mockGenerateStaticMedia.mockResolvedValue({ url: "https://cdn.matchfit.test/generated.png" });
  });

  it("returns 401 when requester is not an authenticated admin", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const res = await POST(postJson({ action: "posted" }), routeCtx);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockIsNiBrainConfiguredAsync).not.toHaveBeenCalled();
  });

  it("returns 503 when NI Brain is not configured", async () => {
    mockIsNiBrainConfiguredAsync.mockResolvedValueOnce(false);

    const res = await POST(postJson({ action: "posted" }), routeCtx);

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "NI Brain is not configured." });
    expect(mockMarkPostPosted).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid action payload", async () => {
    const res = await POST(postJson({ action: "not_real" }), routeCtx);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid action." });
  });

  it("returns 400 when request JSON is malformed", async () => {
    const malformedReq = new Request(
      "https://matchfit.test/api/admin/content-calendar/posts/post_1/actions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{bad-json",
      },
    );

    const res = await POST(malformedReq, routeCtx);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid action." });
  });

  it("marks post as posted and records learning signal", async () => {
    const res = await POST(postJson({ action: "posted" }), routeCtx);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockMarkPostPosted).toHaveBeenCalledWith("post_1", false);
    expect(mockRecordContentLearning).toHaveBeenCalledWith(
      expect.objectContaining({
        signalType: "POSTED",
        postId: "post_1",
        meta: expect.objectContaining({
          postedAt: expect.any(String),
        }),
      }),
    );
  });

  it("dismisses missed prompt", async () => {
    const res = await POST(postJson({ action: "dismiss_missed" }), routeCtx);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockDismissMissedPrompt).toHaveBeenCalledWith("post_1");
  });

  it("reschedules a post with new date", async () => {
    const res = await POST(
      postJson({
        action: "reschedule",
        newDate: "2026-06-10",
      }),
      routeCtx,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockReschedulePost).toHaveBeenCalledWith({ postId: "post_1", newDate: "2026-06-10" });
  });

  it("regenerates a post, upserts it, and returns serialized post", async () => {
    const res = await POST(
      postJson({
        action: "regenerate",
        weekStart: "2026-06-02",
        offset: 7,
        dayIndex: 2,
        postType: "Video",
        feedback: "Make this more conversion-focused.",
        existingCaption: "Old caption",
        existingVisualPrompt: "Old visual prompt",
      }),
      routeCtx,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ post: { id: "row_1_client" } });
    expect(mockRegenerateCalendarPost).toHaveBeenCalledWith({
      weekStart: "2026-06-02",
      offset: 7,
      dayIndex: 2,
      postType: "Video",
      feedback: "Make this more conversion-focused.",
      existingCaption: "Old caption",
      existingVisualPrompt: "Old visual prompt",
    });
    expect(mockUpsertWeekPosts).toHaveBeenCalledWith({
      weekStart: "2026-06-02",
      offset: 7,
      posts: [expect.any(Object)],
      adminId: "admin_1",
    });
    expect(mockSerializePostForClient).toHaveBeenCalledWith({
      id: "row_1",
      day_index: 2,
      post_type: "Video",
    });
  });

  it("returns 502 when regeneration fails", async () => {
    mockRegenerateCalendarPost.mockResolvedValueOnce(null);

    const res = await POST(
      postJson({
        action: "regenerate",
        weekStart: "2026-06-02",
        offset: 0,
        dayIndex: 0,
        postType: "Carousel",
      }),
      routeCtx,
    );

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "Regeneration failed. Check AI API keys." });
    expect(mockUpsertWeekPosts).not.toHaveBeenCalled();
  });

  it("returns null post when regenerated row is not found in upsert results", async () => {
    mockUpsertWeekPosts.mockResolvedValueOnce([
      {
        id: "row_other",
        day_index: 0,
        post_type: "Carousel",
      },
    ]);

    const res = await POST(
      postJson({
        action: "regenerate",
        weekStart: "2026-06-02",
        offset: 7,
        dayIndex: 4,
        postType: "Text",
      }),
      routeCtx,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ post: null });
    expect(mockSerializePostForClient).not.toHaveBeenCalled();
  });

  it("rejects regenerate payloads with out-of-range dayIndex", async () => {
    const res = await POST(
      postJson({
        action: "regenerate",
        weekStart: "2026-06-02",
        offset: 7,
        dayIndex: 5,
        postType: "Text",
      }),
      routeCtx,
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid action." });
    expect(mockRegenerateCalendarPost).not.toHaveBeenCalled();
  });

  it("generates media, updates status transitions, and records prompt learning", async () => {
    const prompt = "a".repeat(600);

    const res = await POST(
      postJson({
        action: "generate_media",
        prompt,
      }),
      routeCtx,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ mediaUrl: "https://cdn.matchfit.test/generated.png" });
    expect(mockUpdatePostMedia).toHaveBeenNthCalledWith(1, {
      postId: "post_1",
      mediaUrl: null,
      mediaStatus: "generating",
    });
    expect(mockUpdatePostMedia).toHaveBeenNthCalledWith(2, {
      postId: "post_1",
      mediaUrl: "https://cdn.matchfit.test/generated.png",
      mediaStatus: "ready",
    });
    expect(mockRecordContentLearning).toHaveBeenCalledWith({
      signalType: "MEDIA_GENERATED",
      postId: "post_1",
      editedText: "https://cdn.matchfit.test/generated.png",
      meta: { prompt: "a".repeat(500) },
    });
  });

  it("returns 502 and marks media generation failed when no image is produced", async () => {
    mockGenerateStaticMedia.mockResolvedValueOnce(null);

    const res = await POST(
      postJson({
        action: "generate_media",
        prompt: "Generate a studio hero image for trainer onboarding.",
      }),
      routeCtx,
    );

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "Image generation failed. Check OPENAI_API_KEY." });
    expect(mockUpdatePostMedia).toHaveBeenNthCalledWith(1, {
      postId: "post_1",
      mediaUrl: null,
      mediaStatus: "generating",
    });
    expect(mockUpdatePostMedia).toHaveBeenNthCalledWith(2, {
      postId: "post_1",
      mediaUrl: null,
      mediaStatus: "failed",
    });
  });

  it("returns 500 when an action throws unexpectedly", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockMarkPostPosted.mockRejectedValueOnce(new Error("db unavailable"));

    const res = await POST(postJson({ action: "posted" }), routeCtx);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Action failed." });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
