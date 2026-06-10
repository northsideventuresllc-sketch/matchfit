import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdminSession,
  mockIsNiBrainConfiguredAsync,
  mockRecordContentLearning,
  mockUpdatePostCaption,
  mockDeletePost,
} = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockIsNiBrainConfiguredAsync: vi.fn(),
  mockRecordContentLearning: vi.fn(),
  mockUpdatePostCaption: vi.fn(),
  mockDeletePost: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/ni-brain-client", () => ({
  isNiBrainConfiguredAsync: mockIsNiBrainConfiguredAsync,
  recordContentLearning: mockRecordContentLearning,
}));

vi.mock("@/lib/content-calendar/content-calendar-store", () => ({
  updatePostCaption: mockUpdatePostCaption,
  deletePost: mockDeletePost,
}));

import { DELETE, PATCH } from "@/app/api/admin/content-calendar/posts/[id]/route";

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

  it("skips update and learning when caption is omitted", async () => {
    const res = await PATCH(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visualPrompt: "Only visual prompt" }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockUpdatePostCaption).not.toHaveBeenCalled();
    expect(mockRecordContentLearning).not.toHaveBeenCalled();
  });

  it("returns 500 for PATCH when saving fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockUpdatePostCaption.mockRejectedValueOnce(new Error("db down"));

    const res = await PATCH(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caption: "Updated caption" }),
      }),
      params("post_1"),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Could not save post." });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("returns 401 for DELETE when admin session is missing", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const res = await DELETE(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1", { method: "DELETE" }),
      params("post_1"),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("returns 503 for DELETE when NI Brain is not configured", async () => {
    mockIsNiBrainConfiguredAsync.mockResolvedValueOnce(false);

    const res = await DELETE(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1", { method: "DELETE" }),
      params("post_1"),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "NI Brain is not configured." });
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

  it("returns 500 for DELETE when deletion fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockDeletePost.mockRejectedValueOnce(new Error("db unavailable"));

    const res = await DELETE(
      new Request("https://matchfit.test/api/admin/content-calendar/posts/post_1", { method: "DELETE" }),
      params("post_1"),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Could not delete post." });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
