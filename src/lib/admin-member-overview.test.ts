import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockClientCount,
  mockTrainerCount,
  mockQueryRaw,
  mockAdminMemberOverviewLifetimeClientWhere,
  mockAdminMemberOverviewLifetimeTrainerWhere,
  mockAdminMemberOverviewVipTrialClientWhere,
  mockAdminMemberOverviewFreePlanClientWhere,
  mockAdminMemberOverviewActiveVipClientWhere,
  mockAdminMemberOverviewActiveClientWhere,
  mockAdminMemberOverviewSubscribedClientWhere,
  mockAdminPortalTrainerListWhere,
  mockGetHomeUserCounts,
  mockIsPrismaMissingTableError,
  mockIsPrismaMissingColumnError,
} = vi.hoisted(() => ({
  mockClientCount: vi.fn(),
  mockTrainerCount: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockAdminMemberOverviewLifetimeClientWhere: vi.fn(),
  mockAdminMemberOverviewLifetimeTrainerWhere: vi.fn(),
  mockAdminMemberOverviewVipTrialClientWhere: vi.fn(),
  mockAdminMemberOverviewFreePlanClientWhere: vi.fn(),
  mockAdminMemberOverviewActiveVipClientWhere: vi.fn(),
  mockAdminMemberOverviewActiveClientWhere: vi.fn(),
  mockAdminMemberOverviewSubscribedClientWhere: vi.fn(),
  mockAdminPortalTrainerListWhere: vi.fn(),
  mockGetHomeUserCounts: vi.fn(),
  mockIsPrismaMissingTableError: vi.fn(),
  mockIsPrismaMissingColumnError: vi.fn(),
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

vi.mock("@/lib/admin-portal-list-filters", () => ({
  adminPendingTrainerWhere: vi.fn(() => ({ __tag: "admin-pending" })),
  adminMemberOverviewLifetimeClientWhere: mockAdminMemberOverviewLifetimeClientWhere,
  adminMemberOverviewLifetimeTrainerWhere: mockAdminMemberOverviewLifetimeTrainerWhere,
  adminMemberOverviewVipTrialClientWhere: mockAdminMemberOverviewVipTrialClientWhere,
  adminMemberOverviewFreePlanClientWhere: mockAdminMemberOverviewFreePlanClientWhere,
  adminMemberOverviewActiveVipClientWhere: mockAdminMemberOverviewActiveVipClientWhere,
  adminMemberOverviewActiveClientWhere: mockAdminMemberOverviewActiveClientWhere,
  adminMemberOverviewSubscribedClientWhere: mockAdminMemberOverviewSubscribedClientWhere,
  adminPortalTrainerListWhere: mockAdminPortalTrainerListWhere,
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

    mockAdminMemberOverviewLifetimeClientWhere.mockReturnValue({ __tag: "lifetime-client" });
    mockAdminMemberOverviewLifetimeTrainerWhere.mockReturnValue({ __tag: "lifetime-trainer" });
    mockAdminMemberOverviewActiveClientWhere.mockReturnValue({
      deidentifiedAt: null,
      accountDeactivatedAt: null,
    });
    mockAdminMemberOverviewVipTrialClientWhere.mockReturnValue({ vipTrial: true });
    mockAdminMemberOverviewFreePlanClientWhere.mockReturnValue({ freePlan: true });
    mockAdminMemberOverviewActiveVipClientWhere.mockReturnValue({ activeVip: true });
    mockAdminMemberOverviewSubscribedClientWhere.mockReturnValue({ subscribed: true });
    mockAdminPortalTrainerListWhere.mockReturnValue({ deidentifiedAt: null });

    mockGetHomeUserCounts.mockResolvedValue({
      clientsTotal: 80,
      clientsActive: 35,
      trainersTotal: 50,
      trainersActive: 20,
      trainersPending: 4,
    });
    mockClientCount.mockImplementation((args?: { where?: Record<string, unknown> }) => {
      const w = args?.where;
      if (w?.__tag === "lifetime-client") return Promise.resolve(30);
      if (w && "vipTrial" in w) return Promise.resolve(7);
      if (w && "freePlan" in w) return Promise.resolve(18);
      if (w && "activeVip" in w) return Promise.resolve(7);
      if (w && w.updatedAt && w.NOT) return Promise.resolve(9);
      return Promise.resolve(0);
    });
    mockTrainerCount.mockImplementation((args?: { where?: Record<string, unknown> }) => {
      if (args?.where?.__tag === "admin-pending") return Promise.resolve(4);
      if (args?.where?.__tag === "lifetime-trainer") return Promise.resolve(12);
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

  it("builds admin member overview metrics from admin portal filters", async () => {
    const result = await getAdminMemberOverviewPanel(new Date("2026-06-09T12:00:00.000Z"));

    expect(result).toEqual({
      allMembersTotal: 42,
      vipTrialClients: 7,
      subscribedClients: 32,
      inactiveClients: 9,
      freePlanClients: 18,
      activeVipClients: 7,
      uniqueSiteVisitorsAllTime: 99,
      pendingTrainers: 4,
      compliantActiveTrainers: 20,
      inactiveTrainers: 10,
    });
    expect(mockGetHomeUserCounts).toHaveBeenCalledTimes(2);
    expect(mockAdminMemberOverviewVipTrialClientWhere).toHaveBeenCalled();
    expect(mockAdminMemberOverviewFreePlanClientWhere).toHaveBeenCalled();
    expect(mockAdminMemberOverviewActiveVipClientWhere).toHaveBeenCalled();
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
