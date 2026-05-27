import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INTERNAL_SYNTHETIC_EMAIL_SUFFIX,
  getLaunchExcludeEmails,
  isInternalSyntheticMatchFitEmail,
  launchClientCountWhere,
  launchTrainerCountWhere,
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

  it("counts launch trainers with exclusion rules", async () => {
    mockTrainerCount.mockResolvedValue(9);

    await expect(countLaunchTrainers()).resolves.toBe(9);
    expect(mockTrainerCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          internalQaSyntheticPersona: false,
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
