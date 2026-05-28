import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const {
  mockQueryRaw,
  mockClientFindMany,
  mockTrainerFindMany,
  mockTrainerClientServiceTransactionGroupBy,
  mockFeaturedDailyAllocationFindMany,
  mockFormatFeaturedDisplayDayLabel,
  mockGetPlatformRevenueTotals,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockClientFindMany: vi.fn(),
  mockTrainerFindMany: vi.fn(),
  mockTrainerClientServiceTransactionGroupBy: vi.fn(),
  mockFeaturedDailyAllocationFindMany: vi.fn(),
  mockFormatFeaturedDisplayDayLabel: vi.fn(),
  mockGetPlatformRevenueTotals: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    client: {
      findMany: mockClientFindMany,
    },
    trainer: {
      findMany: mockTrainerFindMany,
    },
    trainerClientServiceTransaction: {
      groupBy: mockTrainerClientServiceTransactionGroupBy,
    },
    featuredDailyAllocation: {
      findMany: mockFeaturedDailyAllocationFindMany,
    },
  },
}));

vi.mock("@/lib/featured-eastern-calendar", () => ({
  formatFeaturedDisplayDayLabel: mockFormatFeaturedDisplayDayLabel,
}));

vi.mock("@/lib/platform-revenue-events", () => ({
  getPlatformRevenueTotals: mockGetPlatformRevenueTotals,
}));

import {
  formatUsdFromCents,
  getAdminRecentFeatured,
  getAdminRevenueSnapshot,
  getAdminSignupLog,
} from "@/lib/admin-portal-data";

function missingSyntheticPersonaError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    `column "internalQaSyntheticPersona" does not exist (SQLSTATE 42703)`,
    {
      code: "P2010",
      clientVersion: "unit-test",
    },
  );
}

