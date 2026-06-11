import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockClientCount,
  mockTrainerCount,
  mockQueryRaw,
  mockCountLaunchClients,
  mockCountLaunchTrainers,
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
  mockCountLaunchClients: vi.fn(),
  mockCountLaunchTrainers: vi.fn(),
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

vi.mock("@/lib/launch-account-counts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/launch-account-counts")>();
  return {
    ...actual,
    countLaunchClients: mockCountLaunchClients,
    countLaunchTrainers: mockCountLaunchTrainers,
    countLaunchPlatformSubscribers: mockCountLaunchPlatformSubscribers,
    launchClientBillingGraceWhere: mockLaunchClientBillingGraceWhere,
    launchClientCountWhere: mockLaunchClientCountWhere,
    launchClientFreeTrialCountWhere: mockLaunchClientFreeTrialCountWhere,
    launchClientPlatformPaymentGraceWhere: mockLaunchClientPlatformPaymentGraceWhere,
    launchTrainerCountWhere: mockLaunchTrainerCountWhere,
    launchPendingTrainerWhere: vi.fn(() => ({ __tag: "launch-pending" })),
  };
});

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
    mockCountLaunchClients.mockResolvedValue(1);
    mockCountLaunchTrainers.mockResolvedValue(0);
    mockCountLaunchPlatformSubscribers.mockResolvedValue(12);
    mockClientCount.mockImplementation((args?: { where?: Record<string, unknown> }) => {
      const w = args?.where;
      if (w && "freeTrial" in w && w.freeTrial === true) return Promise.resolve(7);
      if (w && w.stripeSubscriptionActive === false) return Promise.resolve(9);
      return Promise.resolve(40);
    });
    mockTrainerCount.mockImplementation((args?: { where?: Record<string, unknown> }) => {
      if (args?.where?.__tag === "launch-pending") return Promise.resolve(4);
      const profileIs = (args?.where?.profile as { is?: { dashboardActivatedAt?: { not?: unknown } } } | undefined)?.is;
      if (profileIs && "dashboardActivatedAt" in profileIs && "not" in (profileIs.dashboardActivatedAt ?? {})) {
        return Promise.resolve(30);
      }
      return Promise.resolve(0);
    });
    mockQueryRaw.mockResolvedValue([{ n: BigInt(0) }]);
    mockIsPrismaMissingTableError.mockReturnValue(false);
  });

  it("builds admin member overview metrics from launch and analytics data", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ n: BigInt(99) }]);

    const result = await getAdminMemberOverviewPanel(new Date("2026-06-09T12:00:00.000Z"));

    expect(result).toEqual({
      allMembersTotal: 1,
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

    const result = await getAdminMemberOverviewPanel(new Date("2026-06-09T12:00:00.000Z"));

    expect(result.uniqueSiteVisitorsAllTime).toBe(0);
    expect(mockIsPrismaMissingTableError).toHaveBeenCalledWith(err, "site_analytics_events");
  });

  it("rethrows unknown analytics query failures", async () => {
    const err = new Error("query failed");
    mockQueryRaw.mockRejectedValueOnce(err);
    mockIsPrismaMissingTableError.mockReturnValueOnce(false);
    mockClientCount.mockResolvedValueOnce(10).mockResolvedValueOnce(2).mockResolvedValueOnce(3);

    await expect(getAdminMemberOverviewPanel()).rejects.toBe(err);
  });
});
