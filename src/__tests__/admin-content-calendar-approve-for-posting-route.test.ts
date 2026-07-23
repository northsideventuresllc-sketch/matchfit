import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdminSession,
  mockIsNiBrainConfiguredAsync,
  mockEnsureSchema,
  mockIsMissingSchemaError,
  mockApproveForPosting,
} = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockIsNiBrainConfiguredAsync: vi.fn(),
  mockEnsureSchema: vi.fn(),
  mockIsMissingSchemaError: vi.fn(),
  mockApproveForPosting: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({ requireAdminSession: mockRequireAdminSession }));
vi.mock("@/lib/ni-brain-client", () => ({ isNiBrainConfiguredAsync: mockIsNiBrainConfiguredAsync }));
vi.mock("@/lib/ensure-content-hub-schema", () => ({
  ensureContentCalendarV22Schema: mockEnsureSchema,
  isMissingContentCalendarV22SchemaError: mockIsMissingSchemaError,
}));
vi.mock("@/lib/content-calendar/content-calendar-cowork-orchestration", () => ({
  approvePublishingPostsForPosting: mockApproveForPosting,
}));

import { POST } from "@/app/api/admin/content-calendar/v2/publishing/approve-for-posting/route";

function postJson(body: unknown): Request {
  return new Request("https://matchfit.test/api/admin/content-calendar/v2/publishing/approve-for-posting", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdminSession.mockResolvedValue({ adminId: "admin_1" });
  mockIsNiBrainConfiguredAsync.mockResolvedValue(true);
  mockEnsureSchema.mockResolvedValue(undefined);
  mockIsMissingSchemaError.mockReturnValue(false);
  mockApproveForPosting.mockResolvedValue({ job: { id: "job_1" }, postCount: 2 });
});

describe("POST /api/admin/content-calendar/v2/publishing/approve-for-posting", () => {
  it("forwards postIds and platformOverrides to the orchestrator", async () => {
    const res = await POST(
      postJson({ postIds: ["post_1", "post_2"], platformOverrides: { post_1: ["Instagram", "Threads"] } }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, jobId: "job_1", postCount: 2 });
    expect(mockApproveForPosting).toHaveBeenCalledWith({
      postIds: ["post_1", "post_2"],
      platformOverrides: { post_1: ["Instagram", "Threads"] },
    });
  });

  it("accepts a body with no platformOverrides (backward compatible)", async () => {
    const res = await POST(postJson({ postIds: ["post_1"] }));

    expect(res.status).toBe(200);
    expect(mockApproveForPosting).toHaveBeenCalledWith({ postIds: ["post_1"], platformOverrides: undefined });
  });

  it("rejects a malformed platformOverrides shape", async () => {
    const res = await POST(postJson({ platformOverrides: { post_1: "Instagram" } }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid approve-for-posting request." });
    expect(mockApproveForPosting).not.toHaveBeenCalled();
  });
});
