import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTestCookieJar, testCookieJar } from "@/test/next-cookie-jar";

const {
  mockVerifyAdminSessionToken,
  mockAdministratorFindUnique,
  mockGetAdminSignupLog,
} = vi.hoisted(() => ({
  mockVerifyAdminSessionToken: vi.fn(),
  mockAdministratorFindUnique: vi.fn(),
  mockGetAdminSignupLog: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  ADMIN_SESSION_COOKIE: "mf_admin_session",
  verifyAdminSessionToken: mockVerifyAdminSessionToken,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    administrator: {
      findUnique: mockAdministratorFindUnique,
    },
  },
}));

vi.mock("@/lib/admin-portal-data", () => ({
  getAdminSignupLog: mockGetAdminSignupLog,
}));

import { GET } from "@/app/api/admin/signups/route";

describe("GET /api/admin/signups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTestCookieJar();

    mockVerifyAdminSessionToken.mockResolvedValue({ adminId: "admin_1" });
    mockAdministratorFindUnique.mockResolvedValue({ id: "admin_1" });
    mockGetAdminSignupLog.mockResolvedValue({
      rows: [
        {
          kind: "client",
          id: "client_1",
          username: "cuser",
          email: "client@example.com",
          displayName: "Client User",
          createdAt: "2026-05-27T00:00:00.000Z",
          stats: {
            completedPurchases: 0,
            grossVolumeCents: 0,
            subscriptionActive: false,
            dashboardActivated: null,
            backgroundCheckStatus: null,
            premiumStudio: null,
            safetySuspended: false,
          },
        },
      ],
      total: 1,
    });
  });

  it("returns 401 when the admin session cookie is missing", async () => {
    const response = await GET(new Request("https://example.test/api/admin/signups"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockGetAdminSignupLog).not.toHaveBeenCalled();
  });

  it("returns 401 when session resolves but admin lookup fails", async () => {
    testCookieJar.set("mf_admin_session", "token");
    mockAdministratorFindUnique.mockResolvedValueOnce(null);

    const response = await GET(new Request("https://example.test/api/admin/signups"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockGetAdminSignupLog).not.toHaveBeenCalled();
  });

  it("loads signup rows with default query params", async () => {
    testCookieJar.set("mf_admin_session", "token");

    const response = await GET(new Request("https://example.test/api/admin/signups"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetAdminSignupLog).toHaveBeenCalledWith({ limit: 50, offset: 0 });
    expect(body.total).toBe(1);
    expect(body.rows).toHaveLength(1);
  });

  it("passes numeric limit and offset query params", async () => {
    testCookieJar.set("mf_admin_session", "token");

    await GET(new Request("https://example.test/api/admin/signups?limit=12&offset=7"));

    expect(mockGetAdminSignupLog).toHaveBeenCalledWith({ limit: 12, offset: 7 });
  });

  it("returns 500 when signup log loading fails", async () => {
    testCookieJar.set("mf_admin_session", "token");
    mockGetAdminSignupLog.mockRejectedValueOnce(new Error("db failure"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(new Request("https://example.test/api/admin/signups"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Could not load signup log." });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
