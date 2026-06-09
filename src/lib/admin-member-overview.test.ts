import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockClientCount,
  mockTrainerCount,
  mockQueryRaw,
  mockCountLaunchPlatformSubscribers,
  mockLaunchClientBillingGraceWhere,
  mockLaunchClientCountWhere,
  mockLaunchClientFreeTrialCountWhere,
  mockLaunchClientPlatformPaymentGraceWhere,
  mockLaunchTrainerCountWhere,
  mockGetHomeUserCounts,
  mockIsPrismaMissingTableError,
} = vi.hoisted(() => ({
  mockClientCount: vi.fn(),
  mockTrainerCount: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockCountLaunchPlatformSubscribers: vi.fn(),
  mockLaunchClientBillingGraceWhere: vi.fn(),
  mockLaunchClientCountWhere: vi.fn(),
  mockLaunchClientFreeTrialCountWhere: vi.fn(),
  mockLaunchClientPlatformPaymentGraceWhere: vi.fn(),
  mockLaunchTrainerCountWhere: vi.fn(),
  mockGetHomeUserCounts: vi.fn(),
  mockIsPrismaMissingTableError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      count: mockClientCount,
    },
    trainer: {
      count: mockTrainerCount,
    },
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock("@/lib/launch-account-counts", () => ({
  countLaunchPlatformSubscribers: mockCountLaunchPlatformSubscribers,
  launchClientBillingGraceWhere: mockLaunchClientBillingGraceWhere,
  launchClientCountWhere: mockLaunchClientCountWhere,
  launchClientFreeTrialCountWhere: mockLaunchClientFreeTrialCountWhere,
  launchClientPlatformPaymentGraceWhere: mockLaunchClientPlatformPaymentGraceWhere,
  launchTrainerCountWhere: mockLaunchTrainerCountWhere,
}));

vi.mock("@/lib/home-user-counts", () => ({
  getHomeUserCounts: mockGetHomeUserCounts,
}));

vi.mock("@/lib/prisma-missing-column", () => ({
  isPrismaMissingTableError: mockIsPrismaMissingTableError,
}));

import { getAdminMemberOverviewPanel } from "@/lib/admin-member-overview";

describe("admin-member-overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockLaunchClientCountWhere.mockReturnValue({ deidentifiedAt: null });
    mockLaunchTrainerCountWhere.mockReturnValue({ deidentifiedAt: null });
    mockLaunchClientFreeTrialCountWhere.mockReturnValue({ freeTrial: true });
    mockLaunchClientPlatformPaymentGraceWhere.mockReturnValue({ paymentGrace: true });
    mockLaunchClientBillingGraceWhere.mockReturnValue({ billingGrace: true });

    mockGetHomeUserCounts.mockResolvedValue({
      clientsTotal: 80,
      clientsActive: 35,
      trainersTotal: 50,
      trainersActive: 20,
      trainersPending: 4,
    });
    mockCountLaunchPlatformSubscribers.mockResolvedValue(12);
    mockClientCount.mockResolvedValue(0);
    mockTrainerCount.mockResolvedValue(0);
    mockQueryRaw.mockResolvedValue([{ n: BigInt(0) }]);
    mockIsPrismaMissingTableError.mockReturnValue(false);
  });

  it("builds admin member overview metrics from launch and analytics data", async () => {
    mockClientCount
      .mockResolvedValueOnce(40) // activeClients in countTotalActiveMembers
      .mockResolvedValueOnce(7) // freeTrialClients
      .mockResolvedValueOnce(9); // inactiveClients
    mockTrainerCount
      .mockResolvedValueOnce(30); // onboarded trainers in countInactiveTrainers
    mockQueryRaw.mockResolvedValueOnce([{ n: BigInt(99) }]);

    const result = await getAdminMemberOverviewPanel(new Date("2026-06-09T12:00:00.000Z"));

    expect(result).toEqual({
      totalActiveMembers: 64,
      totalMembers: 130,
      freeTrialClients: 7,
      subscribedClients: 12,
      inactiveClients: 9,
      uniqueSiteVisitorsAllTime: 99,
      pendingTrainers: 4,
      compliantActiveTrainers: 20,
      inactiveTrainers: 10,
    });
    expect(mockGetHomeUserCounts).toHaveBeenCalledTimes(2);
  });

  it("returns zero unique site visitors when analytics table is missing", async () => {
    const err = new Error("missing site analytics table");
    mockQueryRaw.mockRejectedValueOnce(err);
    mockIsPrismaMissingTableError.mockReturnValueOnce(true);
    mockClientCount.mockResolvedValueOnce(10).mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    mockTrainerCount.mockResolvedValueOnce(22);

    const result = await getAdminMemberOverviewPanel(new Date("2026-06-09T12:00:00.000Z"));

    expect(result.uniqueSiteVisitorsAllTime).toBe(0);
    expect(mockIsPrismaMissingTableError).toHaveBeenCalledWith(err, "site_analytics_events");
  });

  it("rethrows unknown analytics query failures", async () => {
    const err = new Error("query failed");
    mockQueryRaw.mockRejectedValueOnce(err);
    mockIsPrismaMissingTableError.mockReturnValueOnce(false);
    mockClientCount.mockResolvedValueOnce(10).mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    mockTrainerCount.mockResolvedValueOnce(22);

    await expect(getAdminMemberOverviewPanel()).rejects.toBe(err);
  });
});
