import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListSupportInboxMessages, mockMarkSupportMessageRead, mockRequireAdminSession } = vi.hoisted(() => ({
  mockListSupportInboxMessages: vi.fn(),
  mockMarkSupportMessageRead: vi.fn(),
  mockRequireAdminSession: vi.fn(),
}));

vi.mock("@/lib/support-inbox-data", () => ({
  listSupportInboxMessages: mockListSupportInboxMessages,
  markSupportMessageRead: mockMarkSupportMessageRead,
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

import { GET, PATCH } from "@/app/api/admin/support-inbox/route";

describe("/api/admin/support-inbox route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminSession.mockResolvedValue({ adminId: "admin_1", testMode: false, rememberMe: false });
    mockListSupportInboxMessages.mockResolvedValue([]);
    mockMarkSupportMessageRead.mockResolvedValue(undefined);
  });

  it("returns 401 from GET when admin session is missing", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockListSupportInboxMessages).not.toHaveBeenCalled();
  });

  it("returns support messages for authorized admins", async () => {
    mockListSupportInboxMessages.mockResolvedValueOnce([
      {
        id: "msg_1",
        createdAt: "2026-06-08T12:00:00.000Z",
        fromEmail: "user@example.com",
        subject: "Help",
        textPreview: "Need assistance",
        status: "unread",
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      messages: [
        {
          id: "msg_1",
          createdAt: "2026-06-08T12:00:00.000Z",
          fromEmail: "user@example.com",
          subject: "Help",
          textPreview: "Need assistance",
          status: "unread",
        },
      ],
    });
    expect(mockListSupportInboxMessages).toHaveBeenCalledWith(100);
  });

  it("returns 401 from PATCH when admin session is missing", async () => {
    mockRequireAdminSession.mockResolvedValueOnce(null);

    const response = await PATCH(
      new Request("https://matchfit.test/api/admin/support-inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "msg_1" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockMarkSupportMessageRead).not.toHaveBeenCalled();
  });

  it("returns 400 from PATCH for invalid JSON", async () => {
    const response = await PATCH(
      new Request("https://matchfit.test/api/admin/support-inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{bad-json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON" });
    expect(mockMarkSupportMessageRead).not.toHaveBeenCalled();
  });

  it("returns 400 from PATCH when id is missing", async () => {
    const response = await PATCH(
      new Request("https://matchfit.test/api/admin/support-inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "id required" });
    expect(mockMarkSupportMessageRead).not.toHaveBeenCalled();
  });

  it("marks the support message as read when id is provided", async () => {
    const response = await PATCH(
      new Request("https://matchfit.test/api/admin/support-inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "msg_123" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockMarkSupportMessageRead).toHaveBeenCalledWith("msg_123");
  });
});
