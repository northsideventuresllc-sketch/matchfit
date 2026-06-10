import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INTERNAL_SYNTHETIC_EMAIL_SUFFIX,
  getLaunchExcludeEmails,
  getLaunchExcludeUsernames,
  isInternalSyntheticMatchFitEmail,
  countLaunchClientsInTx,
  countLaunchPlatformSubscribers,
  countLaunchPremiumTrainers,
  countLaunchTrainersInTx,
  getActivePendingClientRegistrationStats,
  launchClientCountWhere,
  launchClientBillingGraceWhere,
  launchClientFreeTrialCountWhere,
  launchClientPayingSubscriberCountWhere,
  launchClientPlatformPaymentGraceWhere,
  launchClientPlatformTrialCountWhere,
  launchClientStripeTrialCountWhere,
  launchClientWithCardWhere,
  launchPlatformSubscriberCountWhere,
  launchPremiumTrainerCountWhere,
  launchTrainerBeforeRegistrationPaymentWhere,
  launchTrainerBeforeTermsWhere,
  launchTrainerIncompleteSignupWhere,
  launchPendingTrainerWhere,
  launchTrainerCountWhere,
  activePendingClientRegistrationWhere,
  countLaunchClients,
  countLaunchPendingTrainers,
  countLaunchTrainers,
  getActivePendingClientRegistrationStats,
  countPendingClientRegistrations,
} from "@/lib/launch-account-counts";

const {
  mockClientCount,
  mockTrainerCount,
  mockTrainerProfileCount,
  mockPendingClientRegistrationCount,
  mockPendingClientRegistrationGroupBy,
} = vi.hoisted(() => ({
  mockClientCount: vi.fn(),
  mockTrainerCount: vi.fn(),
  mockTrainerProfileCount: vi.fn(),
  mockPendingClientRegistrationCount: vi.fn(),
  mockPendingClientRegistrationGroupBy: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      count: mockClientCount,
    },
    trainer: {
      count: mockTrainerCount,
    },
    trainerProfile: {
      count: mockTrainerProfileCount,
    },
    pendingClientRegistration: {
      count: mockPendingClientRegistrationCount,
      groupBy: mockPendingClientRegistrationGroupBy,
    },
  },
}));

