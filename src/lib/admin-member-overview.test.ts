import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockClientCount,
  mockTrainerCount,
  mockQueryRaw,
  mockCountLaunchLifetimeMembers,
  mockLaunchClientCountWhere,
  mockLaunchClientPlatformTrialCountWhere,
  mockLaunchClientFreePlanWhere,
  mockLaunchClientSubscribedPlansWhere,
  mockLaunchClientActiveVipWhere,
  mockLaunchClientActiveAccountWhere,
  mockLaunchTrainerCountWhere,
  mockGetHomeUserCounts,
  mockIsPrismaMissingTableError,
  mockIsPrismaMissingColumnError,
  mockBuildLaunchMetricsClientSqlFilter,
} = vi.hoisted(() => ({
  mockClientCount: vi.fn(),
  mockTrainerCount: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockCountLaunchLifetimeMembers: vi.fn(),
  mockLaunchClientCountWhere: vi.fn(),
  mockLaunchClientPlatformTrialCountWhere: vi.fn(),
  mockLaunchClientFreePlanWhere: vi.fn(),
  mockLaunchClientSubscribedPlansWhere: vi.fn(),
  mockLaunchClientActiveVipWhere: vi.fn(),
  mockLaunchClientActiveAccountWhere: vi.fn(),
  mockLaunchTrainerCountWhere: vi.fn(),
  mockGetHomeUserCounts: vi.fn(),
  mockIsPrismaMissingTableError: vi.fn(),
  mockIsPrismaMissingColumnError: vi.fn(),
  mockBuildLaunchMetricsClientSqlFilter: vi.fn(),
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
    countLaunchLifetimeMembers: mockCountLaunchLifetimeMembers,
    launchClientCountWhere: mockLaunchClientCountWhere,
    launchClientPlatformTrialCountWhere: mockLaunchClientPlatformTrialCountWhere,
    launchClientFreePlanWhere: mockLaunchClientFreePlanWhere,
    launchClientSubscribedPlansWhere: mockLaunchClientSubscribedPlansWhere,
    launchClientActiveVipWhere: mockLaunchClientActiveVipWhere,
    launchClientActiveAccountWhere: mockLaunchClientActiveAccountWhere,
    launchTrainerCountWhere: mockLaunchTrainerCountWhere,
  };
});

vi.mock("@/lib/admin-portal-list-filters", () => ({
  adminPendingTrainerWhere: vi.fn(() => ({ __tag: "admin-pending" })),
  buildLaunchMetricsClientSqlFilter: mockBuildLaunchMetricsClientSqlFilter,
}));

vi.mock("@/lib/home-user-counts", () => ({
  getHomeUserCounts: mockGetHomeUserCounts,
}));

vi.mock("@/lib/prisma-missing-column", () => ({
  isPrismaMissingTableError: mockIsPrismaMissingTableError,
  isPrismaMissingColumnError: mockIsPrismaMissingColumnError,
}));

import { getAdminMemberOverviewPanel } from "@/lib/admin-member-overview";

describe("admin-member-overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockLaunchClientCountWhere.mockReturnValue({ deidentifiedAt: null });
    mockLaunchClientActiveAccountWhere.mockReturnValue({ deidentifiedAt: null, accountDeactivatedAt: null });
    mockLaunchClientPlatformTrialCountWhere.mockReturnValue({ vipTrial: true });
    mockLaunchClientFreePlanWhere.mockReturnValue({ freePlan: true });
    mockLaunchClientSubscribedPlansWhere.mockReturnValue({ subscribed: true });
    mockLaunchClientActiveVipWhere.mockReturnValue({ activeVip: true });
    mockLaunchTrainerCountWhere.mockReturnValue({ deidentifiedAt: null });
    mockBuildLaunchMetricsClientSqlFilter.mockReturnValue("");

    mockGetHomeUserCounts.mockResolvedValue({
      clientsTotal: 80,
      clientsActive: 35,
      trainersTotal: 50,
      trainersActive: 20,
      trainersPending: 4,
    });
    mockCountLaunchLifetimeMembers.mockResolvedValue(42);
    mockClientCount.mockImplementation((args?: { where?: Record<string, unknown> }) => {
      const w = args?.where;
      if (w && "vipTrial" in w) return Promise.resolve(7);
      if (w && "freePlan" in w) return Promise.resolve(18);
      if (w && "activeVip" in w) return Promise.resolve(7);
      if (w && w.updatedAt && w.NOT) return Promise.resolve(9);
      return Promise.resolve(0);
    });
    mockTrainerCount.mockImplementation((args?: { where?: Record<string, unknown> }) => {
      if (args?.where?.__tag === "admin-pending") return Promise.resolve(4);
      const profileIs = (args?.where?.profile as { is?: { dashboardActivatedAt?: { not?: unknown } } } | undefined)?.is;
      if (profileIs && "dashboardActivatedAt" in profileIs && "not" in (profileIs.dashboardActivatedAt ?? {})) {
        return Promise.resolve(30);
      }
      return Promise.resolve(0);
    });
    mockQueryRaw.mockResolvedValue([{ n: BigInt(99) }]);
    mockIsPrismaMissingTableError.mockReturnValue(false);
    mockIsPrismaMissingColumnError.mockReturnValue(false);
  });

  it("builds admin member overview metrics from launch and analytics data", async () => {
    const result = await getAdminMemberOverviewPanel(new Date("2026-06-09T12:00:00.000Z"));

    expect(result).toEqual({
      allMembersTotal: 42,
      vipTrialClients: 7,
      subscribedClients: 25,
      inactiveClients: 9,
      freePlanClients: 18,
      activeVipClients: 7,
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

    const result = await getAdminMemberOverviewPanel(new Date("2026-06-09T12:00:00.000Z"));

    expect(result.uniqueSiteVisitorsAllTime).toBe(0);
    expect(mockIsPrismaMissingTableError).toHaveBeenCalledWith(err, "site_analytics_events");
  });

  it("rethrows unknown analytics query failures", async () => {
    const err = new Error("query failed");
    mockQueryRaw.mockRejectedValueOnce(err);
    mockIsPrismaMissingTableError.mockReturnValueOnce(false);

    await expect(getAdminMemberOverviewPanel()).rejects.toBe(err);
  });
});
