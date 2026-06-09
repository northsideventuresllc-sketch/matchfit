import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdminSession,
  mockIsNiBrainConfiguredAsync,
  mockRecordContentLearning,
  mockUpdatePostCaption,
  mockDeletePost,
  mockMarkPostPosted,
  mockDismissMissedPrompt,
  mockReschedulePost,
  mockUpdatePostMedia,
  mockUpsertWeekPosts,
  mockSerializePostForClient,
  mockRegenerateCalendarPost,
  mockGenerateStaticMedia,
} = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockIsNiBrainConfiguredAsync: vi.fn(),
  mockRecordContentLearning: vi.fn(),
  mockUpdatePostCaption: vi.fn(),
  mockDeletePost: vi.fn(),
  mockMarkPostPosted: vi.fn(),
  mockDismissMissedPrompt: vi.fn(),
  mockReschedulePost: vi.fn(),
  mockUpdatePostMedia: vi.fn(),
  mockUpsertWeekPosts: vi.fn(),
  mockSerializePostForClient: vi.fn(),
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

vi.mock("@/lib/content-calendar/content-calendar-ai", () => ({
  regenerateCalendarPost: mockRegenerateCalendarPost,
  generateStaticMedia: mockGenerateStaticMedia,
}));

vi.mock("@/lib/content-calendar/content-calendar-store", () => ({
  updatePostCaption: mockUpdatePostCaption,
  deletePost: mockDeletePost,
  markPostPosted: mockMarkPostPosted,
  dismissMissedPrompt: mockDismissMissedPrompt,
  reschedulePost: mockReschedulePost,
  updatePostMedia: mockUpdatePostMedia,
  upsertWeekPosts: mockUpsertWeekPosts,
  serializePostForClient: mockSerializePostForClient,
}));

import { DELETE, PATCH } from "@/app/api/admin/content-calendar/posts/[id]/route";
import { POST as postAction } from "@/app/api/admin/content-calendar/posts/[id]/actions/route";

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("/api/admin/content-calendar/posts/[id] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({
      adminId: "admin_1",
      testMode: false,
      rememberMe: true,
    });
    mockIsNiBrainConfiguredAsync.mockResolvedValue(true);
    mockUpdatePostCaption.mockResolvedValue(undefined);
    mockDeletePost.mockResolvedValue(undefined);
    mockRecordContentLearning.mockResolvedValue(undefined);
  });

  it("returns 401 for PATCH when admin session is missing", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const res = await PATCH(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caption: "Updated caption" }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 503 for PATCH when NI Brain is not configured", async () => {
    mockIsNiBrainConfiguredAsync.mockResolvedValueOnce(false);

    const res = await PATCH(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caption: "Updated caption" }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "NI Brain is not configured." });
  });

  it("returns 400 for PATCH when request body is invalid", async () => {
    const res = await PATCH(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caption: 123 }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid request." });
    expect(mockUpdatePostCaption).not.toHaveBeenCalled();
  });

  it("updates caption and records learning diffs for caption and visual prompt changes", async () => {
    const res = await PATCH(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caption: "New caption",
          visualPrompt: "new visual prompt",
          originalCaption: "Old caption",
          originalVisualPrompt: "old visual prompt",
        }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockUpdatePostCaption).toHaveBeenCalledWith({
      postId: "post_1",
      caption: "New caption",
      visualPrompt: "new visual prompt",
    });
    expect(mockRecordContentLearning).toHaveBeenCalledTimes(2);
    expect(mockRecordContentLearning).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        signalType: "EDIT_DIFF",
        postId: "post_1",
        originalText: "Old caption",
        editedText: "New caption",
        meta: { field: "caption" },
      }),
    );
    expect(mockRecordContentLearning).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        signalType: "EDIT_DIFF",
        postId: "post_1",
        originalText: "old visual prompt",
        editedText: "new visual prompt",
        meta: { field: "visualPrompt" },
      }),
    );
  });

  it("deletes a post via DELETE", async () => {
    const res = await DELETE(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1", { method: "DELETE" }),
      params("post_1"),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockDeletePost).toHaveBeenCalledWith("post_1");
  });
});