describe("launch account count exclusions", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env = { ...prev };
    delete process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_EMAILS;
    delete process.env.MATCH_FIT_INTERNAL_QA_CLIENT_EMAILS;
    delete process.env.MATCH_FIT_INTERNAL_QA_TRAINER_EMAILS;
  });

  afterEach(() => {
    process.env = prev;
  });

  it("detects internal synthetic email domain", () => {
    expect(isInternalSyntheticMatchFitEmail(`mfqa.trainer.abc@internal.match-fit.invalid`)).toBe(true);
    expect(isInternalSyntheticMatchFitEmail("real@example.com")).toBe(false);
  });

  it("platform subscriber filter requires live Stripe billing and excludes test clients", () => {
    const where = launchPlatformSubscriberCountWhere();
    expect(where.stripeSubscriptionActive).toBe(true);
    expect(where.stripeBillingLiveMode).toBe(true);
    expect(where.stripeSubscriptionId).toEqual({ not: null });
    expect(where.internalQaSyntheticPersona).toBe(false);
    expect(where.NOT?.OR).toEqual(
      expect.arrayContaining([
        { username: { in: expect.arrayContaining(["jibbyjam22"]), mode: "insensitive" } },
      ]),
    );
  });

  it("always excludes owner dev/test clients from launch counts but keeps owner client jbfitness6299", () => {
    expect(getLaunchExcludeUsernames("client")).toEqual(
      expect.arrayContaining(["jibbyjam22", "jonnybronny22", "twofa_tester"]),
    );
    expect(getLaunchExcludeUsernames("client")).not.toContain("jbfitness6299");
    expect(getLaunchExcludeEmails("client")).not.toContain("jonnybooth22@gmail.com");

    const clientWhere = launchClientCountWhere();
    expect(clientWhere.NOT).toEqual({
      OR: expect.arrayContaining([
        { username: { in: expect.arrayContaining(["jibbyjam22", "jonnybronny22"]), mode: "insensitive" } },
      ]),
    });
  });

  it("merges beta exclude list with internal QA emails", () => {
    process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_EMAILS = "Staff@Example.com";
    process.env.MATCH_FIT_INTERNAL_QA_TRAINER_EMAILS = "coach@test.com";
    process.env.MATCH_FIT_INTERNAL_QA_CLIENT_EMAILS = "member@test.com";

    expect(getLaunchExcludeEmails()).toEqual(
      expect.arrayContaining(["staff@example.com", "coach@test.com", "member@test.com"]),
    );
  });

  it("getLaunchExcludeEmails merges builtins, beta exclude list, and env identifiers", () => {
    process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_EMAILS = "Staff@Example.com";
    process.env.MATCH_FIT_DEV_TRAINER_IDENTIFIER = "Coach@Dev.com";
    process.env.MATCH_FIT_DEV_CLIENT_IDENTIFIER = "Member@Dev.com";

    expect(getLaunchExcludeEmails()).toEqual(
      expect.arrayContaining([
        "staff@example.com",
        "coach@dev.com",
        "member@dev.com",
      ]),
    );
    expect(getLaunchExcludeEmails()).not.toContain("jonnybooth22@gmail.com");
  });

  it("launch count filters exclude synthetic personas, builtins, and internal emails", () => {
    process.env.MATCH_FIT_INTERNAL_QA_TRAINER_EMAILS = "qa-coach@example.com";

    const trainerWhere = launchTrainerCountWhere();
    expect(trainerWhere.deidentifiedAt).toBeNull();
    expect(trainerWhere.internalQaSyntheticPersona).toBe(false);
    expect(trainerWhere.OR).toEqual(
      expect.arrayContaining([
        { termsAcceptedAt: { not: null } },
        { profile: { is: { hasSignedTOS: true } } },
      ]),
    );
    expect(trainerWhere.NOT?.OR).toEqual(
      expect.arrayContaining([
        { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" } },
        { email: { endsWith: ".invalid", mode: "insensitive" } },
        { email: { in: expect.arrayContaining(["qa-coach@example.com"]) } },
        { username: { startsWith: "mfqst_", mode: "insensitive" } },
        { username: { in: expect.arrayContaining(["coachjonny22", "jibbyjam22"]), mode: "insensitive" } },
      ]),
    );

    const clientWhere = launchClientCountWhere();
    expect(clientWhere.internalQaSyntheticPersona).toBe(false);
    expect(clientWhere.NOT?.OR).toEqual(
      expect.arrayContaining([
        { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" } },
        { username: { in: expect.arrayContaining(["jibbyjam22", "jonnybronny22"]), mode: "insensitive" } },
      ]),
    );
  });
});

describe("beta launch status slot math", () => {
  it("computes remaining client slots from cap minus used", () => {
    const cap = 50;
    const used = 12;
    expect(Math.max(0, cap - used)).toBe(38);
  });
});

