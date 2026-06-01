import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const {
  mockPlatformRevenueEventCreate,
  mockPlatformRevenueEventCount,
  mockPlatformRevenueEventGroupBy,
  mockCountLaunchPlatformSubscribers,
  mockCountLaunchPremiumTrainers,
} = vi.hoisted(() => ({
  mockPlatformRevenueEventCreate: vi.fn(),
  mockPlatformRevenueEventCount: vi.fn(),
  mockPlatformRevenueEventGroupBy: vi.fn(),
  mockCountLaunchPlatformSubscribers: vi.fn(),
  mockCountLaunchPremiumTrainers: vi.fn(),
}));

vi.mock("@/lib/launch-account-counts", () => ({
  countLaunchPlatformSubscribers: mockCountLaunchPlatformSubscribers,
  countLaunchPremiumTrainers: mockCountLaunchPremiumTrainers,
  launchClientCountWhere: vi.fn(() => ({ deidentifiedAt: null })),
  launchTrainerCountWhere: vi.fn(() => ({ deidentifiedAt: null })),
}));

vi.mock("@/lib/platform-revenue-filters", () => ({
  LIVE_PLATFORM_REVENUE_WHERE: { billingLiveMode: true },
  scrubNonLivePlatformRevenueEvents: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformRevenueEvent: {
      create: mockPlatformRevenueEventCreate,
      count: mockPlatformRevenueEventCount,
      groupBy: mockPlatformRevenueEventGroupBy,
    },
    client: {
      findMany: vi.fn(),
      findUnique: vi.fn().mockResolvedValue({ stripeBillingLiveMode: true }),
    },
    trainerProfile: {
      findMany: vi.fn(),
    },
    trainerClientServiceTransaction: {
      findMany: vi.fn(),
    },
    trainerTokenLedgerEntry: {
      findMany: vi.fn(),
    },
  },
}));

import {
  getPlatformRevenueTotals,
  recordPlatformRevenueEvent,
  recordServiceCheckoutRevenueEvent,
} from "./platform-revenue-events";

function prismaKnownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`test ${code}`, {
    code,
    clientVersion: "unit-test",
  });
}

