import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTestCookieJar, testCookieJar } from "@/test/next-cookie-jar";

const {
  mockVerifyAdminSessionToken,
  mockAdministratorFindUnique,
  mockGetAdminPortalOverview,
} = vi.hoisted(() => ({
  mockVerifyAdminSessionToken: vi.fn(),
  mockAdministratorFindUnique: vi.fn(),
  mockGetAdminPortalOverview: vi.fn(),
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
}));

import { GET } from "@/app/api/admin/overview/route";

describe("GET /api/admin/overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTestCookieJar();

    mockVerifyAdminSessionToken.mockResolvedValue({ adminId: "admin_1" });
    mockAdministratorFindUnique.mockResolvedValue({ id: "admin_1" });
    mockGetAdminPortalOverview.mockResolvedValue({
      userCounts: {
        trainersTotal: 50,
        trainersActive: 20,
        clientsTotal: 80,
        clientsActive: 30,
      },
      revenue: {
        revenueCents: 10_000,
        grossProfitCents: 2_000,
        eventCount: 4,
        byCategory: {
          SERVICE_CHECKOUT: { revenueCents: 3_000, grossProfitCents: 1_000, eventCount: 2 },
          CLIENT_PLATFORM_SUBSCRIPTION: {
            revenueCents: 2_000,
            grossProfitCents: 500,
            eventCount: 1,
          },
          TRAINER_PREMIUM_SUBSCRIPTION: {
            revenueCents: 4_000,
            grossProfitCents: 400,
            eventCount: 1,
          },
          ONE_TIME_PURCHASE: { revenueCents: 1_000, grossProfitCents: 100, eventCount: 0 },
        },
        activePlatformSubscribers: 8,
        activeTrainerPremiumSubscribers: 3,
      },
      recentSignups: [],
      recentFeatured: [],
    });
  });

  it("returns 401 when the admin session cookie is missing", async () => {
    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockVerifyAdminSessionToken).not.toHaveBeenCalled();
    expect(mockAdministratorFindUnique).not.toHaveBeenCalled();
  });

  it("returns 401 when the session token is invalid", async () => {
    testCookieJar.set("mf_admin_session", "admin_token");
    mockVerifyAdminSessionToken.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockAdministratorFindUnique).not.toHaveBeenCalled();
  });

  it("returns 401 when the session admin cannot be found", async () => {
    testCookieJar.set("mf_admin_session", "admin_token");
    mockAdministratorFindUnique.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockGetAdminPortalOverview).not.toHaveBeenCalled();
  });

  it("returns the admin overview for authenticated administrators", async () => {
    testCookieJar.set("mf_admin_session", "admin_token");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.userCounts.clientsTotal).toBe(80);
    expect(body.revenue.grossProfitCents).toBe(2_000);
    expect(mockGetAdminPortalOverview).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when overview loading throws", async () => {
    testCookieJar.set("mf_admin_session", "admin_token");
    mockGetAdminPortalOverview.mockRejectedValueOnce(new Error("db down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Could not load overview." });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