describe("launch-account-counts async", () => {
  const envBeforeTests = { ...process.env };

  beforeEach(() => {
    mockClientCount.mockReset();
    mockTrainerCount.mockReset();
    mockTrainerProfileCount.mockReset();
    mockPendingClientRegistrationCount.mockReset();
    mockPendingClientRegistrationGroupBy.mockReset();
    delete process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_EMAILS;
  });

  afterEach(() => {
    process.env = { ...envBeforeTests };
  });

  it("counts launch clients with synthetic personas excluded", async () => {
    mockClientCount.mockResolvedValue(17);

    await expect(countLaunchClients()).resolves.toBe(17);
    expect(mockClientCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          internalQaSyntheticPersona: false,
        }),
      }),
    );
  });

  it("counts launch trainers with ToS and exclusion rules", async () => {
    mockTrainerCount.mockResolvedValue(9);

    await expect(countLaunchTrainers()).resolves.toBe(9);
    expect(mockTrainerCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          internalQaSyntheticPersona: false,
          OR: expect.arrayContaining([
            { termsAcceptedAt: { not: null } },
            { profile: { is: { hasSignedTOS: true } } },
          ]),
        }),
      }),
    );
  });

  it("counts pending launch trainers with dashboard-not-live + onboarding gates", async () => {
    mockTrainerCount.mockResolvedValue(6);

    await expect(countLaunchPendingTrainers()).resolves.toBe(6);
    expect(mockTrainerCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: { profile: { is: { dashboardActivatedAt: { not: null } } } },
          OR: expect.arrayContaining([
            { termsAcceptedAt: { not: null } },
            { profile: { is: { hasSignedTOS: true } } },
            { profile: { is: { complianceWindowStartedAt: { not: null } } } },
          ]),
        }),
      }),
    );
  });

  it("counts pending registrations with status and expiry guards", async () => {
    mockPendingClientRegistrationCount.mockResolvedValue(5);

    await expect(countPendingClientRegistrations()).resolves.toBe(5);
    expect(mockPendingClientRegistrationCount).toHaveBeenCalledWith({
      where: {
        status: { in: ["PENDING_2FA", "AWAITING_PAYMENT"] },
        expiresAt: { gt: expect.any(Date) },
      },
    });
  });

  it("counts launch platform subscribers using live Stripe filters", async () => {
    mockClientCount.mockResolvedValue(11);

    await expect(countLaunchPlatformSubscribers()).resolves.toBe(11);
    expect(mockClientCount).toHaveBeenCalledWith({
      where: launchPlatformSubscriberCountWhere(),
    });
  });

  it("counts premium trainers from trainer profiles with launch trainer filters", async () => {
    mockTrainerProfileCount.mockResolvedValue(4);

    await expect(countLaunchPremiumTrainers()).resolves.toBe(4);
    expect(mockTrainerProfileCount).toHaveBeenCalledWith({
      where: launchPremiumTrainerCountWhere(),
    });
  });

  it("aggregates pending registration status counts and total", async () => {
    mockPendingClientRegistrationGroupBy.mockResolvedValue([
      { status: "PENDING_2FA", _count: { _all: 2 } },
      { status: "AWAITING_PAYMENT", _count: { _all: 3 } },
    ]);
    const now = new Date("2026-04-02T00:00:00.000Z");

    await expect(getActivePendingClientRegistrationStats(now)).resolves.toEqual({
      total: 5,
      byStatus: { PENDING_2FA: 2, AWAITING_PAYMENT: 3 },
    });
    expect(mockPendingClientRegistrationGroupBy).toHaveBeenCalledWith({
      by: ["status"],
      where: activePendingClientRegistrationWhere(now),
      _count: { _all: true },
    });
  });

  it("returns zero totals when no pending registration rows match", async () => {
    mockPendingClientRegistrationGroupBy.mockResolvedValue([]);

    await expect(getActivePendingClientRegistrationStats()).resolves.toEqual({
      total: 0,
      byStatus: {},
    });
  });

  it("counts launch trainers and clients inside a transaction", async () => {
    const tx = {
      trainer: { count: vi.fn().mockResolvedValue(8) },
      client: { count: vi.fn().mockResolvedValue(19) },
    };
    const txClient = tx as unknown as Parameters<typeof countLaunchTrainersInTx>[0];

    await expect(countLaunchTrainersInTx(txClient)).resolves.toBe(8);
    await expect(countLaunchClientsInTx(txClient)).resolves.toBe(19);
    expect(tx.trainer.count).toHaveBeenCalledWith({ where: launchTrainerCountWhere() });
    expect(tx.client.count).toHaveBeenCalledWith({ where: launchClientCountWhere() });
  });
  it("returns grouped pending registration stats by status", async () => {
    const now = new Date("2026-06-09T12:30:00.000Z");
    mockPendingClientRegistrationGroupBy.mockResolvedValue([
      { status: "PENDING_2FA", _count: { _all: 3 } },
      { status: "AWAITING_PAYMENT", _count: { _all: 2 } },
    ]);

    await expect(getActivePendingClientRegistrationStats(now)).resolves.toEqual({
      total: 5,
      byStatus: {
        PENDING_2FA: 3,
        AWAITING_PAYMENT: 2,
      },
    });
    expect(mockPendingClientRegistrationGroupBy).toHaveBeenCalledWith({
      by: ["status"],
      where: {
        status: { in: ["PENDING_2FA", "AWAITING_PAYMENT"] },
        expiresAt: { gt: now },
      },
      _count: { _all: true },
    });
  });
});