describe("platform-revenue-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPlatformRevenueEventCreate.mockResolvedValue({});
    mockPlatformRevenueEventCount.mockResolvedValue(1);
    mockPlatformRevenueEventGroupBy.mockResolvedValue([]);
    mockCountLaunchPlatformSubscribers.mockResolvedValue(0);
    mockCountLaunchPremiumTrainers.mockResolvedValue(0);
  });

  it("skips sandbox revenue events", async () => {
    await recordPlatformRevenueEvent({
      category: "ONE_TIME_PURCHASE",
      idempotencyKey: "evt_sandbox",
      revenueCents: 100,
      grossProfitCents: 10,
      billingLiveMode: false,
    });
    expect(mockPlatformRevenueEventCreate).not.toHaveBeenCalled();
  });

  it("normalizes negative and fractional cents before persisting", async () => {
    await recordPlatformRevenueEvent({
      category: "ONE_TIME_PURCHASE",
      idempotencyKey: "evt_1",
      revenueCents: -4.4,
      grossProfitCents: 19.8,
      trainerId: "trainer_1",
      clientId: null,
      metaJson: null,
    });

    expect(mockPlatformRevenueEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: "ONE_TIME_PURCHASE",
        idempotencyKey: "evt_1",
        revenueCents: 0,
        grossProfitCents: 19,
        trainerId: "trainer_1",
        clientId: undefined,
        metaJson: undefined,
      }),
    });
  });

  it("ignores duplicate idempotency conflicts", async () => {
    mockPlatformRevenueEventCreate.mockRejectedValueOnce(prismaKnownError("P2002"));

    await expect(
      recordPlatformRevenueEvent({
        category: "SERVICE_CHECKOUT",
        idempotencyKey: "dup_key",
        revenueCents: 100,
        grossProfitCents: 20,
      }),
    ).resolves.toBeUndefined();
  });

  it("ignores missing platform revenue table errors", async () => {
    mockPlatformRevenueEventCreate.mockRejectedValueOnce(prismaKnownError("P2021"));

    await expect(
      recordPlatformRevenueEvent({
        category: "SERVICE_CHECKOUT",
        idempotencyKey: "missing_table",
        revenueCents: 100,
        grossProfitCents: 10,
      }),
    ).resolves.toBeUndefined();
  });

  it("records service checkout events with derived payload details", async () => {
    const completedAt = new Date("2026-05-27T18:00:00.000Z");

    await recordServiceCheckoutRevenueEvent({
      transactionId: "tx_1",
      clientId: "client_1",
      trainerId: "trainer_1",
      amountCents: 10_000,
      totalChargedCents: 11_200,
      adminFeeCents: 1_200,
      completedAt,
    });

    expect(mockPlatformRevenueEventCreate).toHaveBeenCalledWith({
      data: {
        category: "SERVICE_CHECKOUT",
        idempotencyKey: "service_tx:tx_1",
        revenueCents: 11_200,
        grossProfitCents: 1_200,
        clientId: "client_1",
        trainerId: "trainer_1",
        billingLiveMode: true,
        metaJson: JSON.stringify({
          amountCents: 10_000,
          totalChargedCents: 11_200,
          adminFeeCents: 1_200,
        }),
        createdAt: completedAt,
      },
    });
  });

  it("aggregates totals and category breakdowns", async () => {
    mockCountLaunchPlatformSubscribers.mockResolvedValueOnce(6);
    mockCountLaunchPremiumTrainers.mockResolvedValueOnce(3);
    mockPlatformRevenueEventGroupBy.mockResolvedValueOnce([
      {
        category: "SERVICE_CHECKOUT",
        _sum: { revenueCents: 1_200, grossProfitCents: 300 },
        _count: { _all: 2 },
      },
      {
        category: "CLIENT_PLATFORM_SUBSCRIPTION",
        _sum: { revenueCents: 400, grossProfitCents: 200 },
        _count: { _all: 1 },
      },
      {
        category: "NOT_A_PLATFORM_CATEGORY",
        _sum: { revenueCents: 999, grossProfitCents: 999 },
        _count: { _all: 1 },
      },
    ]);

    await expect(getPlatformRevenueTotals()).resolves.toEqual({
      revenueCents: 1_600,
      grossProfitCents: 500,
      eventCount: 3,
      byCategory: {
        SERVICE_CHECKOUT: { revenueCents: 1_200, grossProfitCents: 300, eventCount: 2 },
        CLIENT_PLATFORM_SUBSCRIPTION: { revenueCents: 400, grossProfitCents: 200, eventCount: 1 },
        TRAINER_PREMIUM_SUBSCRIPTION: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
        ONE_TIME_PURCHASE: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
      },
      activeClientSubscribers: 6,
      activeTrainerPremiumSubscribers: 3,
    });
  });

  it("returns zeroed event totals when the table is missing", async () => {
    mockCountLaunchPlatformSubscribers.mockResolvedValueOnce(4);
    mockCountLaunchPremiumTrainers.mockResolvedValueOnce(2);
    mockPlatformRevenueEventGroupBy.mockRejectedValueOnce(prismaKnownError("P2021"));

    await expect(getPlatformRevenueTotals()).resolves.toEqual({
      revenueCents: 0,
      grossProfitCents: 0,
      eventCount: 0,
      byCategory: {
        SERVICE_CHECKOUT: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
        CLIENT_PLATFORM_SUBSCRIPTION: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
        TRAINER_PREMIUM_SUBSCRIPTION: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
        ONE_TIME_PURCHASE: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
      },
      activeClientSubscribers: 4,
      activeTrainerPremiumSubscribers: 2,
    });
  });
});
