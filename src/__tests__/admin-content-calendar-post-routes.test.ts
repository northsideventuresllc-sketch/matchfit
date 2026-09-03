import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdminSession,
  mockIsNiBrainConfiguredAsync,
  mockRecordContentLearning,
  mockUpdatePostFields,
  mockDeletePost,
  mockMarkPostPosted,
  mockDismissMissedPrompt,
  mockReschedulePost,
  mockUpdatePostMedia,
  mockUpsertWeekPosts,
  mockSerializePostForClient,
  mockRegenerateCalendarPost,
  mockFireMediaAgentForPost,
} = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockIsNiBrainConfiguredAsync: vi.fn(),
  mockRecordContentLearning: vi.fn(),
  mockUpdatePostFields: vi.fn(),
  mockDeletePost: vi.fn(),
  mockMarkPostPosted: vi.fn(),
  mockDismissMissedPrompt: vi.fn(),
  mockReschedulePost: vi.fn(),
  mockUpdatePostMedia: vi.fn(),
  mockUpsertWeekPosts: vi.fn(),
  mockSerializePostForClient: vi.fn(),
  mockRegenerateCalendarPost: vi.fn(),
  mockFireMediaAgentForPost: vi.fn(),
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
}));

vi.mock("@/lib/content-calendar/content-calendar-cowork-orchestration", () => ({
  fireMediaAgentForPost: mockFireMediaAgentForPost,
}));

vi.mock("@/lib/content-calendar/content-calendar-store", () => ({
  updatePostFields: mockUpdatePostFields,
  updatePostCaption: mockUpdatePostFields,
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
    mockUpdatePostFields.mockResolvedValue(undefined);
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
    expect(mockUpdatePostFields).not.toHaveBeenCalled();
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
    await expect(res.json()).resolves.toEqual({
      ok: true,
      caption: "New caption",
      visualPrompt: "new visual prompt",
      withinLimit: true,
    });
    expect(mockUpdatePostFields).toHaveBeenCalledWith({
      postId: "post_1",
      caption: "New caption",
      visualPrompt: "new visual prompt",
      hashtags: undefined,
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

  it("does not truncate over-limit captions on operator PATCH saves", async () => {
    const longCaption = "Z".repeat(620);
    const res = await PATCH(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caption: longCaption,
          hashtags: ["MatchFit"],
        }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      caption: longCaption,
      hashtags: ["MatchFit"],
      withinLimit: false,
    });
    expect(mockUpdatePostFields).toHaveBeenCalledWith({
      postId: "post_1",
      caption: longCaption,
      visualPrompt: undefined,
      hashtags: ["MatchFit"],
    });
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
    mockFireMediaAgentForPost.mockResolvedValue({
      job: { id: "job_1" },
      post: { id: "post_1", media_status: "generating" },
    });
    mockRegenerateCalendarPost.mockResolvedValue({
      dayIndex: 1,
      postType: "Static",
      targetGroup: "Join the Team",
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

  // Corrected 2026-09-03 (Decision #1722 item 4 + same-date Learning, lane D2): media generation
  // is never an image API — this route now queues the Mac mini's Chrome/Gemini agent via
  // fireMediaAgentForPost() and never writes media_status itself.
  it("returns 502 without touching media_status when the mini queue fails", async () => {
    mockFireMediaAgentForPost.mockRejectedValueOnce(new Error("nvg_mini_jobs insert failed"));

    const res = await postAction(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "generate_media",
          prompt: "Create a high-energy fitness visual for online coaches",
        }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "nvg_mini_jobs insert failed" });
    expect(mockUpdatePostMedia).not.toHaveBeenCalled();
  });

  it("queues the Mac mini agent and records MEDIA_GENERATED learning on success", async () => {
    const prompt = "Create a high-energy fitness visual for online coaches";
    const res = await postAction(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "generate_media",
          prompt,
        }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, queued: true });
    expect(mockFireMediaAgentForPost).toHaveBeenCalledWith("post_1", { feedback: prompt });
    expect(mockUpdatePostMedia).not.toHaveBeenCalled();
    expect(mockRecordContentLearning).toHaveBeenCalledWith(
      expect.objectContaining({
        signalType: "MEDIA_GENERATED",
        postId: "post_1",
        meta: expect.objectContaining({ queuedToMini: true }),
      }),
    );
  });
});