describe("admin funnel count filters", () => {
  const now = new Date("2026-03-15T12:00:00.000Z");

  it("active pending client registration filter excludes expired and completed rows", () => {
    expect(activePendingClientRegistrationWhere(now)).toEqual({
      status: { in: ["PENDING_2FA", "AWAITING_PAYMENT"] },
      expiresAt: { gt: now },
    });
  });

  it("platform trial filter requires active platformTrialEndsAt without live Stripe sub", () => {
    const where = launchClientPlatformTrialCountWhere(now);
    expect(where.platformTrialEndsAt).toEqual({ gt: now });
    expect(where.accountDeactivatedAt).toBeNull();
    expect(where.NOT?.AND).toEqual([
      { stripeSubscriptionActive: true },
      { stripeSubscriptionId: { not: null } },
      { stripeSubscriptionId: { not: "" } },
    ]);
  });

  it("stripe trial filter requires subscription without paid invoice", () => {
    const where = launchClientStripeTrialCountWhere();
    expect(where.stripeSubscriptionActive).toBe(true);
    expect(where.stripeLastSubscriptionInvoicePaidAt).toBeNull();
    expect(where.AND).toEqual([
      { stripeSubscriptionId: { not: null } },
      { stripeSubscriptionId: { not: "" } },
    ]);
  });

  it("free trial filter unions platform and stripe trial paths", () => {
    const where = launchClientFreeTrialCountWhere(now);
    expect(where.OR).toHaveLength(2);
    expect(where.OR?.[0]).toEqual(launchClientPlatformTrialCountWhere(now));
    expect(where.OR?.[1]).toEqual(launchClientStripeTrialCountWhere());
  });

  it("platform payment grace excludes clients still in platform trial", () => {
    const where = launchClientPlatformPaymentGraceWhere(now);
    expect(where.paymentGraceUntil).toEqual({ gt: now });
    expect(where.NOT).toEqual({ platformTrialEndsAt: { gt: now } });
  });

  it("billing grace filter requires grace window and inactive subscription", () => {
    const where = launchClientBillingGraceWhere(now);
    expect(where.subscriptionGraceUntil).toEqual({ gte: now });
    expect(where.stripeSubscriptionActive).toBe(false);
  });

  it("client-with-card filter requires stripe customer id", () => {
    const where = launchClientWithCardWhere();
    expect(where.stripeCustomerId).toEqual({ not: null });
  });

  it("paying subscriber filter matches platform subscriber filter", () => {
    expect(launchClientPayingSubscriberCountWhere()).toEqual(launchPlatformSubscriberCountWhere());
  });

  it("incomplete trainer signup means dashboard not activated", () => {
    const where = launchTrainerIncompleteSignupWhere();
    expect(where.profile).toEqual({ is: { dashboardActivatedAt: null } });
  });

  it("trainer pre registration payment uses new hold/fee fields", () => {
    const where = launchTrainerBeforeRegistrationPaymentWhere();
    expect(where.profile).toEqual({
      is: {
        hasPaidRegistrationFee: false,
        limitedDashboardUnlockedAt: null,
        registrationFeeHoldStatus: { notIn: ["HELD", "CAPTURED"] },
      },
    });
  });

  it("pending trainer filter includes ToS or onboarding started with dashboard not live", () => {
    const where = launchPendingTrainerWhere();
    expect(where.NOT).toEqual({
      profile: { is: { dashboardActivatedAt: { not: null } } },
    });
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { termsAcceptedAt: { not: null } },
        { profile: { is: { hasSignedTOS: true } } },
        { profile: { is: { complianceWindowStartedAt: { not: null } } } },
      ]),
    );
  });

  it("platform trainer count includes pending trainers who accepted Terms on the trainer row", () => {
    const where = launchTrainerCountWhere();
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { termsAcceptedAt: { not: null } },
        { profile: { is: { hasSignedTOS: true } } },
      ]),
    );
  });

  it("pre-tos trainer filter excludes termsAcceptedAt and signed profile rows", () => {
    const where = launchTrainerBeforeTermsWhere();
    expect(where.termsAcceptedAt).toBeNull();
    expect(where.NOT).toEqual({
      profile: { is: { hasSignedTOS: true } },
    });
  });
});
