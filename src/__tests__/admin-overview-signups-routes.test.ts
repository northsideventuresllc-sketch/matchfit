import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTestCookieJar, testCookieJar } from "@/test/next-cookie-jar";

const {
  mockVerifyAdminSessionToken,
  mockAdministratorFindUnique,
  mockGetAdminPortalOverview,
  mockGetAdminSignupLog,
} = vi.hoisted(() => ({
  mockVerifyAdminSessionToken: vi.fn(),
  mockAdministratorFindUnique: vi.fn(),
  mockGetAdminPortalOverview: vi.fn(),
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
  getAdminPortalOverview: mockGetAdminPortalOverview,
  getAdminSignupLog: mockGetAdminSignupLog,
}));

import { GET as getAdminOverview } from "@/app/api/admin/overview/route";
import { GET as getAdminSignups } from "@/app/api/admin/signups/route";

function setAdminCookie(value = "admin_token"): void {
  testCookieJar.set("mf_admin_session", value);
}

describe("admin overview + signups routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTestCookieJar();

    mockVerifyAdminSessionToken.mockResolvedValue({
      adminId: "admin_123",
      testMode: false,
      rememberMe: true,
    });
    mockAdministratorFindUnique.mockResolvedValue({ id: "admin_123" });
    mockGetAdminPortalOverview.mockResolvedValue({
      userCounts: { clients: 12, trainers: 5 },
      revenue: { revenueCents: 0, grossProfitCents: 0, eventCount: 0, byCategory: {} },
      recentFeatured: [],
    });
    mockGetAdminSignupLog.mockResolvedValue({ rows: [], total: 0 });
  });

  describe("GET /api/admin/overview", () => {
    it("returns 401 when no admin session cookie is present", async () => {
      const res = await getAdminOverview();

      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
      expect(mockVerifyAdminSessionToken).not.toHaveBeenCalled();
    });

    it("returns 401 when admin session token verification fails", async () => {
      setAdminCookie();
      mockVerifyAdminSessionToken.mockResolvedValueOnce(null);

      const res = await getAdminOverview();

      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
    });

    it("returns 401 when verified admin id no longer exists", async () => {
      setAdminCookie();
      mockAdministratorFindUnique.mockResolvedValueOnce(null);

      const res = await getAdminOverview();

      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
      expect(mockGetAdminPortalOverview).not.toHaveBeenCalled();
    });

    it("returns overview payload for an authorized administrator", async () => {
      setAdminCookie();
      mockGetAdminPortalOverview.mockResolvedValueOnce({
        userCounts: { clients: 100, trainers: 25 },
        revenue: {
          revenueCents: 123_000,
          grossProfitCents: 40_500,
          eventCount: 9,
          byCategory: {},
        },
        recentFeatured: [],
      });

      const res = await getAdminOverview();

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        userCounts: { clients: 100, trainers: 25 },
        revenue: {
          revenueCents: 123_000,
          grossProfitCents: 40_500,
          eventCount: 9,
          byCategory: {},
        },
        recentFeatured: [],
      });
    });

    it("returns 500 when overview loading fails", async () => {
      setAdminCookie();
      mockGetAdminPortalOverview.mockRejectedValueOnce(new Error("boom"));

      const res = await getAdminOverview();

      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({ error: "Could not load overview." });
    });
  });

  describe("GET /api/admin/signups", () => {
    it("returns 401 when unauthorized", async () => {
      mockVerifyAdminSessionToken.mockResolvedValueOnce(null);
      setAdminCookie();

      const res = await getAdminSignups(new Request("https://example.test/api/admin/signups"));

      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: "Unauthorized." });
      expect(mockGetAdminSignupLog).not.toHaveBeenCalled();
    });

    it("uses default pagination when query params are absent", async () => {
      setAdminCookie();

      const res = await getAdminSignups(new Request("https://example.test/api/admin/signups"));

      expect(res.status).toBe(200);
      expect(mockGetAdminSignupLog).toHaveBeenCalledWith({ limit: 50, offset: 0 });
      await expect(res.json()).resolves.toEqual({ rows: [], total: 0 });
    });

    it("uses limit/offset from the request query string", async () => {
      setAdminCookie();
      mockGetAdminSignupLog.mockResolvedValueOnce({
        rows: [{ id: "u1", kind: "client" }],
        total: 1,
      });

      const res = await getAdminSignups(
        new Request("https://example.test/api/admin/signups?limit=25&offset=10"),
      );

      expect(res.status).toBe(200);
      expect(mockGetAdminSignupLog).toHaveBeenCalledWith({ limit: 25, offset: 10 });
      await expect(res.json()).resolves.toEqual({
        rows: [{ id: "u1", kind: "client" }],
        total: 1,
      });
    });

    it("returns 500 when signup log query throws", async () => {
      setAdminCookie();
      mockGetAdminSignupLog.mockRejectedValueOnce(new Error("db unavailable"));

      const res = await getAdminSignups(new Request("https://example.test/api/admin/signups"));

      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({ error: "Could not load signup log." });
    });
  });
});
