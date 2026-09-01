import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAdminSession,
  mockIsNiBrainConfiguredAsync,
  mockCreateNiBrainClient,
  mockEnsureContentCalendarV23Schema,
} = vi.hoisted(() => ({
  mockRequireAdminSession: vi.fn(),
  mockIsNiBrainConfiguredAsync: vi.fn(),
  mockCreateNiBrainClient: vi.fn(),
  mockEnsureContentCalendarV23Schema: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/ni-brain-client", () => ({
  isNiBrainConfiguredAsync: mockIsNiBrainConfiguredAsync,
  createNiBrainClient: mockCreateNiBrainClient,
}));

vi.mock("@/lib/ensure-content-hub-schema", () => ({
  ensureContentCalendarV23Schema: mockEnsureContentCalendarV23Schema,
  isMissingContentCalendarV23SchemaError: () => false,
}));

import { POST } from "@/app/api/admin/content-calendar/v2/pending/back-to-drafts/route";

type FakeRow = Record<string, unknown>;

/**
 * Minimal Supabase builder covering the two chains the store uses:
 *   read:  from().select().eq().maybeSingle()
 *   write: from().update().eq().select().single()
 * Records every update payload so the test can assert nothing was written on a refusal.
 */
function fakeClient(row: FakeRow | null) {
  const updates: FakeRow[] = [];
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
    single: () => Promise.resolve({ data: { ...row, ...updates[updates.length - 1] }, error: null }),
    update: (patch: FakeRow) => {
      updates.push(patch);
      return builder;
    },
  });
  return { client: { from: () => builder }, updates };
}

function postJson(body: unknown): Request {
  return new Request("https://matchfit.test/api/admin/content-calendar/v2/pending/back-to-drafts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const pendingRow: FakeRow = {
  id: "post_1",
  posted: false,
  revision: 3,
  workflow_stage: "publishing",
  status: "publishing",
  approved_at: "2026-07-27T12:00:00.000Z",
  scheduled_at: "2026-07-28T21:00:00.000Z",
  post_type: "Static",
  target_group: "Join the Team",
  platforms: "Instagram, Threads",
  caption: "Caption copy",
  media_urls: ["https://cdn.test/a.png"],
  media_status: "ready",
  hashtags: ["#matchfit"],
  week_start: "2026-07-27",
  day_index: 1,
};

describe("POST /api/admin/content-calendar/v2/pending/back-to-drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({ adminId: "admin_1", testMode: false, rememberMe: true });
    mockIsNiBrainConfiguredAsync.mockResolvedValue(true);
    mockEnsureContentCalendarV23Schema.mockResolvedValue(undefined);
  });

  it("returns 401 when the requester is not an authenticated admin", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const res = await POST(postJson({ postId: "post_1" }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockCreateNiBrainClient).not.toHaveBeenCalled();
  });

  it("returns 400 when no post id is supplied", async () => {
    const res = await POST(postJson({}));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Pick a post to send back to drafts." });
    expect(mockCreateNiBrainClient).not.toHaveBeenCalled();
  });

  it("refuses an already-posted post with a plain message and changes nothing", async () => {
    const { client, updates } = fakeClient({ ...pendingRow, posted: true, status: "posted" });
    mockCreateNiBrainClient.mockReturnValue(client);

    const res = await POST(postJson({ postId: "post_1" }));

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe(
      "That post has already gone out, so it cannot be pulled back. Nothing was changed.",
    );
    // The refusal must happen before any write — the post is NOT un-posted.
    expect(updates).toEqual([]);
  });

  it("sends a pending post back to drafts, clearing approval and posting time and bumping revision", async () => {
    const { client, updates } = fakeClient(pendingRow);
    mockCreateNiBrainClient.mockReturnValue(client);

    const res = await POST(postJson({ postId: "post_1" }));

    expect(res.status).toBe(200);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      workflow_stage: "hub",
      status: "draft",
      approved_at: null,
      scheduled_at: null,
      revision: 4,
    });
    // Media is deliberately left alone — JB may want to keep the pictures.
    expect(Object.keys(updates[0])).not.toContain("media_urls");
    expect(Object.keys(updates[0])).not.toContain("media_url");
    expect(Object.keys(updates[0])).not.toContain("media_status");
  });

  it("reports a plain message when the post cannot be found", async () => {
    const { client } = fakeClient(null);
    mockCreateNiBrainClient.mockReturnValue(client);

    const res = await POST(postJson({ postId: "missing" }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "That post could not be found." });
  });

  // This route is @deprecated (see its file header) — the v2 Pending tab now calls the generic
  // POST /posts/[id]/actions route with { action: "back_to_drafts" } instead. It is still live for
  // anything that still points at this URL, and must keep working for a post genuinely sitting in
  // the new "pending" workflow_stage (introduced alongside this deprecation), not just "publishing".
  it("still works for a post in the new pending stage, same as it always did for publishing", async () => {
    const { client, updates } = fakeClient({ ...pendingRow, workflow_stage: "pending", status: "pending" });
    mockCreateNiBrainClient.mockReturnValue(client);

    const res = await POST(postJson({ postId: "post_1" }));

    expect(res.status).toBe(200);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ workflow_stage: "hub", status: "draft", approved_at: null });
  });
});
