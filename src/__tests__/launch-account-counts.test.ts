import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  countLaunchClients,
  countLaunchTrainers,
  countPendingClientRegistrations,
} from "@/lib/launch-account-counts";

const { clientCountMock, trainerCountMock, pendingCountMock } = vi.hoisted(() => ({
  clientCountMock: vi.fn(),
  trainerCountMock: vi.fn(),
  pendingCountMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { count: clientCountMock },
    trainer: { count: trainerCountMock },
    pendingClientRegistration: { count: pendingCountMock },
  },
}));

describe("launch-account-counts", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_EMAILS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("counts launch clients with synthetic personas excluded", async () => {
    clientCountMock.mockResolvedValue(12);

    await expect(countLaunchClients()).resolves.toBe(12);
    expect(clientCountMock).toHaveBeenCalledWith({
      where: {
        deidentifiedAt: null,
        internalQaSyntheticPersona: false,
      },
    });
  });

  it("counts launch trainers with normalized excluded emails", async () => {
    process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_EMAILS = "Staff@MatchFit.com, qa+demo@example.com ";
    trainerCountMock.mockResolvedValue(7);

    await expect(countLaunchTrainers()).resolves.toBe(7);
    expect(trainerCountMock).toHaveBeenCalledWith({
      where: {
        deidentifiedAt: null,
        internalQaSyntheticPersona: false,
        NOT: {
          email: {
            in: ["staff@matchfit.com", "qa+demo@example.com"],
          },
        },
      },
    });
  });

  it("counts launch clients with normalized excluded emails", async () => {
    process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_EMAILS = "CLIENT1@EXAMPLE.COM,client2@example.com";
    clientCountMock.mockResolvedValue(5);

    await expect(countLaunchClients()).resolves.toBe(5);
    expect(clientCountMock).toHaveBeenCalledWith({
      where: {
        deidentifiedAt: null,
        internalQaSyntheticPersona: false,
        NOT: {
          email: {
            in: ["client1@example.com", "client2@example.com"],
          },
        },
      },
    });
  });

  it("counts pending registrations with expiry and pending statuses", async () => {
    pendingCountMock.mockResolvedValue(3);

    await expect(countPendingClientRegistrations()).resolves.toBe(3);

    expect(pendingCountMock).toHaveBeenCalledTimes(1);
    const where = pendingCountMock.mock.calls[0]?.[0]?.where as {
      status: { in: string[] };
      expiresAt: { gt: Date };
    };
    expect(where.status.in).toEqual(["PENDING_2FA", "AWAITING_PAYMENT"]);
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });
});