describe("admin-portal-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockQueryRaw.mockResolvedValue([]);
    mockClientFindMany.mockResolvedValue([]);
    mockTrainerFindMany.mockResolvedValue([]);
    mockTrainerClientServiceTransactionGroupBy.mockResolvedValue([]);
    mockFeaturedDailyAllocationFindMany.mockResolvedValue([]);
    mockFormatFeaturedDisplayDayLabel.mockImplementation((dayKey: string) => `Label ${dayKey}`);
    mockGetPlatformRevenueTotals.mockResolvedValue({
      revenueCents: 0,
      grossProfitCents: 0,
      eventCount: 0,
      byCategory: {},
      activeClientSubscribers: 0,
      activeTrainerPremiumSubscribers: 0,
    });
  });

  it("formats whole dollars", () => {
    expect(formatUsdFromCents(12_500)).toBe("$125");
  });

  it("formats zero", () => {
    expect(formatUsdFromCents(0)).toBe("$0");
  });

  it("builds signup rows with merged profile and transaction stats", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        {
          kind: "client",
          id: "client_1",
          username: "client-one",
          email: "client@example.com",
          preferred_name: "  Chris  ",
          first_name: null,
          last_name: null,
          created_at: new Date("2026-05-27T10:00:00.000Z"),
        },
        {
          kind: "trainer",
          id: "trainer_1",
          username: "trainer-one",
          email: "trainer@example.com",
          preferred_name: "",
          first_name: "Taylor",
          last_name: "Coach",
          created_at: new Date("2026-05-27T09:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([{ total: BigInt(2) }]);

    mockClientFindMany.mockResolvedValueOnce([
      {
        id: "client_1",
        stripeSubscriptionActive: true,
        safetySuspended: false,
      },
    ]);
    mockTrainerFindMany.mockResolvedValueOnce([
      {
        id: "trainer_1",
        safetySuspended: true,
        profile: {
          dashboardActivatedAt: new Date("2026-05-01T00:00:00.000Z"),
          backgroundCheckStatus: "APPROVED",
          premiumStudioEnabledAt: null,
        },
      },
    ]);
    mockTrainerClientServiceTransactionGroupBy
      .mockResolvedValueOnce([
        {
          clientId: "client_1",
          _count: { _all: 3 },
          _sum: { totalChargedCents: 7_500, amountCents: 0 },
        },
      ])
      .mockResolvedValueOnce([
        {
          trainerId: "trainer_1",
          _count: { _all: 2 },
          _sum: { amountCents: 4_000 },
        },
      ]);

    const result = await getAdminSignupLog({ limit: 20, offset: 0 });

    expect(result.total).toBe(2);
    expect(result.rows).toEqual([
      {
        kind: "client",
        id: "client_1",
        username: "client-one",
        email: "client@example.com",
        displayName: "Chris",
        createdAt: "2026-05-27T10:00:00.000Z",
        stats: {
          completedPurchases: 3,
          grossVolumeCents: 7_500,
          subscriptionActive: true,
          dashboardActivated: null,
          backgroundCheckStatus: null,
          premiumStudio: null,
          safetySuspended: false,
        },
      },
      {
        kind: "trainer",
        id: "trainer_1",
        username: "trainer-one",
        email: "trainer@example.com",
        displayName: "Taylor Coach",
        createdAt: "2026-05-27T09:00:00.000Z",
        stats: {
          completedPurchases: 2,
          grossVolumeCents: 4_000,
          subscriptionActive: null,
          dashboardActivated: true,
          backgroundCheckStatus: "APPROVED",
          premiumStudio: false,
          safetySuspended: true,
        },
      },
    ]);
  });

  it("falls back to legacy signup query when synthetic persona columns are unavailable", async () => {
    mockQueryRaw
      .mockRejectedValueOnce(missingSyntheticPersonaError())
      .mockResolvedValueOnce([{ total: BigInt(0) }])
      .mockResolvedValueOnce([
        {
          kind: "client",
          id: "client_legacy",
          username: "legacy-client",
          email: "legacy@example.com",
          preferred_name: null,
          first_name: null,
          last_name: null,
          created_at: new Date("2026-05-20T00:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([{ total: BigInt(1) }]);

    const result = await getAdminSignupLog({ limit: 50, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.rows[0]).toMatchObject({
      id: "client_legacy",
      displayName: "legacy-client",
      stats: {
        completedPurchases: 0,
        grossVolumeCents: 0,
      },
    });
  });

  it("maps recent featured allocations with formatted display labels", async () => {
    mockFeaturedDailyAllocationFindMany.mockResolvedValueOnce([
      {
        displayDayKey: "2026-05-27",
        regionZipPrefix: "303",
        source: "PAID_BID",
        trainerId: "trainer_1",
        trainer: {
          username: "coach-a",
          preferredName: "  Coach A  ",
          firstName: "Coach",
          lastName: "A",
        },
      },
      {
        displayDayKey: "2026-05-26",
        regionZipPrefix: "404",
        source: "RAFFLE",
        trainerId: "trainer_2",
        trainer: {
          username: "coach-b",
          preferredName: "",
          firstName: "Coach",
          lastName: "Bee",
        },
      },
    ]);

    await expect(getAdminRecentFeatured(2)).resolves.toEqual([
      {
        displayDayKey: "2026-05-27",
        displayDayLabel: "Label 2026-05-27",
        regionZipPrefix: "303",
        source: "PAID_BID",
        trainerId: "trainer_1",
        username: "coach-a",
        displayName: "Coach A",
      },
      {
        displayDayKey: "2026-05-26",
        displayDayLabel: "Label 2026-05-26",
        regionZipPrefix: "404",
        source: "RAFFLE",
        trainerId: "trainer_2",
        username: "coach-b",
        displayName: "Coach Bee",
      },
    ]);
  });

  it("maps platform revenue totals into admin snapshot shape", async () => {
    mockGetPlatformRevenueTotals.mockResolvedValueOnce({
      revenueCents: 16_000,
      grossProfitCents: 5_500,
      eventCount: 9,
      byCategory: { SERVICE_CHECKOUT: { revenueCents: 10_000, grossProfitCents: 3_000, eventCount: 4 } },
      activeClientSubscribers: 21,
      activeTrainerPremiumSubscribers: 8,
    });

    await expect(getAdminRevenueSnapshot()).resolves.toEqual({
      revenueCents: 16_000,
      grossProfitCents: 5_500,
      eventCount: 9,
      byCategory: { SERVICE_CHECKOUT: { revenueCents: 10_000, grossProfitCents: 3_000, eventCount: 4 } },
      activePlatformSubscribers: 21,
      activeTrainerPremiumSubscribers: 8,
    });
  });
});