describe("POST /api/admin/content-calendar/posts/[id]/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({
      adminId: "admin_1",
      testMode: false,
      rememberMe: true,
    });
    mockIsNiBrainConfiguredAsync.mockResolvedValue(true);
    mockMarkPostPosted.mockResolvedValue(undefined);
    mockDismissMissedPrompt.mockResolvedValue(undefined);
    mockReschedulePost.mockResolvedValue(undefined);
    mockUpdatePostMedia.mockResolvedValue(undefined);
    mockRecordContentLearning.mockResolvedValue(undefined);
    mockGenerateStaticMedia.mockResolvedValue({ url: "https://cdn.test/image.png" });
    mockRegenerateCalendarPost.mockResolvedValue({
      dayIndex: 1,
      postType: "Static",
      targetGroup: "Atlanta Trainers",
      platforms: "Instagram",
      caption: "Regenerated caption",
      visualPrompt: "Regenerated visual",
      hashtags: ["MatchFit"],
    });
    mockUpsertWeekPosts.mockResolvedValue([
      {
        id: "post_1",
        week_start: "2026-06-08",
        post_date: "2026-06-09",
        day_index: 1,
        post_type: "Static",
      },
    ]);
    mockSerializePostForClient.mockReturnValue({
      id: "post_1",
      caption: "Regenerated caption",
    });
  });

  it("returns 401 when admin session is missing", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const res = await postAction(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "posted" }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 503 when NI Brain is not configured", async () => {
    mockIsNiBrainConfiguredAsync.mockResolvedValueOnce(false);

    const res = await postAction(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "posted" }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "NI Brain is not configured." });
  });

  it("returns 400 for invalid actions", async () => {
    const res = await postAction(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "invalid_action" }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid action." });
  });

  it("returns 400 when the request body is invalid JSON", async () => {
    const res = await postAction(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ invalid json",
      }),
      params("post_1"),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid action." });
  });

  it("marks a post as posted and records POSTED learning", async () => {
    const res = await postAction(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "posted" }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockMarkPostPosted).toHaveBeenCalledWith("post_1");
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

  it("dismisses a missed prompt", async () => {
    const res = await postAction(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "dismiss_missed" }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockDismissMissedPrompt).toHaveBeenCalledWith("post_1");
  });

  it("reschedules a post for the given date", async () => {
    const res = await postAction(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reschedule", newDate: "2026-06-11" }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockReschedulePost).toHaveBeenCalledWith({ postId: "post_1", newDate: "2026-06-11" });
  });

  it("regenerates a post and returns serialized data", async () => {
    const res = await postAction(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "regenerate",
          weekStart: "2026-06-08",
          offset: 7,
          dayIndex: 1,
          postType: "Static",
        }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      post: { id: "post_1", caption: "Regenerated caption" },
    });
    expect(mockRegenerateCalendarPost).toHaveBeenCalledWith({
      weekStart: "2026-06-08",
      offset: 7,
      dayIndex: 1,
      postType: "Static",
      feedback: undefined,
      existingCaption: undefined,
      existingVisualPrompt: undefined,
    });
  });

  it("returns 502 when post regeneration fails", async () => {
    mockRegenerateCalendarPost.mockResolvedValueOnce(null);

    const res = await postAction(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "regenerate",
          weekStart: "2026-06-08",
          offset: 7,
          dayIndex: 1,
          postType: "Static",
        }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "Regeneration failed. Check AI API keys." });
    expect(mockUpsertWeekPosts).not.toHaveBeenCalled();
  });

  it("returns post:null when regenerated post cannot be found after upsert", async () => {
    mockUpsertWeekPosts.mockResolvedValueOnce([
      {
        id: "post_2",
        week_start: "2026-06-08",
        post_date: "2026-06-10",
        day_index: 2,
        post_type: "Video",
      },
    ]);

    const res = await postAction(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "regenerate",
          weekStart: "2026-06-08",
          offset: 7,
          dayIndex: 1,
          postType: "Static",
        }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ post: null });
    expect(mockSerializePostForClient).not.toHaveBeenCalled();
  });

  it("sets media status to failed when image generation fails", async () => {
    mockGenerateStaticMedia.mockResolvedValueOnce(null);

    const res = await postAction(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "generate_media",
          prompt: "Create a high-energy fitness visual for Atlanta trainers",
        }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "Image generation failed. Check OPENAI_API_KEY." });
    expect(mockUpdatePostMedia).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        postId: "post_1",
        mediaUrl: null,
        mediaStatus: "generating",
      }),
    );
    expect(mockUpdatePostMedia).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        postId: "post_1",
        mediaUrl: null,
        mediaStatus: "failed",
      }),
    );
  });

  it("returns media URL and records MEDIA_GENERATED learning on success", async () => {
    const res = await postAction(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "generate_media",
          prompt: "Create a high-energy fitness visual for Atlanta trainers",
        }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ mediaUrl: "https://cdn.test/image.png" });
    expect(mockUpdatePostMedia).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        postId: "post_1",
        mediaUrl: null,
        mediaStatus: "generating",
      }),
    );
    expect(mockUpdatePostMedia).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        postId: "post_1",
        mediaUrl: "https://cdn.test/image.png",
        mediaStatus: "ready",
      }),
    );
    expect(mockRecordContentLearning).toHaveBeenCalledWith(
      expect.objectContaining({
        signalType: "MEDIA_GENERATED",
        postId: "post_1",
        editedText: "https://cdn.test/image.png",
      }),
    );
  });

  it("returns 500 when an action throws unexpectedly", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockMarkPostPosted.mockRejectedValueOnce(new Error("write failed"));

    const res = await postAction(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "posted" }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Action failed." });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
