import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INTERNAL_SYNTHETIC_EMAIL_SUFFIX,
  getLaunchExcludeEmails,
  getLaunchExcludeUsernames,
  isInternalSyntheticMatchFitEmail,
  launchClientCountWhere,
  launchClientFreeTrialCountWhere,
  launchClientPlatformPaymentGraceWhere,
  launchClientPlatformTrialCountWhere,
  launchClientStripeTrialCountWhere,
  launchPlatformSubscriberCountWhere,
  launchTrainerBeforeRegistrationPaymentWhere,
  launchTrainerIncompleteSignupWhere,
  launchPendingTrainerWhere,
  launchTrainerCountWhere,
  activePendingClientRegistrationWhere,
  countLaunchClients,
  countLaunchTrainers,
  countPendingClientRegistrations,
} from "@/lib/launch-account-counts";

const { mockClientCount, mockTrainerCount, mockPendingClientRegistrationCount } = vi.hoisted(() => ({
  mockClientCount: vi.fn(),
  mockTrainerCount: vi.fn(),
  mockPendingClientRegistrationCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      count: mockClientCount,
    },
    trainer: {
      count: mockTrainerCount,
    },
    pendingClientRegistration: {
      count: mockPendingClientRegistrationCount,
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
        { username: { in: expect.arrayContaining(["jbfitness6299"]), mode: "insensitive" } },
      ]),
    );
  });

  it("always excludes owner dev/test clients jbfitness6299 and jonnybronny from launch counts", () => {
    expect(getLaunchExcludeUsernames("client")).toEqual(
      expect.arrayContaining(["jbfitness6299", "jonnybronny"]),
    );
    expect(getLaunchExcludeEmails("client")).toContain("jonnybooth22@gmail.com");

    const clientWhere = launchClientCountWhere();
    expect(clientWhere.NOT).toEqual({
      OR: expect.arrayContaining([
        { username: { in: expect.arrayContaining(["jbfitness6299", "jonnybronny"]), mode: "insensitive" } },
        { email: { in: expect.arrayContaining(["jonnybooth22@gmail.com"]) } },
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
        "jonnybooth22@gmail.com",
        "staff@example.com",
        "coach@dev.com",
        "member@dev.com",
      ]),
    );
  });

  it("launch count filters exclude synthetic personas, builtins, and internal emails", () => {
    process.env.MATCH_FIT_INTERNAL_QA_TRAINER_EMAILS = "qa-coach@example.com";

    const trainerWhere = launchTrainerCountWhere();
    expect(trainerWhere.deidentifiedAt).toBeNull();
    expect(trainerWhere.internalQaSyntheticPersona).toBe(false);
    expect(trainerWhere.profile).toEqual({ is: { hasSignedTOS: true } });
    expect(trainerWhere.NOT?.OR).toEqual(
      expect.arrayContaining([
        { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" } },
        { email: { endsWith: ".invalid", mode: "insensitive" } },
        { email: { in: expect.arrayContaining(["jonnybooth22@gmail.com", "qa-coach@example.com"]) } },
        { username: { startsWith: "mfqst_", mode: "insensitive" } },
        { username: { startsWith: "coachjonny22", mode: "insensitive" } },
      ]),
    );

    const clientWhere = launchClientCountWhere();
    expect(clientWhere.internalQaSyntheticPersona).toBe(false);
    expect(clientWhere.NOT?.OR).toEqual(
      expect.arrayContaining([
        { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" } },
        { email: { in: expect.arrayContaining(["jonnybooth22@gmail.com"]) } },
        { username: { startsWith: "jbfitness6299", mode: "insensitive" } },
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
    mockPendingClientRegistrationCount.mockReset();
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
          profile: { is: { hasSignedTOS: true } },
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
});
